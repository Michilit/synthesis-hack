// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title StreamingAgreement - ETH payment-streaming with SLA enforcement
/// @notice Payers deposit ETH and funds accrue to the recipient at a fixed
///         rate per second. The payer may top up at any time. SLA breaches
///         can be reported by anyone and confirmed by the owner, who may then
///         pause the stream. When a stream is paused the amount accrued up to
///         the pause point is snapshotted and remains claimable. Cancellation
///         requires a notice period before the remaining balance is refunded.
contract StreamingAgreement is Ownable, ReentrancyGuard {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice A payment-streaming agreement between a payer and a recipient.
    struct Agreement {
        uint256         id;
        address         payer;
        address payable recipient;
        uint256         ratePerSecond;
        uint256         startTime;
        uint256         lastClaimedTime;
        uint256         totalDeposited;
        uint256         totalClaimed;
        bool            active;
        uint256         slaMaxDowntimeHours;
        uint256         slaMaxResponseTimeHours;
        bool            paused;
        uint256         cancellationNoticePeriod; // seconds
        uint256         cancellationRequestedAt;  // 0 if not requested
        string          lastBreachDescription;
        uint256         accruedAtPause;           // snapshot of claimable amount at pause time
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    uint256 private _agreementCounter;

    /// @notice All agreements keyed by ID.
    mapping(uint256 => Agreement) public agreements;

    /// @dev Ordered list of active agreement IDs.
    uint256[] private _activeAgreementIds;
    mapping(uint256 => uint256) private _activeIndex; // agreementId => index

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event AgreementCreated(
        uint256 indexed agreementId,
        address indexed payer,
        address indexed recipient,
        uint256 ratePerSecond,
        uint256 initialDeposit
    );
    event FundsToppedUp(uint256 indexed agreementId, address indexed by, uint256 amount);
    event FundsClaimed(uint256 indexed agreementId, address indexed recipient, uint256 amount);
    event SlaBreachReported(uint256 indexed agreementId, address indexed reporter, string description);
    event SlaBreachVerified(uint256 indexed agreementId, bool confirmed);
    event StreamPaused(uint256 indexed agreementId);
    event StreamResumed(uint256 indexed agreementId);
    event CancellationRequested(uint256 indexed agreementId, address indexed payer, uint256 executeAfter);
    event AgreementCancelled(uint256 indexed agreementId, uint256 refunded);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error AgreementNotFound(uint256 agreementId);
    error NotPayer(uint256 agreementId, address caller);
    error NotRecipient(uint256 agreementId, address caller);
    error AgreementNotActive(uint256 agreementId);
    error AgreementAlreadyPaused(uint256 agreementId);
    error AgreementNotPaused(uint256 agreementId);
    error NoCancellationRequested(uint256 agreementId);
    error NoticePeriodNotElapsed(uint256 agreementId, uint256 executeAfter);
    error NoFundsToTop(uint256 agreementId);
    error ZeroDeposit();
    error ZeroRate();
    error ZeroAddress();
    error TransferFailed(address to, uint256 amount);
    error NothingToClaim(uint256 agreementId);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param initialOwner Contract owner (arbitrates SLA breaches, pauses streams).
    constructor(address initialOwner) Ownable(initialOwner) {
        _agreementCounter = 1;
    }

    // -------------------------------------------------------------------------
    // External – Payer
    // -------------------------------------------------------------------------

    /// @notice Create a new streaming agreement.
    /// @param recipient                  Address that receives streamed ETH.
    /// @param ratePerSecond              ETH (in wei) released per second.
    /// @param slaMaxDowntimeHours        Maximum allowed downtime in hours.
    /// @param slaMaxResponseTimeHours    Maximum allowed response time in hours.
    /// @param cancellationNoticePeriod   Seconds the payer must wait after requesting
    ///                                   cancellation before funds can be refunded.
    /// @return agreementId               ID of the created agreement.
    function createAgreement(
        address payable recipient,
        uint256 ratePerSecond,
        uint256 slaMaxDowntimeHours,
        uint256 slaMaxResponseTimeHours,
        uint256 cancellationNoticePeriod
    )
        external
        payable
        nonReentrant
        returns (uint256 agreementId)
    {
        if (msg.value == 0)           revert ZeroDeposit();
        if (ratePerSecond == 0)       revert ZeroRate();
        if (recipient == address(0))  revert ZeroAddress();

        agreementId = _agreementCounter;
        unchecked { _agreementCounter++; }

        agreements[agreementId] = Agreement({
            id:                       agreementId,
            payer:                    msg.sender,
            recipient:                recipient,
            ratePerSecond:            ratePerSecond,
            startTime:                block.timestamp,
            lastClaimedTime:          block.timestamp,
            totalDeposited:           msg.value,
            totalClaimed:             0,
            active:                   true,
            slaMaxDowntimeHours:      slaMaxDowntimeHours,
            slaMaxResponseTimeHours:  slaMaxResponseTimeHours,
            paused:                   false,
            cancellationNoticePeriod: cancellationNoticePeriod,
            cancellationRequestedAt:  0,
            lastBreachDescription:    "",
            accruedAtPause:           0
        });

        _activeAgreementIds.push(agreementId);
        _activeIndex[agreementId] = _activeAgreementIds.length - 1;

        emit AgreementCreated(agreementId, msg.sender, recipient, ratePerSecond, msg.value);
    }

    /// @notice Add more ETH to an active agreement's balance.
    function topUp(uint256 agreementId) external payable nonReentrant {
        Agreement storage a = _requireActive(agreementId);
        if (msg.value == 0) revert NoFundsToTop(agreementId);

        a.totalDeposited += msg.value;
        emit FundsToppedUp(agreementId, msg.sender, msg.value);
    }

    /// @notice Submit a cancellation request. The payer must wait
    ///         `cancellationNoticePeriod` seconds before calling
    ///         `finalizeCancellation`.
    function requestCancellation(uint256 agreementId) external {
        Agreement storage a = _requireActive(agreementId);
        if (a.payer != msg.sender) revert NotPayer(agreementId, msg.sender);

        a.cancellationRequestedAt = block.timestamp;
        uint256 executeAfter = block.timestamp + a.cancellationNoticePeriod;

        emit CancellationRequested(agreementId, msg.sender, executeAfter);
    }

    /// @notice Finalize cancellation after the notice period has elapsed.
    ///         Pays out any unclaimed accrued amount to the recipient first,
    ///         then refunds the remaining balance to the payer.
    function finalizeCancellation(uint256 agreementId)
        external
        nonReentrant
    {
        Agreement storage a = _requireAgreement(agreementId);
        if (!a.active)                         revert AgreementNotActive(agreementId);
        if (a.cancellationRequestedAt == 0)    revert NoCancellationRequested(agreementId);

        uint256 executeAfter = a.cancellationRequestedAt + a.cancellationNoticePeriod;
        if (block.timestamp < executeAfter) {
            revert NoticePeriodNotElapsed(agreementId, executeAfter);
        }

        // Pay recipient accrued amount before cancellation
        uint256 accrued = claimableAmount(agreementId);
        if (accrued > 0) {
            a.totalClaimed       += accrued;
            a.lastClaimedTime     = block.timestamp;
            if (a.paused) {
                a.accruedAtPause = 0;
            }
            _sendEth(a.recipient, accrued);
            emit FundsClaimed(agreementId, a.recipient, accrued);
        }

        // Refund remaining balance to payer
        uint256 remaining = a.totalDeposited - a.totalClaimed;
        a.active = false;
        _removeFromActive(agreementId);

        emit AgreementCancelled(agreementId, remaining);

        if (remaining > 0) {
            _sendEth(payable(a.payer), remaining);
        }
    }

    // -------------------------------------------------------------------------
    // External – Recipient
    // -------------------------------------------------------------------------

    /// @notice Claim all accrued (but unclaimed) streamed ETH.
    /// @dev    When the stream is paused, the snapshotted accruedAtPause amount
    ///         is claimable and is cleared after a successful claim.
    function claim(uint256 agreementId) external nonReentrant {
        Agreement storage a = _requireActive(agreementId);
        if (a.recipient != msg.sender) revert NotRecipient(agreementId, msg.sender);

        uint256 amount = claimableAmount(agreementId);
        if (amount == 0) revert NothingToClaim(agreementId);

        a.totalClaimed += amount;

        // If the stream is paused we consumed the snapshot; clear it.
        // lastClaimedTime is not advanced while paused (resumeStream handles that).
        if (a.paused) {
            a.accruedAtPause = 0;
        } else {
            a.lastClaimedTime = block.timestamp;
        }

        emit FundsClaimed(agreementId, msg.sender, amount);
        _sendEth(a.recipient, amount);
    }

    // -------------------------------------------------------------------------
    // External – Anyone
    // -------------------------------------------------------------------------

    /// @notice Report an SLA breach for an agreement.
    /// @param agreementId       The agreement to report.
    /// @param breachDescription Human-readable description of the breach.
    function reportSlaBreach(uint256 agreementId, string calldata breachDescription)
        external
    {
        Agreement storage a = _requireAgreement(agreementId);
        a.lastBreachDescription = breachDescription;

        emit SlaBreachReported(agreementId, msg.sender, breachDescription);
    }

    // -------------------------------------------------------------------------
    // External – Owner
    // -------------------------------------------------------------------------

    /// @notice Confirm or dismiss a reported SLA breach.
    /// @param confirmed  If true, the breach is validated (owner may then pause).
    function verifySlaBreach(uint256 agreementId, bool confirmed)
        external
        onlyOwner
    {
        _requireAgreement(agreementId);
        emit SlaBreachVerified(agreementId, confirmed);
    }

    /// @notice Pause fund streaming for an agreement.
    ///         The amount accrued up to this point is snapshotted in accruedAtPause
    ///         so it remains claimable even while the stream is frozen.
    function pauseStream(uint256 agreementId) external onlyOwner {
        Agreement storage a = _requireActive(agreementId);
        if (a.paused) revert AgreementAlreadyPaused(agreementId);

        // Snapshot the amount earned so far before freezing the stream.
        a.accruedAtPause = claimableAmount(agreementId);
        a.paused = true;

        emit StreamPaused(agreementId);
    }

    /// @notice Resume a paused stream.
    ///         Advances lastClaimedTime to now so the paused duration is not
    ///         double-counted, and clears the accruedAtPause snapshot.
    function resumeStream(uint256 agreementId) external onlyOwner {
        Agreement storage a = _requireActive(agreementId);
        if (!a.paused) revert AgreementNotPaused(agreementId);

        // Skip the paused duration by moving the clock forward.
        a.lastClaimedTime = block.timestamp;
        a.accruedAtPause  = 0;
        a.paused          = false;

        emit StreamResumed(agreementId);
    }

    // -------------------------------------------------------------------------
    // Public – Views
    // -------------------------------------------------------------------------

    /// @notice Returns the ETH (in wei) that the recipient can currently claim.
    /// @dev    When paused:  returns accruedAtPause (snapshotted at pause time).
    ///         When active:  min(elapsed * ratePerSecond, remaining unclaimed balance).
    function claimableAmount(uint256 agreementId) public view returns (uint256) {
        Agreement storage a = _requireAgreement(agreementId);

        if (!a.active) {
            return 0;
        }

        if (a.paused) {
            // Return the amount that was accrued at the moment the stream was paused.
            return a.accruedAtPause;
        }

        uint256 elapsed   = block.timestamp - a.lastClaimedTime;
        uint256 accrued   = elapsed * a.ratePerSecond;
        uint256 remaining = a.totalDeposited - a.totalClaimed;

        return accrued < remaining ? accrued : remaining;
    }

    /// @notice Retrieve a full agreement record.
    function getAgreement(uint256 agreementId) external view returns (Agreement memory) {
        return _requireAgreement(agreementId);
    }

    /// @notice Returns all currently active agreement IDs.
    function getActiveAgreements() external view returns (uint256[] memory) {
        return _activeAgreementIds;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _requireAgreement(uint256 agreementId)
        internal
        view
        returns (Agreement storage a)
    {
        a = agreements[agreementId];
        if (a.payer == address(0)) revert AgreementNotFound(agreementId);
    }

    function _requireActive(uint256 agreementId)
        internal
        view
        returns (Agreement storage a)
    {
        a = _requireAgreement(agreementId);
        if (!a.active) revert AgreementNotActive(agreementId);
    }

    function _removeFromActive(uint256 agreementId) internal {
        uint256 idx  = _activeIndex[agreementId];
        uint256 last = _activeAgreementIds[_activeAgreementIds.length - 1];

        _activeAgreementIds[idx] = last;
        _activeIndex[last]       = idx;

        _activeAgreementIds.pop();
        delete _activeIndex[agreementId];
    }

    function _sendEth(address payable to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed(to, amount);
    }
}
