// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title Treasury - Multi-sig spending governance for DPI Guardians
/// @notice Small amounts can be auto-spent by the owner alone.
///         Larger amounts require MULTISIG_REQUIRED trustee approvals
///         before execution. Supports both crypto yield and RWA allocations
///         for a diversified, sustainable treasury strategy.
contract Treasury is Ownable, ReentrancyGuard, Pausable {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice Categorical labels for spending proposals.
    enum SpendingCategory {
        OPERATIONAL,
        AUDIT,
        STIPEND,
        INFRASTRUCTURE,
        RESERVE
    }

    /// @notice Asset classes for treasury diversification.
    enum AssetType {
        CRYPTO_YIELD,        // ETH staking, liquid staking tokens
        TOKENIZED_BONDS,     // Tokenized T-bills, corporate bonds (e.g. Ondo, Backed)
        TOKENIZED_RE,        // Tokenized real estate (e.g. RealT, Tangible)
        STABLECOINS,         // USDC, DAI held as liquidity buffer
        OTHER_RWA            // Other real world assets
    }

    /// @notice A tracked RWA or yield allocation.
    struct AssetAllocation {
        uint256    id;
        string     name;           // e.g. "Ondo OUSG", "RealT Detroit Property"
        string     description;
        AssetType  assetType;
        uint256    allocatedWei;   // ETH-equivalent value tracked on-chain
        uint256    targetBps;      // Target allocation in basis points (e.g. 2000 = 20%)
        bool       active;
        uint256    lastUpdated;
    }

    /// @notice A pending multi-sig spending proposal.
    struct SpendingProposal {
        uint256           id;
        address           proposer;
        address payable   recipient;
        uint256           amount;
        string            description;
        SpendingCategory  category;
        address[]         approvals;
        bool              executed;
        uint256           deadline;
        bool              requiresHumanApproval;
    }

    /// @notice An immutable record of a completed spend.
    struct SpendingRecord {
        uint256          amount;
        SpendingCategory category;
        string           description;
        uint256          timestamp;
        address          recipient;
    }

    /// @notice A record of an agent action for auditability.
    struct AgentAction {
        uint256 agentTokenId;
        string  actionType;
        uint256 timestamp;
        string  details;
        address initiator;
    }

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Maximum amount (in wei) that the owner may spend without trustee votes.
    uint256 public constant AUTO_SPEND_THRESHOLD = 0.01 ether;

    /// @notice Number of trustee approvals required to execute a proposal.
    uint256 public constant MULTISIG_REQUIRED = 2;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Ordered list of trustee addresses.
    address[] public trustees;

    /// @notice Quick lookup: is this address a trustee?
    mapping(address => bool) public isTrustee;

    uint256 private _proposalCounter;

    /// @notice All spending proposals keyed by ID.
    mapping(uint256 => SpendingProposal) public proposals;

    /// @dev IDs of all proposals (used for getPendingProposals iteration).
    uint256[] private _proposalIds;

    /// @notice Immutable spending history.
    SpendingRecord[] private _spendingHistory;

    /// @notice Mock crypto yield vault balance (ETH staking / liquid staking).
    uint256 public yieldBalance;

    /// @notice Total ETH-equivalent allocated to RWA positions.
    uint256 public rwaBalance;

    /// @notice All asset allocations (crypto yield + RWA).
    AssetAllocation[] private _allocations;

    /// @dev Target: max 40% in any single asset class (anti-concentration).
    uint256 public constant MAX_SINGLE_ASSET_BPS = 4000;

    /// @notice Cumulative ETH received by this contract.
    uint256 public totalReceived;

    /// @notice Per-agent monthly spending cap in wei, keyed by ERC8004 tokenId.
    mapping(uint256 => uint256) public agentSpendingCaps;

    /// @notice Amount an agent has spent in the current month, keyed by ERC8004 tokenId.
    mapping(uint256 => uint256) public agentSpentThisMonth;

    /// @notice Timestamp when the current monthly window resets, keyed by ERC8004 tokenId.
    mapping(uint256 => uint256) public agentSpendingResetTime;

    /// @notice Log of all agent actions for auditability.
    AgentAction[] public agentActionLog;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event FundsReceived(address indexed sender, uint256 amount);
    event AutoSpend(
        address indexed recipient,
        uint256 amount,
        SpendingCategory category,
        string description
    );
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        address indexed recipient,
        uint256 amount,
        SpendingCategory category
    );
    event ProposalApproved(uint256 indexed proposalId, address indexed trustee);
    event ProposalExecuted(uint256 indexed proposalId, address indexed recipient, uint256 amount);
    event YieldDeposit(uint256 amount, uint256 newYieldBalance);
    event YieldWithdraw(uint256 amount, uint256 newYieldBalance);
    event RWAAllocated(uint256 indexed allocationId, string name, AssetType assetType, uint256 amount);
    event RWAWithdrawn(uint256 indexed allocationId, uint256 amount);
    event RWAAllocationUpdated(uint256 indexed allocationId, uint256 newAmount);
    event TrusteeAdded(address indexed trustee);
    event TrusteeRemoved(address indexed trustee);
    event AgentSpendingCapSet(uint256 indexed agentTokenId, uint256 cap);
    event AgentActionLogged(uint256 indexed agentTokenId, string actionType, uint256 timestamp);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotTrustee(address caller);
    error AlreadyTrustee(address addr);
    error NotATrustee(address addr);
    error AlreadyApproved(uint256 proposalId, address trustee);
    error ProposalNotFound(uint256 proposalId);
    error ProposalAlreadyExecuted(uint256 proposalId);
    error ProposalExpired(uint256 proposalId);
    error InsufficientApprovals(uint256 proposalId, uint256 given, uint256 required);
    error InsufficientBalance(uint256 requested, uint256 available);
    error AmountExceedsAutoThreshold(uint256 amount, uint256 threshold);
    error ZeroAddress();
    error ZeroAmount();
    error TransferFailed(address to, uint256 amount);
    error InsufficientYieldBalance(uint256 requested, uint256 available);
    error ConcentrationLimitExceeded(uint256 allocationBps, uint256 maxBps);
    error AllocationNotFound(uint256 allocationId);
    error AllocationInactive(uint256 allocationId);
    error AgentSpendingCapExceeded(uint256 agentTokenId, uint256 requested, uint256 remaining);
    error HumanApprovalRequired(uint256 proposalId);
    error DescriptionTooLong();
    error InvalidCharacter();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param initialOwner  Address that becomes the contract owner.
    constructor(address initialOwner) Ownable(initialOwner) {
        _proposalCounter = 1;
    }

    // -------------------------------------------------------------------------
    // Receive
    // -------------------------------------------------------------------------

    /// @notice Accept plain ETH transfers and record them.
    receive() external payable {
        totalReceived += msg.value;
        emit FundsReceived(msg.sender, msg.value);
    }

    // -------------------------------------------------------------------------
    // External – Emergency pause (owner only)
    // -------------------------------------------------------------------------

    /// @notice Pause all critical operations in an emergency.
    function emergencyPause() external onlyOwner {
        _pause();
    }

    /// @notice Resume operations after an emergency pause.
    function unpause() external onlyOwner {
        _unpause();
    }

    // -------------------------------------------------------------------------
    // External – Trustee management (owner only)
    // -------------------------------------------------------------------------

    /// @notice Add a new trustee who may approve spending proposals.
    function addTrustee(address trustee) external onlyOwner {
        if (trustee == address(0)) revert ZeroAddress();
        if (isTrustee[trustee])    revert AlreadyTrustee(trustee);

        isTrustee[trustee] = true;
        trustees.push(trustee);

        emit TrusteeAdded(trustee);
    }

    /// @notice Remove an existing trustee.
    function removeTrustee(address trustee) external onlyOwner {
        if (!isTrustee[trustee]) revert NotATrustee(trustee);

        isTrustee[trustee] = false;

        // Swap-and-pop to remove from the array
        uint256 len = trustees.length;
        for (uint256 i = 0; i < len; i++) {
            if (trustees[i] == trustee) {
                trustees[i] = trustees[len - 1];
                trustees.pop();
                break;
            }
        }

        emit TrusteeRemoved(trustee);
    }

    // -------------------------------------------------------------------------
    // External – Agent spending caps (owner only)
    // -------------------------------------------------------------------------

    /// @notice Set a monthly spending cap for an agent identified by ERC8004 tokenId.
    /// @param agentTokenId  The ERC8004 token ID of the agent.
    /// @param cap           Maximum wei the agent may spend per calendar month.
    function setAgentSpendingCap(uint256 agentTokenId, uint256 cap) external onlyOwner {
        agentSpendingCaps[agentTokenId] = cap;
        emit AgentSpendingCapSet(agentTokenId, cap);
    }

    // -------------------------------------------------------------------------
    // External – Agent action log (owner only)
    // -------------------------------------------------------------------------

    /// @notice Record an agent action for auditability.
    /// @param agentTokenId  The ERC8004 token ID of the acting agent.
    /// @param actionType    Short label for the action (e.g. "AUTO_SPEND").
    /// @param details       Free-text details of the action.
    function logAgentAction(
        uint256 agentTokenId,
        string calldata actionType,
        string calldata details
    ) external onlyOwner {
        if (!_sanitizeDescription(details)) revert DescriptionTooLong();

        agentActionLog.push(AgentAction({
            agentTokenId: agentTokenId,
            actionType:   actionType,
            timestamp:    block.timestamp,
            details:      details,
            initiator:    msg.sender
        }));

        emit AgentActionLogged(agentTokenId, actionType, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // External – Spending (owner only)
    // -------------------------------------------------------------------------

    /// @notice Immediately send up to AUTO_SPEND_THRESHOLD ETH without a vote.
    /// @param recipient    Address to send ETH to.
    /// @param amount       Amount in wei (must be <= AUTO_SPEND_THRESHOLD).
    /// @param description  Free-text reason.
    /// @param category     Spending category.
    /// @param agentTokenId ERC8004 token ID of the agent initiating the spend.
    function autoSpend(
        address payable recipient,
        uint256 amount,
        string calldata description,
        SpendingCategory category,
        uint256 agentTokenId
    )
        external
        onlyOwner
        nonReentrant
        whenNotPaused
    {
        if (!_sanitizeDescription(description)) revert DescriptionTooLong();
        if (amount == 0)                        revert ZeroAmount();
        if (recipient == address(0))            revert ZeroAddress();
        if (amount > AUTO_SPEND_THRESHOLD)      revert AmountExceedsAutoThreshold(amount, AUTO_SPEND_THRESHOLD);

        uint256 available = address(this).balance - yieldBalance;
        if (amount > available)                 revert InsufficientBalance(amount, available);

        // Enforce per-agent monthly spending cap
        uint256 cap = agentSpendingCaps[agentTokenId];
        if (cap > 0) {
            // Reset monthly window if needed
            if (block.timestamp >= agentSpendingResetTime[agentTokenId]) {
                agentSpentThisMonth[agentTokenId] = 0;
                agentSpendingResetTime[agentTokenId] = block.timestamp + 30 days;
            }
            uint256 spent = agentSpentThisMonth[agentTokenId];
            if (spent + amount > cap) {
                revert AgentSpendingCapExceeded(agentTokenId, amount, cap - spent);
            }
            agentSpentThisMonth[agentTokenId] = spent + amount;
        }

        _spendingHistory.push(SpendingRecord({
            amount:      amount,
            category:    category,
            description: description,
            timestamp:   block.timestamp,
            recipient:   recipient
        }));

        emit AutoSpend(recipient, amount, category, description);
        _sendEth(recipient, amount);
    }

    /// @notice Create a multi-sig spending proposal (requires MULTISIG_REQUIRED trustee approvals).
    /// @param recipient             Address to receive ETH if approved.
    /// @param amount                Amount in wei.
    /// @param description           Free-text reason.
    /// @param category              Spending category.
    /// @param deadline              Unix timestamp after which the proposal may not be executed.
    /// @param requiresHumanApproval If true, execution requires both a trustee and the owner to approve.
    /// @return proposalId           The newly created proposal ID.
    function proposeSpend(
        address payable recipient,
        uint256 amount,
        string calldata description,
        SpendingCategory category,
        uint256 deadline,
        bool requiresHumanApproval
    )
        external
        onlyOwner
        returns (uint256 proposalId)
    {
        if (!_sanitizeDescription(description)) revert DescriptionTooLong();
        if (amount == 0)             revert ZeroAmount();
        if (recipient == address(0)) revert ZeroAddress();

        proposalId = _proposalCounter;
        unchecked { _proposalCounter++; }

        SpendingProposal storage p = proposals[proposalId];
        p.id                   = proposalId;
        p.proposer             = msg.sender;
        p.recipient            = recipient;
        p.amount               = amount;
        p.description          = description;
        p.category             = category;
        p.executed             = false;
        p.deadline             = deadline;
        p.requiresHumanApproval = requiresHumanApproval;
        // p.approvals is an empty dynamic array by default

        _proposalIds.push(proposalId);

        emit ProposalCreated(proposalId, msg.sender, recipient, amount, category);
    }

    // -------------------------------------------------------------------------
    // External – Proposal approval (trustees)
    // -------------------------------------------------------------------------

    /// @notice Approve a pending spending proposal.
    /// @dev    Each trustee may approve a proposal at most once.
    function approveProposal(uint256 proposalId) external {
        if (!isTrustee[msg.sender]) revert NotTrustee(msg.sender);

        SpendingProposal storage p = _requireProposal(proposalId);
        if (p.executed) revert ProposalAlreadyExecuted(proposalId);
        if (p.deadline != 0 && block.timestamp > p.deadline) revert ProposalExpired(proposalId);

        // Check for double-voting
        uint256 len = p.approvals.length;
        for (uint256 i = 0; i < len; i++) {
            if (p.approvals[i] == msg.sender) revert AlreadyApproved(proposalId, msg.sender);
        }

        p.approvals.push(msg.sender);
        emit ProposalApproved(proposalId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // External – Proposal execution
    // -------------------------------------------------------------------------

    /// @notice Execute an approved proposal, transferring ETH to the recipient.
    /// @dev    Requires at least MULTISIG_REQUIRED trustee approvals.
    ///         If requiresHumanApproval is set, at least one approval must come
    ///         from a trustee AND one from the owner.
    function executeProposal(uint256 proposalId)
        external
        nonReentrant
        whenNotPaused
    {
        SpendingProposal storage p = _requireProposal(proposalId);
        if (p.executed) revert ProposalAlreadyExecuted(proposalId);
        if (p.deadline != 0 && block.timestamp > p.deadline) revert ProposalExpired(proposalId);

        uint256 approvalCount = p.approvals.length;
        if (approvalCount < MULTISIG_REQUIRED) {
            revert InsufficientApprovals(proposalId, approvalCount, MULTISIG_REQUIRED);
        }

        // Human-override check: requires at least one trustee approval AND the owner's approval
        if (p.requiresHumanApproval) {
            bool hasTrusteeApproval = false;
            bool hasOwnerApproval   = false;
            address ownerAddr = owner();
            for (uint256 i = 0; i < approvalCount; i++) {
                address approver = p.approvals[i];
                if (isTrustee[approver]) hasTrusteeApproval = true;
                if (approver == ownerAddr) hasOwnerApproval = true;
            }
            if (!hasTrusteeApproval || !hasOwnerApproval) {
                revert HumanApprovalRequired(proposalId);
            }
        }

        uint256 available = address(this).balance - yieldBalance;
        if (p.amount > available) revert InsufficientBalance(p.amount, available);

        p.executed = true;

        _spendingHistory.push(SpendingRecord({
            amount:      p.amount,
            category:    p.category,
            description: p.description,
            timestamp:   block.timestamp,
            recipient:   p.recipient
        }));

        emit ProposalExecuted(proposalId, p.recipient, p.amount);
        _sendEth(p.recipient, p.amount);
    }

    // -------------------------------------------------------------------------
    // External – Yield vault (mock, owner only)
    // -------------------------------------------------------------------------

    /// @notice Move ETH from the liquid balance into the mock yield vault.
    /// @dev    The ETH stays in this contract but is tracked as "yielding".
    function depositToYield(uint256 amount) external onlyOwner nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        uint256 liquid = address(this).balance - yieldBalance;
        if (amount > liquid) revert InsufficientBalance(amount, liquid);

        yieldBalance += amount;
        emit YieldDeposit(amount, yieldBalance);
    }

    /// @notice Withdraw ETH from the mock yield vault back to the liquid balance.
    function withdrawFromYield(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0)           revert ZeroAmount();
        if (amount > yieldBalance) revert InsufficientYieldBalance(amount, yieldBalance);

        yieldBalance -= amount;
        emit YieldWithdraw(amount, yieldBalance);
    }

    // -------------------------------------------------------------------------
    // External – RWA diversification (owner + multisig for large amounts)
    // -------------------------------------------------------------------------

    /// @notice Record a new RWA allocation (tokenized bonds, real estate, etc.).
    /// @dev    ETH is tracked as allocated; in production this would bridge to
    ///         an RWA protocol. For the hackathon demo this is mock accounting.
    /// @param name         Human-readable name (e.g. "Ondo OUSG T-bill fund").
    /// @param description  Description of the asset.
    /// @param assetType    Asset class enum.
    /// @param amount       ETH-equivalent amount to allocate.
    /// @param targetBps    Target portfolio weight in basis points.
    function allocateToRWA(
        string calldata name,
        string calldata description,
        AssetType assetType,
        uint256 amount,
        uint256 targetBps
    ) external onlyOwner nonReentrant whenNotPaused returns (uint256 allocationId) {
        if (amount == 0)                           revert ZeroAmount();
        if (targetBps > MAX_SINGLE_ASSET_BPS)      revert ConcentrationLimitExceeded(targetBps, MAX_SINGLE_ASSET_BPS);

        uint256 liquid = address(this).balance - yieldBalance - rwaBalance;
        if (amount > liquid)                       revert InsufficientBalance(amount, liquid);

        allocationId = _allocations.length;
        _allocations.push(AssetAllocation({
            id:           allocationId,
            name:         name,
            description:  description,
            assetType:    assetType,
            allocatedWei: amount,
            targetBps:    targetBps,
            active:       true,
            lastUpdated:  block.timestamp
        }));

        rwaBalance += amount;
        emit RWAAllocated(allocationId, name, assetType, amount);
    }

    /// @notice Update the recorded value of an RWA allocation (mark-to-market).
    /// @param allocationId  The allocation to update.
    /// @param newAmount     New ETH-equivalent value.
    function updateRWAValue(uint256 allocationId, uint256 newAmount)
        external
        onlyOwner
    {
        if (allocationId >= _allocations.length) revert AllocationNotFound(allocationId);
        AssetAllocation storage a = _allocations[allocationId];
        if (!a.active) revert AllocationInactive(allocationId);

        rwaBalance = rwaBalance - a.allocatedWei + newAmount;
        a.allocatedWei = newAmount;
        a.lastUpdated  = block.timestamp;

        emit RWAAllocationUpdated(allocationId, newAmount);
    }

    /// @notice Withdraw (liquidate) an RWA allocation back to liquid balance.
    /// @param allocationId  The allocation to close.
    function withdrawFromRWA(uint256 allocationId)
        external
        onlyOwner
        nonReentrant
    {
        if (allocationId >= _allocations.length) revert AllocationNotFound(allocationId);
        AssetAllocation storage a = _allocations[allocationId];
        if (!a.active) revert AllocationInactive(allocationId);

        uint256 amount = a.allocatedWei;
        rwaBalance    -= amount;
        a.allocatedWei = 0;
        a.active       = false;
        a.lastUpdated  = block.timestamp;

        emit RWAWithdrawn(allocationId, amount);
    }

    /// @notice Returns all asset allocations (active and inactive).
    function getAllocations() external view returns (AssetAllocation[] memory) {
        return _allocations;
    }

    /// @notice Returns only active RWA allocations.
    function getActiveAllocations() external view returns (AssetAllocation[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < _allocations.length; i++) {
            if (_allocations[i].active) count++;
        }
        AssetAllocation[] memory active = new AssetAllocation[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < _allocations.length; i++) {
            if (_allocations[i].active) active[idx++] = _allocations[i];
        }
        return active;
    }

    /// @notice Returns the liquid ETH balance (excludes yield vault and RWA allocations).
    function getLiquidBalance() external view returns (uint256) {
        return address(this).balance - yieldBalance - rwaBalance;
    }

    // -------------------------------------------------------------------------
    // External – Views
    // -------------------------------------------------------------------------

    /// @notice Returns the liquid ETH balance (excludes yield vault and RWA allocations).
    function getBalance() external view returns (uint256) {
        return address(this).balance - yieldBalance - rwaBalance;
    }

    /// @notice Returns the full spending history.
    function getSpendingHistory() external view returns (SpendingRecord[] memory) {
        return _spendingHistory;
    }

    /// @notice Returns all proposals that have not yet been executed.
    function getPendingProposals() external view returns (SpendingProposal[] memory) {
        uint256 total   = _proposalIds.length;
        uint256 pending = 0;

        // Count pending
        for (uint256 i = 0; i < total; i++) {
            if (!proposals[_proposalIds[i]].executed) pending++;
        }

        SpendingProposal[] memory result = new SpendingProposal[](pending);
        uint256 idx = 0;
        for (uint256 i = 0; i < total; i++) {
            SpendingProposal storage p = proposals[_proposalIds[i]];
            if (!p.executed) {
                result[idx] = p;
                idx++;
            }
        }
        return result;
    }

    /// @notice Returns the current trustees array.
    function getTrustees() external view returns (address[] memory) {
        return trustees;
    }

    /// @notice Returns the full agent action log.
    function getAgentActionLog() external view returns (AgentAction[] memory) {
        return agentActionLog;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _requireProposal(uint256 proposalId)
        internal
        view
        returns (SpendingProposal storage p)
    {
        p = proposals[proposalId];
        // A proposal is considered found if its ID field is set
        if (p.id == 0 && proposalId != 0) revert ProposalNotFound(proposalId);
        if (p.id != proposalId)           revert ProposalNotFound(proposalId);
    }

    function _sendEth(address payable to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed(to, amount);
    }

    /// @notice Validate a free-text description against injection and length limits.
    /// @dev    Returns true if valid; reverts with a specific error if invalid.
    ///         Rejects descriptions longer than 500 bytes or containing null bytes (0x00).
    function _sanitizeDescription(string calldata desc) internal pure returns (bool valid) {
        bytes calldata b = bytes(desc);
        if (b.length > 500) revert DescriptionTooLong();
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == 0x00) revert InvalidCharacter();
        }
        return true;
    }
}
