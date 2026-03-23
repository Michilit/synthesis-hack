// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Treasury
/// @notice Multi-sig board spending, agent spending caps (by ERC-8004 tokenId),
///         mock ERC-4626 yield deposits, and RWA allocation with a 40 % single-asset cap.
///         No deployer address is emitted in events.
contract Treasury is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    uint256 public constant AUTO_SPEND_THRESHOLD = 0.01 ether;
    uint256 public constant MAX_SINGLE_BPS       = 4000; // 40 %
    uint256 public constant BPS_DENOMINATOR      = 10_000;
    uint256 public constant MAX_DESCRIPTION_BYTES = 500;
    uint256 public constant MONTH_SECONDS        = 30 days;

    // -------------------------------------------------------------------------
    // Enums
    // -------------------------------------------------------------------------

    enum AssetType { CRYPTO, STABLECOIN, TOKENIZED_BOND, REAL_ESTATE }

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct SpendingProposal {
        uint256 id;
        address to;
        address token;          // address(0) = ETH
        uint256 amount;
        string  description;
        uint256 sigCount;
        bool    executed;
        bool    requiresHumanApproval;
        address proposedBy;
    }

    struct AgentAction {
        uint256 tokenId;
        string  action;
        uint256 amount;
        uint256 timestamp;
        string  description;
    }

    struct RWAPosition {
        AssetType assetType;
        uint256   amount;
        string    assetName;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    // Board multisig
    address[] public boardMembers;
    uint256   public requiredSignatures;

    // Token whitelist
    mapping(address => bool) public acceptedTokens;

    // Spending proposals
    uint256 private _nextProposalId = 1;
    mapping(uint256 => SpendingProposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public proposalSigned;

    // Agent spending caps (tokenId => cap per month in wei)
    mapping(uint256 => uint256) public agentSpendingCaps;
    mapping(uint256 => uint256) public agentSpentThisMonth;
    mapping(uint256 => uint256) public agentSpendingResetTime;

    // Agent action log
    AgentAction[] public agentActionLog;

    // Mock yield (ERC-4626 simulation)
    uint256 public totalYieldDeposited;

    // RWA positions
    RWAPosition[] public rwaPositions;
    uint256 public totalRWAAllocated;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event FundsReceived(address indexed sender, uint256 amount);
    event SpendingProposed(uint256 indexed proposalId, address to, address token, uint256 amount, string description);
    event ProposalSigned(uint256 indexed proposalId, address indexed signer, uint256 sigCount);
    event ProposalExecuted(uint256 indexed proposalId, address to, address token, uint256 amount);
    event AgentActionLogged(uint256 indexed tokenId, string action, uint256 amount, string description);
    event YieldDeposited(uint256 amount, uint256 totalYieldDeposited);
    event RWAAllocated(AssetType indexed assetType, uint256 amount, string assetName);
    event EmergencyPaused(address indexed by);
    event AgentSpendingCapSet(uint256 indexed tokenId, uint256 cap);
    event AutoSpend(address indexed to, uint256 amount, string description, uint256 indexed agentTokenId);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _boardMembers       Initial board member addresses.
    /// @param _requiredSignatures Number of signatures required to execute a proposal.
    constructor(
        address[] memory _boardMembers,
        uint256          _requiredSignatures
    ) Ownable(msg.sender) {
        require(_boardMembers.length >= _requiredSignatures, "Treasury: sigThreshold too high");
        require(_requiredSignatures > 0, "Treasury: zero threshold");

        for (uint256 i = 0; i < _boardMembers.length; i++) {
            require(_boardMembers[i] != address(0), "Treasury: zero board member");
            boardMembers.push(_boardMembers[i]);
        }
        requiredSignatures = _requiredSignatures;
    }

    // -------------------------------------------------------------------------
    // Receive ETH
    // -------------------------------------------------------------------------

    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }

    // -------------------------------------------------------------------------
    // Agent spending caps
    // -------------------------------------------------------------------------

    function setAgentSpendingCap(uint256 tokenId, uint256 cap) external onlyOwner {
        agentSpendingCaps[tokenId] = cap;
        emit AgentSpendingCapSet(tokenId, cap);
    }

    /// @notice Autonomous spend gated by agent cap (below AUTO_SPEND_THRESHOLD skips board approval).
    function autoSpend(
        address        to,
        uint256        amount,
        string calldata description,
        uint256        agentTokenId
    )
        external
        onlyOwner
        nonReentrant
        whenNotPaused
    {
        _sanitizeDescription(description);
        require(to != address(0), "Treasury: zero recipient");
        require(amount > 0,       "Treasury: zero amount");
        require(amount <= AUTO_SPEND_THRESHOLD, "Treasury: exceeds auto-spend threshold");

        _resetAgentMonthIfNeeded(agentTokenId);

        uint256 cap = agentSpendingCaps[agentTokenId];
        require(cap > 0, "Treasury: no spending cap set for agent");
        require(agentSpentThisMonth[agentTokenId] + amount <= cap, "Treasury: agent cap exceeded");

        agentSpentThisMonth[agentTokenId] += amount;

        logAgentAction(agentTokenId, "autoSpend", amount, description);

        (bool ok, ) = to.call{value: amount}("");
        require(ok, "Treasury: ETH auto-spend failed");

        emit AutoSpend(to, amount, description, agentTokenId);
    }

    function _resetAgentMonthIfNeeded(uint256 tokenId) internal {
        if (block.timestamp >= agentSpendingResetTime[tokenId] + MONTH_SECONDS) {
            agentSpentThisMonth[tokenId]    = 0;
            agentSpendingResetTime[tokenId] = block.timestamp;
        }
    }

    // -------------------------------------------------------------------------
    // Board multisig proposals
    // -------------------------------------------------------------------------

    function proposeSpend(
        address        to,
        address        token,
        uint256        amount,
        string calldata description
    )
        external
        returns (uint256 proposalId)
    {
        require(_isBoardMember(msg.sender), "Treasury: not a board member");
        _sanitizeDescription(description);
        require(to != address(0), "Treasury: zero recipient");
        require(amount > 0,       "Treasury: zero amount");

        proposalId = _nextProposalId++;

        proposals[proposalId] = SpendingProposal({
            id:                   proposalId,
            to:                   to,
            token:                token,
            amount:               amount,
            description:          description,
            sigCount:             0,
            executed:             false,
            requiresHumanApproval: amount > AUTO_SPEND_THRESHOLD,
            proposedBy:           msg.sender
        });

        emit SpendingProposed(proposalId, to, token, amount, description);
    }

    function signProposal(uint256 proposalId) external nonReentrant whenNotPaused {
        require(_isBoardMember(msg.sender), "Treasury: not a board member");

        SpendingProposal storage p = _getProposal(proposalId);
        require(!p.executed, "Treasury: already executed");
        require(!proposalSigned[proposalId][msg.sender], "Treasury: already signed");

        proposalSigned[proposalId][msg.sender] = true;
        p.sigCount += 1;

        emit ProposalSigned(proposalId, msg.sender, p.sigCount);

        if (p.sigCount >= requiredSignatures) {
            _executeProposal(p);
        }
    }

    function _executeProposal(SpendingProposal storage p) internal {
        p.executed = true;

        if (p.token == address(0)) {
            (bool ok, ) = p.to.call{value: p.amount}("");
            require(ok, "Treasury: ETH transfer failed");
        } else {
            IERC20(p.token).safeTransfer(p.to, p.amount);
        }

        emit ProposalExecuted(p.id, p.to, p.token, p.amount);
    }

    // -------------------------------------------------------------------------
    // Agent action log
    // -------------------------------------------------------------------------

    function logAgentAction(
        uint256        tokenId,
        string memory  action,
        uint256        amount,
        string memory  description
    ) public onlyOwner {
        agentActionLog.push(AgentAction({
            tokenId:     tokenId,
            action:      action,
            amount:      amount,
            timestamp:   block.timestamp,
            description: description
        }));
        emit AgentActionLogged(tokenId, action, amount, description);
    }

    // -------------------------------------------------------------------------
    // Mock yield (ERC-4626 style)
    // -------------------------------------------------------------------------

    /// @notice Deposit ETH into the mock yield vault (MOCK_YIELD=true).
    function depositToYield(uint256 amount) external onlyOwner nonReentrant whenNotPaused {
        require(amount > 0, "Treasury: zero amount");
        require(address(this).balance >= amount, "Treasury: insufficient balance");
        totalYieldDeposited += amount;
        // In mock mode: no actual transfer to an external vault.
        emit YieldDeposited(amount, totalYieldDeposited);
    }

    // -------------------------------------------------------------------------
    // RWA allocation
    // -------------------------------------------------------------------------

    function allocateToRWA(
        AssetType      assetType,
        uint256        amount,
        string calldata assetName
    )
        external
        onlyOwner
        nonReentrant
        whenNotPaused
    {
        require(amount > 0, "Treasury: zero amount");
        require(bytes(assetName).length > 0, "Treasury: empty asset name");

        uint256 newTotal = totalRWAAllocated + amount;
        uint256 balance  = address(this).balance;
        require(balance > 0, "Treasury: zero balance");

        // Single-asset type may not exceed MAX_SINGLE_BPS of total balance
        uint256 typeTotal = _rwaTypeTotal(assetType) + amount;
        require(
            typeTotal * BPS_DENOMINATOR <= balance * MAX_SINGLE_BPS,
            "Treasury: exceeds 40% single-asset cap"
        );

        rwaPositions.push(RWAPosition({
            assetType: assetType,
            amount:    amount,
            assetName: assetName
        }));
        totalRWAAllocated = newTotal;

        emit RWAAllocated(assetType, amount, assetName);
    }

    function _rwaTypeTotal(AssetType t) internal view returns (uint256 total) {
        for (uint256 i = 0; i < rwaPositions.length; i++) {
            if (rwaPositions[i].assetType == t) total += rwaPositions[i].amount;
        }
    }

    // -------------------------------------------------------------------------
    // Token whitelist
    // -------------------------------------------------------------------------

    function setAcceptedToken(address token, bool accepted) external onlyOwner {
        require(token != address(0), "Treasury: zero address");
        acceptedTokens[token] = accepted;
    }

    // -------------------------------------------------------------------------
    // Emergency controls
    // -------------------------------------------------------------------------

    function emergencyPause() external onlyOwner {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    function unpause() external onlyOwner { _unpause(); }

    // -------------------------------------------------------------------------
    // Description sanitisation
    // -------------------------------------------------------------------------

    function _sanitizeDescription(string calldata desc) internal pure {
        bytes memory b = bytes(desc);
        require(b.length > 0,                       "Treasury: empty description");
        require(b.length <= MAX_DESCRIPTION_BYTES,  "Treasury: description too long");
        for (uint256 i = 0; i < b.length; i++) {
            require(b[i] != 0x00, "Treasury: null byte in description");
        }
    }

    // -------------------------------------------------------------------------
    // Board helpers
    // -------------------------------------------------------------------------

    function _isBoardMember(address addr) internal view returns (bool) {
        for (uint256 i = 0; i < boardMembers.length; i++) {
            if (boardMembers[i] == addr) return true;
        }
        return false;
    }

    function addBoardMember(address member) external onlyOwner {
        require(member != address(0), "Treasury: zero address");
        require(!_isBoardMember(member), "Treasury: already a member");
        boardMembers.push(member);
    }

    function setRequiredSignatures(uint256 sigs) external onlyOwner {
        require(sigs > 0 && sigs <= boardMembers.length, "Treasury: invalid threshold");
        requiredSignatures = sigs;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _getProposal(uint256 id) internal view returns (SpendingProposal storage) {
        require(id > 0 && id < _nextProposalId, "Treasury: proposal does not exist");
        return proposals[id];
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    function getBoardMembers() external view returns (address[] memory) { return boardMembers; }

    function agentActionLogLength() external view returns (uint256) { return agentActionLog.length; }

    function rwaPositionsLength() external view returns (uint256) { return rwaPositions.length; }
}
