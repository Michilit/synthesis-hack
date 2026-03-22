// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BribeEscrow - Feature-request escrow with contributor assignment
/// @notice Depositors lock ETH to fund a feature request. The owner (agent)
///         assigns a contributor, who marks delivery. The owner reviews and
///         releases funds to the Treasury. Contributors are rewarded with
///         on-chain reputation and badges — not direct payment. This preserves
///         the open-source ethos: prestige is the primary motivator.
///         A mock yield accrues at ~5% APY while funds sit in escrow.
contract BribeEscrow is Ownable, ReentrancyGuard {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice Lifecycle states for an escrow entry.
    enum EscrowState {
        Deposited,  // 0 – funds locked, awaiting contributor assignment
        Assigned,   // 1 – contributor assigned, awaiting delivery
        Delivered,  // 2 – contributor marked delivery complete
        Reviewed,   // 3 – owner reviewed (intermediate, used during re-assign flows)
        Released,   // 4 – funds released to contributor
        Refunded,   // 5 – funds returned to briber
        Disputed    // 6 – briber disputed delivery, awaiting arbitrator
    }

    /// @notice A single escrow record.
    struct Escrow {
        uint256      id;
        address      briber;
        address      assignedContributor;
        uint256      amount;
        string       featureDescription;
        uint256      minimumBribe;
        uint256      deadline;
        EscrowState  state;
        address      arbitrator;
        uint256      yieldAccrued;
        uint256      depositTime;
    }

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Approximate 5% APY expressed as wei-of-yield per wei-of-principal
    ///         per second.  5e16 / (365.25 * 24 * 3600) ≈ 1.585489599e-9.
    uint256 public constant YIELD_RATE_PER_SECOND = 158548959918; // scaled by 1e18

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice The libp2p Treasury address. All released escrow funds flow here.
    address payable public treasury;

    /// @notice Minimum ETH deposit required to create an escrow.
    uint256 public minimumBribe;

    /// @dev Auto-incrementing escrow ID counter. First escrow ID is 1.
    uint256 private _escrowCounter;

    /// @notice All escrows keyed by ID.
    mapping(uint256 => Escrow) public escrows;

    /// @notice Address authorised to resolve disputes.
    address public arbitrator;

    /// @dev Ordered list of active (non-terminal) escrow IDs.
    uint256[] private _activeEscrowIds;
    mapping(uint256 => uint256) private _activeIndex; // escrowId => index in _activeEscrowIds

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed briber,
        uint256 amount,
        string  featureDescription,
        uint256 deadline
    );
    event ContributorAssigned(uint256 indexed escrowId, address indexed contributor);
    event DeliveryMarked(uint256 indexed escrowId, address indexed contributor);
    /// @dev Funds always flow to Treasury, contributor is credited for reputation only.
    event EscrowReleased(uint256 indexed escrowId, address indexed treasury, uint256 amount, address indexed contributor);
    event EscrowRefunded(uint256 indexed escrowId, address indexed briber, uint256 amount);
    event DisputeRaised(uint256 indexed escrowId, address indexed briber);
    event DisputeResolved(uint256 indexed escrowId, bool releasedToTreasury);
    event StateChanged(uint256 indexed escrowId, EscrowState oldState, EscrowState newState);
    event MinimumBribeUpdated(uint256 newMinimum);
    event ArbitratorUpdated(address indexed newArbitrator);
    event TreasuryUpdated(address indexed newTreasury);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error BelowMinimumBribe(uint256 sent, uint256 minimum);
    error EscrowNotFound(uint256 escrowId);
    error InvalidStateTransition(uint256 escrowId, EscrowState current, EscrowState required);
    error NotAssignedContributor(uint256 escrowId, address caller);
    error NotBriber(uint256 escrowId, address caller);
    error NotArbitrator(address caller);
    error TransferFailed(address to, uint256 amount);
    error ZeroAddress();
    error DeadlinePassed(uint256 escrowId);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param initialOwner    Contract owner (acts as agent/admin).
    /// @param _treasury       Treasury address — all released funds flow here.
    /// @param _minimumBribe   Initial minimum bribe in wei.
    /// @param _arbitrator     Initial arbitrator address.
    constructor(
        address initialOwner,
        address payable _treasury,
        uint256 _minimumBribe,
        address _arbitrator
    ) Ownable(initialOwner) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury     = _treasury;
        minimumBribe = _minimumBribe;
        arbitrator   = _arbitrator;
        _escrowCounter = 1;
    }

    /// @notice Update the treasury address.
    function setTreasury(address payable _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    // -------------------------------------------------------------------------
    // External – Depositor
    // -------------------------------------------------------------------------

    /// @notice Create a new escrow by depositing ETH for a feature request.
    /// @param featureDescription  Human-readable description of the requested feature.
    /// @param deadline            Unix timestamp by which delivery is expected.
    /// @return escrowId           The ID of the newly created escrow.
    function createEscrow(string calldata featureDescription, uint256 deadline)
        external
        payable
        nonReentrant
        returns (uint256 escrowId)
    {
        if (msg.value < minimumBribe) {
            revert BelowMinimumBribe(msg.value, minimumBribe);
        }

        escrowId = _escrowCounter;
        unchecked { _escrowCounter++; }

        escrows[escrowId] = Escrow({
            id:                  escrowId,
            briber:              msg.sender,
            assignedContributor: address(0),
            amount:              msg.value,
            featureDescription:  featureDescription,
            minimumBribe:        minimumBribe,
            deadline:            deadline,
            state:               EscrowState.Deposited,
            arbitrator:          arbitrator,
            yieldAccrued:        0,
            depositTime:         block.timestamp
        });

        _activeEscrowIds.push(escrowId);
        _activeIndex[escrowId] = _activeEscrowIds.length - 1;

        emit EscrowCreated(escrowId, msg.sender, msg.value, featureDescription, deadline);
        emit StateChanged(escrowId, EscrowState.Deposited, EscrowState.Deposited);
    }

    // -------------------------------------------------------------------------
    // External – Admin (owner / agent)
    // -------------------------------------------------------------------------

    /// @notice Update the minimum bribe amount.
    function setMinimumBribe(uint256 minimum) external onlyOwner {
        minimumBribe = minimum;
        emit MinimumBribeUpdated(minimum);
    }

    /// @notice Update the arbitrator address.
    function setArbitrator(address _arbitrator) external onlyOwner {
        if (_arbitrator == address(0)) revert ZeroAddress();
        arbitrator = _arbitrator;
        emit ArbitratorUpdated(_arbitrator);
    }

    /// @notice Assign a contributor to an escrow in Deposited state.
    /// @param escrowId    The escrow to assign.
    /// @param contributor The contributor's address.
    function assignContributor(uint256 escrowId, address contributor)
        external
        onlyOwner
    {
        Escrow storage e = _requireEscrow(escrowId);
        if (e.state != EscrowState.Deposited) {
            revert InvalidStateTransition(escrowId, e.state, EscrowState.Deposited);
        }
        if (contributor == address(0)) revert ZeroAddress();

        EscrowState old = e.state;
        e.assignedContributor = contributor;
        e.state = EscrowState.Assigned;

        emit ContributorAssigned(escrowId, contributor);
        emit StateChanged(escrowId, old, EscrowState.Assigned);
    }

    /// @notice Re-assign a contributor (e.g. after a failed delivery review).
    /// @dev    Moves escrow back to Assigned with the new contributor.
    function reassignContributor(uint256 escrowId, address newContributor)
        external
        onlyOwner
    {
        Escrow storage e = _requireEscrow(escrowId);
        if (
            e.state != EscrowState.Assigned &&
            e.state != EscrowState.Delivered &&
            e.state != EscrowState.Reviewed
        ) {
            revert InvalidStateTransition(escrowId, e.state, EscrowState.Assigned);
        }
        if (newContributor == address(0)) revert ZeroAddress();

        EscrowState old = e.state;
        e.assignedContributor = newContributor;
        e.state = EscrowState.Assigned;

        emit ContributorAssigned(escrowId, newContributor);
        emit StateChanged(escrowId, old, EscrowState.Assigned);
    }

    /// @notice Review a delivered escrow and either release funds or reassign.
    /// @param escrowId  The escrow to review.
    /// @param approved  If true, funds are released to the contributor.
    ///                  If false, escrow reverts to Reviewed state for reassignment.
    function reviewAndRelease(uint256 escrowId, bool approved)
        external
        nonReentrant
        onlyOwner
    {
        Escrow storage e = _requireEscrow(escrowId);
        if (e.state != EscrowState.Delivered) {
            revert InvalidStateTransition(escrowId, e.state, EscrowState.Delivered);
        }

        if (approved) {
            EscrowState old = e.state;
            address contributor = e.assignedContributor;
            e.state = EscrowState.Released;
            _removeFromActive(escrowId);

            uint256 yieldAmount = getYieldAccrued(escrowId);
            e.yieldAccrued = yieldAmount;
            uint256 payout = e.amount + yieldAmount;

            emit StateChanged(escrowId, old, EscrowState.Released);
            // Funds go to Treasury; contributor is credited on-chain for reputation
            emit EscrowReleased(escrowId, treasury, payout, contributor);

            _sendEth(treasury, payout);
        } else {
            EscrowState old = e.state;
            e.state = EscrowState.Reviewed;
            emit StateChanged(escrowId, old, EscrowState.Reviewed);
        }
    }

    /// @notice Agent delivers directly, releasing funds to the owner/treasury.
    /// @dev    Can be called on any non-terminal escrow. Sends funds to the
    ///         contract owner (the agent / treasury operator).
    function agentDeliver(uint256 escrowId)
        external
        nonReentrant
        onlyOwner
    {
        Escrow storage e = _requireEscrow(escrowId);
        if (
            e.state == EscrowState.Released ||
            e.state == EscrowState.Refunded
        ) {
            revert InvalidStateTransition(escrowId, e.state, EscrowState.Assigned);
        }

        EscrowState old = e.state;
        e.state = EscrowState.Released;
        _removeFromActive(escrowId);

        uint256 yieldAmount = getYieldAccrued(escrowId);
        e.yieldAccrued = yieldAmount;
        uint256 payout = e.amount + yieldAmount;

        emit StateChanged(escrowId, old, EscrowState.Released);
        emit EscrowReleased(escrowId, treasury, payout, address(0)); // agent delivery, no contributor

        _sendEth(treasury, payout);
    }

    // -------------------------------------------------------------------------
    // External – Contributor
    // -------------------------------------------------------------------------

    /// @notice Mark an escrow as delivered. Only the assigned contributor may call.
    /// @param escrowId  The escrow to mark as delivered.
    function markDelivered(uint256 escrowId) external {
        Escrow storage e = _requireEscrow(escrowId);
        if (e.assignedContributor != msg.sender) {
            revert NotAssignedContributor(escrowId, msg.sender);
        }
        if (e.state != EscrowState.Assigned) {
            revert InvalidStateTransition(escrowId, e.state, EscrowState.Assigned);
        }

        EscrowState old = e.state;
        e.state = EscrowState.Delivered;

        emit DeliveryMarked(escrowId, msg.sender);
        emit StateChanged(escrowId, old, EscrowState.Delivered);
    }

    // -------------------------------------------------------------------------
    // External – Briber
    // -------------------------------------------------------------------------

    /// @notice Dispute a delivery. Only the original briber may call.
    /// @dev    Moves escrow from Delivered to Disputed. Arbitrator resolves.
    function disputeDelivery(uint256 escrowId) external {
        Escrow storage e = _requireEscrow(escrowId);
        if (e.briber != msg.sender) revert NotBriber(escrowId, msg.sender);
        if (e.state != EscrowState.Delivered) {
            revert InvalidStateTransition(escrowId, e.state, EscrowState.Delivered);
        }

        EscrowState old = e.state;
        e.state = EscrowState.Disputed;

        emit DisputeRaised(escrowId, msg.sender);
        emit StateChanged(escrowId, old, EscrowState.Disputed);
    }

    // -------------------------------------------------------------------------
    // External – Arbitrator
    // -------------------------------------------------------------------------

    /// @notice Resolve a disputed escrow.
    /// @param escrowId              The escrow to resolve.
    /// @param releaseToContributor  If true, pay contributor. If false, refund briber.
    function resolveDispute(uint256 escrowId, bool releaseToContributor)
        external
        nonReentrant
    {
        if (msg.sender != arbitrator) revert NotArbitrator(msg.sender);

        Escrow storage e = _requireEscrow(escrowId);
        if (e.state != EscrowState.Disputed) {
            revert InvalidStateTransition(escrowId, e.state, EscrowState.Disputed);
        }

        EscrowState old = e.state;
        _removeFromActive(escrowId);

        uint256 yieldAmount = getYieldAccrued(escrowId);
        e.yieldAccrued = yieldAmount;
        uint256 payout = e.amount + yieldAmount;

        if (releaseToContributor) {
            // Contributor wins dispute: funds still go to Treasury (contributor gets reputation)
            e.state = EscrowState.Released;
            emit StateChanged(escrowId, old, EscrowState.Released);
            emit EscrowReleased(escrowId, treasury, payout, e.assignedContributor);
            emit DisputeResolved(escrowId, true);
            _sendEth(treasury, payout);
        } else {
            // Briber wins dispute: full refund to briber
            e.state = EscrowState.Refunded;
            emit StateChanged(escrowId, old, EscrowState.Refunded);
            emit EscrowRefunded(escrowId, e.briber, payout);
            emit DisputeResolved(escrowId, false);
            _sendEth(payable(e.briber), payout);
        }
    }

    // -------------------------------------------------------------------------
    // Public – Views
    // -------------------------------------------------------------------------

    /// @notice Calculate the mock yield accrued for an escrow since deposit.
    /// @dev    yield = principal * YIELD_RATE_PER_SECOND * elapsed / 1e18
    ///         For terminal escrows (Released/Refunded) returns the stored value.
    function getYieldAccrued(uint256 escrowId) public view returns (uint256) {
        Escrow storage e = _requireEscrowView(escrowId);

        // For terminal states, return the stored accrued amount
        if (
            e.state == EscrowState.Released ||
            e.state == EscrowState.Refunded
        ) {
            return e.yieldAccrued;
        }

        uint256 elapsed = block.timestamp - e.depositTime;
        // principal * rate * elapsed / 1e18  (rate is scaled by 1e18)
        return (e.amount * YIELD_RATE_PER_SECOND * elapsed) / 1e18;
    }

    /// @notice Retrieve a full escrow record.
    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return _requireEscrowView(escrowId);
    }

    /// @notice Returns all currently active (non-terminal) escrow IDs.
    function getActiveEscrows() external view returns (uint256[] memory) {
        return _activeEscrowIds;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /// @dev Returns a storage reference to an escrow, reverting if ID 0 or
    ///      the escrow has never been initialised (briber == address(0)).
    function _requireEscrow(uint256 escrowId)
        internal
        view
        returns (Escrow storage e)
    {
        e = escrows[escrowId];
        if (e.briber == address(0)) revert EscrowNotFound(escrowId);
    }

    /// @dev Pure-view variant (no storage mutation path required).
    function _requireEscrowView(uint256 escrowId)
        internal
        view
        returns (Escrow storage e)
    {
        e = escrows[escrowId];
        if (e.briber == address(0)) revert EscrowNotFound(escrowId);
    }

    /// @dev Removes an escrow ID from the active list (swap-and-pop).
    function _removeFromActive(uint256 escrowId) internal {
        uint256 idx  = _activeIndex[escrowId];
        uint256 last = _activeEscrowIds[_activeEscrowIds.length - 1];

        _activeEscrowIds[idx] = last;
        _activeIndex[last]    = idx;

        _activeEscrowIds.pop();
        delete _activeIndex[escrowId];
    }

    /// @dev Sends ETH, reverting on failure.
    function _sendEth(address payable to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed(to, amount);
    }
}
