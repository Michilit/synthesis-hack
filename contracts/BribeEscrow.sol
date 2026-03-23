// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title BribeEscrow
/// @notice Full state-machine escrow: Deposited → Broadcast → Assigned → Delivered → Reviewed → Released (to Treasury).
///         Includes 2-of-3 arbitration, mock 5 % APY yield, and prompt-injection description sanitisation.
///
/// MOCK_YIELD = true – yield is computed as (principal * 5 * secondsHeld) / (100 * 365 days).
contract BribeEscrow is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Enums
    // -------------------------------------------------------------------------

    enum EscrowStatus {
        Deposited,   // 0
        Broadcast,   // 1
        Assigned,    // 2
        Delivered,   // 3
        Reviewed,    // 4
        Released,    // 5
        Disputed,    // 6
        Refunded     // 7
    }

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct Escrow {
        uint256       id;
        address       depositor;
        address       token;          // address(0) = ETH
        uint256       amount;
        uint256       yieldAccrued;   // set on release
        string        description;    // sanitised on deposit
        EscrowStatus  status;
        address       assignedContributor;
        bool          selfIdVerified;
        uint256       deliveryDeadline;
        uint256       createdAt;
        uint256       deliveredAt;
    }

    // Dispute vote record per escrow
    struct DisputeVote {
        uint8 votesRelease;  // votes for "release to treasury"
        uint8 votesRefund;   // votes for "refund to depositor"
        mapping(address => bool) hasVoted;
    }

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    uint256 public constant MOCK_APY_BPS         = 500;    // 5 %
    uint256 public constant SECONDS_PER_YEAR     = 365 days;
    uint256 public constant MAX_DESCRIPTION_BYTES = 500;
    uint256 public constant MIN_BRIBE_DEFAULT    = 1 ether;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address public immutable treasury;

    uint256 public minimumBribe;

    uint256 private _nextEscrowId = 1;

    mapping(uint256 => Escrow) public escrows;

    // 2-of-3 arbitrators
    address[3] public arbitrators;

    mapping(uint256 => DisputeVote) private _disputeVotes;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event EscrowDeposited(
        uint256 indexed escrowId,
        address indexed depositor,
        address token,
        uint256 amount,
        string  description
    );
    event TaskBroadcast(uint256 indexed escrowId);
    event ContributorAssigned(
        uint256 indexed escrowId,
        address indexed contributor,
        bool selfIdVerified
    );
    event TaskDelivered(uint256 indexed escrowId, address indexed contributor, uint256 deliveredAt);
    event FundsReleasedToTreasury(
        uint256 indexed escrowId,
        address indexed treasury,
        uint256 principal,
        uint256 yieldAccrued
    );
    event DisputeRaised(uint256 indexed escrowId, address indexed raisedBy);
    event ArbitratorVoted(
        uint256 indexed escrowId,
        address indexed arbitrator,
        bool    releaseToTreasury
    );
    event DisputeResolved(
        uint256 indexed escrowId,
        bool    releasedToTreasury
    );

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _treasury     Address that receives released funds.
    /// @param _minimumBribe Minimum bribe amount (use MIN_BRIBE_DEFAULT = 1 ETH in prod).
    /// @param arb0          First arbitrator address.
    /// @param arb1          Second arbitrator address.
    /// @param arb2          Third arbitrator address.
    constructor(
        address _treasury,
        uint256 _minimumBribe,
        address arb0,
        address arb1,
        address arb2
    ) Ownable(msg.sender) {
        require(_treasury != address(0), "BribeEscrow: zero treasury");
        require(arb0 != address(0) && arb1 != address(0) && arb2 != address(0), "BribeEscrow: zero arbitrator");

        treasury     = _treasury;
        minimumBribe = _minimumBribe == 0 ? MIN_BRIBE_DEFAULT : _minimumBribe;

        arbitrators[0] = arb0;
        arbitrators[1] = arb1;
        arbitrators[2] = arb2;
    }

    // -------------------------------------------------------------------------
    // Deposit
    // -------------------------------------------------------------------------

    /// @notice Deposit ETH or ERC-20 into escrow.
    /// @param token        Token address (address(0) for ETH).
    /// @param amount       Amount (ignored for ETH; use msg.value).
    /// @param description  Task description (sanitised).
    /// @param deadlineDays Number of days until delivery deadline.
    function deposit(
        address        token,
        uint256        amount,
        string calldata description,
        uint256        deadlineDays
    )
        external
        payable
        nonReentrant
        whenNotPaused
    {
        _validateDescription(description);

        uint256 actualAmount;
        if (token == address(0)) {
            require(msg.value >= minimumBribe, "BribeEscrow: below minimumBribe");
            actualAmount = msg.value;
        } else {
            require(amount >= minimumBribe, "BribeEscrow: below minimumBribe");
            require(msg.value == 0, "BribeEscrow: ETH sent with token deposit");
            actualAmount = amount;
        }

        uint256 id = _nextEscrowId++;

        Escrow storage e = escrows[id];
        e.id                   = id;
        e.depositor            = msg.sender;
        e.token                = token;
        e.amount               = actualAmount;
        e.description          = description;
        e.status               = EscrowStatus.Deposited;
        e.deliveryDeadline     = block.timestamp + (deadlineDays * 1 days);
        e.createdAt            = block.timestamp;

        if (token != address(0)) {
            IERC20(token).safeTransferFrom(msg.sender, address(this), actualAmount);
        }

        emit EscrowDeposited(id, msg.sender, token, actualAmount, description);
    }

    // -------------------------------------------------------------------------
    // State transitions (owner-gated)
    // -------------------------------------------------------------------------

    function broadcastTask(uint256 escrowId) external onlyOwner {
        Escrow storage e = _getEscrow(escrowId);
        require(e.status == EscrowStatus.Deposited, "BribeEscrow: not Deposited");
        e.status = EscrowStatus.Broadcast;
        emit TaskBroadcast(escrowId);
    }

    function assignContributor(
        uint256 escrowId,
        address contributor,
        bool    selfIdVerified
    ) external onlyOwner {
        require(contributor != address(0), "BribeEscrow: zero contributor");
        Escrow storage e = _getEscrow(escrowId);
        require(e.status == EscrowStatus.Broadcast, "BribeEscrow: not Broadcast");
        e.status               = EscrowStatus.Assigned;
        e.assignedContributor  = contributor;
        e.selfIdVerified       = selfIdVerified;
        emit ContributorAssigned(escrowId, contributor, selfIdVerified);
    }

    // -------------------------------------------------------------------------
    // Contributor delivery
    // -------------------------------------------------------------------------

    function markDelivered(uint256 escrowId) external {
        Escrow storage e = _getEscrow(escrowId);
        require(e.status == EscrowStatus.Assigned, "BribeEscrow: not Assigned");
        require(msg.sender == e.assignedContributor, "BribeEscrow: not contributor");
        e.status      = EscrowStatus.Delivered;
        e.deliveredAt = block.timestamp;
        emit TaskDelivered(escrowId, msg.sender, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // Review & release (funds go to TREASURY)
    // -------------------------------------------------------------------------

    function reviewAndRelease(uint256 escrowId) external onlyOwner nonReentrant whenNotPaused {
        Escrow storage e = _getEscrow(escrowId);
        require(e.status == EscrowStatus.Delivered, "BribeEscrow: not Delivered");
        e.status = EscrowStatus.Reviewed;
        _releaseFundsToTreasury(e);
    }

    // -------------------------------------------------------------------------
    // Dispute & arbitration
    // -------------------------------------------------------------------------

    /// @notice Raise a dispute (owner only to prevent spam).
    function raiseDispute(uint256 escrowId) external onlyOwner {
        Escrow storage e = _getEscrow(escrowId);
        require(
            e.status == EscrowStatus.Assigned ||
            e.status == EscrowStatus.Delivered ||
            e.status == EscrowStatus.Reviewed,
            "BribeEscrow: cannot dispute at this stage"
        );
        e.status = EscrowStatus.Disputed;
        emit DisputeRaised(escrowId, msg.sender);
    }

    /// @notice Arbitrator casts a vote on a disputed escrow.
    /// @param escrowId          The escrow under dispute.
    /// @param releaseToTreasury True = send funds to treasury; false = refund depositor.
    function voteOnDispute(uint256 escrowId, bool releaseToTreasury) external nonReentrant whenNotPaused {
        Escrow storage e = _getEscrow(escrowId);
        require(e.status == EscrowStatus.Disputed, "BribeEscrow: not Disputed");

        bool isArbitrator = false;
        for (uint256 i = 0; i < 3; i++) {
            if (arbitrators[i] == msg.sender) { isArbitrator = true; break; }
        }
        require(isArbitrator, "BribeEscrow: not arbitrator");

        DisputeVote storage dv = _disputeVotes[escrowId];
        require(!dv.hasVoted[msg.sender], "BribeEscrow: already voted");

        dv.hasVoted[msg.sender] = true;

        if (releaseToTreasury) {
            dv.votesRelease += 1;
        } else {
            dv.votesRefund  += 1;
        }

        emit ArbitratorVoted(escrowId, msg.sender, releaseToTreasury);

        // Execute on first reaching 2 matching votes (2-of-3)
        if (dv.votesRelease >= 2) {
            e.status = EscrowStatus.Reviewed;
            _releaseFundsToTreasury(e);
            emit DisputeResolved(escrowId, true);
        } else if (dv.votesRefund >= 2) {
            e.status = EscrowStatus.Refunded;
            _refundDepositor(e);
            emit DisputeResolved(escrowId, false);
        }
    }

    // -------------------------------------------------------------------------
    // Internal – fund movement
    // -------------------------------------------------------------------------

    function _releaseFundsToTreasury(Escrow storage e) internal {
        uint256 principal = e.amount;
        uint256 yield     = _calcMockYield(principal, e.createdAt);
        e.yieldAccrued    = yield;
        uint256 total     = principal + yield;
        e.status          = EscrowStatus.Released;

        if (e.token == address(0)) {
            // Principal was held in contract; send to treasury
            (bool ok, ) = treasury.call{value: total > address(this).balance ? address(this).balance : total}("");
            require(ok, "BribeEscrow: ETH release failed");
        } else {
            // ERC-20 principal; yield is conceptual in mock mode
            IERC20(e.token).safeTransfer(treasury, principal);
        }

        emit FundsReleasedToTreasury(e.id, treasury, principal, yield);
    }

    function _refundDepositor(Escrow storage e) internal {
        uint256 principal = e.amount;
        if (e.token == address(0)) {
            (bool ok, ) = e.depositor.call{value: principal}("");
            require(ok, "BribeEscrow: ETH refund failed");
        } else {
            IERC20(e.token).safeTransfer(e.depositor, principal);
        }
    }

    // -------------------------------------------------------------------------
    // Mock yield (MOCK_YIELD = true)
    // -------------------------------------------------------------------------

    /// @notice 5 % APY simple yield since deposit.
    function _calcMockYield(uint256 principal, uint256 depositedAt) internal view returns (uint256) {
        uint256 elapsed = block.timestamp > depositedAt ? block.timestamp - depositedAt : 0;
        return (principal * MOCK_APY_BPS * elapsed) / (10_000 * SECONDS_PER_YEAR);
    }

    // -------------------------------------------------------------------------
    // Description sanitisation
    // -------------------------------------------------------------------------

    /// @dev Rejects descriptions longer than MAX_DESCRIPTION_BYTES or containing null bytes.
    function _validateDescription(string calldata desc) internal pure {
        bytes memory b = bytes(desc);
        require(b.length > 0,                          "BribeEscrow: empty description");
        require(b.length <= MAX_DESCRIPTION_BYTES,     "BribeEscrow: description too long");
        for (uint256 i = 0; i < b.length; i++) {
            require(b[i] != 0x00, "BribeEscrow: null byte in description");
        }
    }

    // -------------------------------------------------------------------------
    // Owner administration
    // -------------------------------------------------------------------------

    function setMinimumBribe(uint256 amount) external onlyOwner {
        require(amount > 0, "BribeEscrow: zero minimum");
        minimumBribe = amount;
    }

    function updateArbitrator(uint8 index, address newArbitrator) external onlyOwner {
        require(index < 3, "BribeEscrow: invalid index");
        require(newArbitrator != address(0), "BribeEscrow: zero address");
        arbitrators[index] = newArbitrator;
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _getEscrow(uint256 id) internal view returns (Escrow storage) {
        require(id > 0 && id < _nextEscrowId, "BribeEscrow: escrow does not exist");
        return escrows[id];
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    function getEscrow(uint256 id) external view returns (
        uint256 escrowId,
        address depositor,
        address token,
        uint256 amount,
        uint256 yieldAccrued,
        EscrowStatus status,
        address assignedContributor,
        bool    selfIdVerified,
        uint256 deliveryDeadline,
        uint256 createdAt,
        uint256 deliveredAt,
        string  memory description
    ) {
        Escrow storage e = _getEscrow(id);
        return (
            e.id,
            e.depositor,
            e.token,
            e.amount,
            e.yieldAccrued,
            e.status,
            e.assignedContributor,
            e.selfIdVerified,
            e.deliveryDeadline,
            e.createdAt,
            e.deliveredAt,
            e.description
        );
    }

    function totalEscrows() external view returns (uint256) { return _nextEscrowId - 1; }

    function estimatedYield(uint256 escrowId) external view returns (uint256) {
        Escrow storage e = _getEscrow(escrowId);
        return _calcMockYield(e.amount, e.createdAt);
    }

    // -------------------------------------------------------------------------
    // Receive
    // -------------------------------------------------------------------------

    receive() external payable {}
}
