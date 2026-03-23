// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title StreamingAgreement
/// @notice Protocol Guild-style per-second payment streaming with SLA tracking.
///         Only the treasury can claim streamed funds.
///         ETH and whitelisted ERC-20 tokens are supported.
contract StreamingAgreement is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Defaults
    // -------------------------------------------------------------------------

    uint256 public constant DEFAULT_SLA_MAX_DOWNTIME_HOURS  = 24;
    uint256 public constant DEFAULT_SLA_MAX_RESPONSE_HOURS  = 72;
    uint256 public constant DEFAULT_NOTICE_PERIOD_DAYS      = 30;
    uint256 public constant UPFRONT_DEPOSIT_DAYS            = 30;

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct Agreement {
        uint256 id;
        address payer;
        address token;            // address(0) = ETH
        uint256 ratePerSecond;
        uint256 startTime;
        uint256 lastClaimedTime;
        uint256 endTime;          // 0 = indefinite
        uint256 totalStreamed;    // lifetime accrued (informational)
        uint256 totalClaimed;
        bool    paused;
        uint256 accruedAtPause;  // snapshot when paused
        uint256 slaMaxDowntimeHours;
        uint256 slaMaxResponseHours;
        uint256 noticePeriodDays;
        uint256 cancellationRequestedAt; // 0 = not requested
        uint256 depositBalance;  // remaining unfunded deposit held in contract
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address public immutable treasury;

    uint256 private _nextAgreementId = 1;

    mapping(uint256 => Agreement) public agreements;

    // Token whitelist; address(0) = ETH always accepted
    mapping(address => bool) public acceptedTokens;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event AgreementCreated(
        uint256 indexed agreementId,
        address indexed payer,
        address token,
        uint256 ratePerSecond,
        uint256 startTime,
        uint256 endTime
    );
    event StreamClaimed(
        uint256 indexed agreementId,
        address indexed claimedTo,
        uint256 amount
    );
    event SLABreachReported(
        uint256 indexed agreementId,
        address indexed reporter,
        string  reason
    );
    event StreamPaused(uint256 indexed agreementId, uint256 accruedAtPause);
    event StreamResumed(uint256 indexed agreementId, uint256 resumedAt);
    event CancellationRequested(uint256 indexed agreementId, uint256 requestedAt);
    event AgreementCancelled(
        uint256 indexed agreementId,
        address indexed payer,
        uint256 refundAmount
    );
    event AcceptedTokenSet(address indexed token, bool accepted);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _treasury  Address that receives claimed stream funds.
    constructor(address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "StreamingAgreement: zero treasury");
        treasury = _treasury;
    }

    // -------------------------------------------------------------------------
    // Token whitelist management
    // -------------------------------------------------------------------------

    function setAcceptedToken(address token, bool accepted) external onlyOwner {
        require(token != address(0), "StreamingAgreement: zero address");
        acceptedTokens[token] = accepted;
        emit AcceptedTokenSet(token, accepted);
    }

    // -------------------------------------------------------------------------
    // Create agreement
    // -------------------------------------------------------------------------

    /// @notice Create a streaming agreement.  Payer must supply an upfront deposit
    ///         covering 30 days of streaming.
    /// @param token           Payment token (address(0) for ETH).
    /// @param ratePerSecond   Tokens streamed per second.
    /// @param endTime         Unix timestamp when stream ends (0 = indefinite).
    /// @param slaMaxDowntime  SLA maximum downtime in hours (0 = use default 24 h).
    /// @param slaMaxResponse  SLA maximum response time in hours (0 = use default 72 h).
    /// @param noticePeriod    Cancellation notice period in days (0 = use default 30 d).
    function createAgreement(
        address token,
        uint256 ratePerSecond,
        uint256 endTime,
        uint256 slaMaxDowntime,
        uint256 slaMaxResponse,
        uint256 noticePeriod
    )
        external
        payable
        nonReentrant
        whenNotPaused
    {
        require(ratePerSecond > 0, "StreamingAgreement: zero rate");
        if (token != address(0)) {
            require(acceptedTokens[token], "StreamingAgreement: token not accepted");
        }

        uint256 requiredDeposit = ratePerSecond * UPFRONT_DEPOSIT_DAYS * 1 days;

        if (token == address(0)) {
            require(msg.value >= requiredDeposit, "StreamingAgreement: insufficient ETH deposit");
        } else {
            require(msg.value == 0, "StreamingAgreement: ETH sent with token agreement");
            IERC20(token).safeTransferFrom(msg.sender, address(this), requiredDeposit);
        }

        uint256 id = _nextAgreementId++;

        Agreement storage a = agreements[id];
        a.id                   = id;
        a.payer                = msg.sender;
        a.token                = token;
        a.ratePerSecond        = ratePerSecond;
        a.startTime            = block.timestamp;
        a.lastClaimedTime      = block.timestamp;
        a.endTime              = endTime;
        a.slaMaxDowntimeHours  = slaMaxDowntime > 0 ? slaMaxDowntime : DEFAULT_SLA_MAX_DOWNTIME_HOURS;
        a.slaMaxResponseHours  = slaMaxResponse > 0 ? slaMaxResponse : DEFAULT_SLA_MAX_RESPONSE_HOURS;
        a.noticePeriodDays     = noticePeriod  > 0  ? noticePeriod  : DEFAULT_NOTICE_PERIOD_DAYS;
        a.depositBalance       = requiredDeposit;

        emit AgreementCreated(id, msg.sender, token, ratePerSecond, block.timestamp, endTime);
    }

    // -------------------------------------------------------------------------
    // Claimable calculation
    // -------------------------------------------------------------------------

    /// @notice Returns the amount currently claimable for an agreement.
    function claimable(uint256 agreementId) public view returns (uint256) {
        Agreement storage a = _getAgreement(agreementId);

        if (a.paused) {
            return a.accruedAtPause;
        }

        uint256 boundary = _effectiveEnd(a);
        if (block.timestamp <= a.lastClaimedTime || block.timestamp <= a.startTime) {
            return 0;
        }

        uint256 elapsed = (boundary < block.timestamp ? boundary : block.timestamp) - a.lastClaimedTime;
        return elapsed * a.ratePerSecond;
    }

    // -------------------------------------------------------------------------
    // Claim – only treasury
    // -------------------------------------------------------------------------

    /// @notice Claim accrued stream to treasury.
    function claim(uint256 agreementId) external nonReentrant whenNotPaused {
        require(msg.sender == treasury, "StreamingAgreement: only treasury");

        Agreement storage a = _getAgreement(agreementId);
        require(!a.paused || a.accruedAtPause > 0, "StreamingAgreement: stream paused, nothing to claim");

        uint256 amount = claimable(agreementId);
        require(amount > 0, "StreamingAgreement: nothing to claim");
        require(amount <= a.depositBalance, "StreamingAgreement: insufficient deposit");

        // Advance state
        if (a.paused) {
            a.accruedAtPause = 0;
        } else {
            uint256 boundary = _effectiveEnd(a);
            uint256 elapsed  = (boundary < block.timestamp ? boundary : block.timestamp) - a.lastClaimedTime;
            a.lastClaimedTime = a.lastClaimedTime + elapsed;
        }

        a.totalClaimed   += amount;
        a.totalStreamed   += amount;
        a.depositBalance -= amount;

        _transfer(a.token, treasury, amount);

        emit StreamClaimed(agreementId, treasury, amount);
    }

    // -------------------------------------------------------------------------
    // SLA breach reporting
    // -------------------------------------------------------------------------

    /// @notice Anyone can report an SLA breach. Owner can then pause the stream.
    function reportSLABreach(uint256 agreementId, string calldata reason) external {
        _getAgreement(agreementId); // existence check
        require(bytes(reason).length > 0, "StreamingAgreement: empty reason");
        emit SLABreachReported(agreementId, msg.sender, reason);
    }

    // -------------------------------------------------------------------------
    // Pause / resume (owner)
    // -------------------------------------------------------------------------

    /// @notice Pause stream and snapshot accrued-but-unclaimed amount.
    function pauseStream(uint256 agreementId) external onlyOwner {
        Agreement storage a = _getAgreement(agreementId);
        require(!a.paused, "StreamingAgreement: already paused");

        uint256 accrued = claimable(agreementId);
        a.paused        = true;
        a.accruedAtPause = accrued;

        emit StreamPaused(agreementId, accrued);
    }

    /// @notice Resume a paused stream.  Advances lastClaimedTime to now and resets snapshot.
    function resumeStream(uint256 agreementId) external onlyOwner {
        Agreement storage a = _getAgreement(agreementId);
        require(a.paused, "StreamingAgreement: not paused");

        a.paused          = false;
        a.accruedAtPause  = 0;
        a.lastClaimedTime = block.timestamp;

        emit StreamResumed(agreementId, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // Cancellation
    // -------------------------------------------------------------------------

    /// @notice Payer requests cancellation (starts notice period).
    function requestCancellation(uint256 agreementId) external {
        Agreement storage a = _getAgreement(agreementId);
        require(msg.sender == a.payer, "StreamingAgreement: only payer");
        require(a.cancellationRequestedAt == 0, "StreamingAgreement: already requested");

        a.cancellationRequestedAt = block.timestamp;
        emit CancellationRequested(agreementId, block.timestamp);
    }

    /// @notice Execute cancellation after notice period has elapsed.
    ///         Refunds remaining deposit to payer.
    function executeCancellation(uint256 agreementId) external nonReentrant {
        Agreement storage a = _getAgreement(agreementId);
        require(
            msg.sender == a.payer || msg.sender == owner(),
            "StreamingAgreement: not authorised"
        );
        require(a.cancellationRequestedAt > 0, "StreamingAgreement: cancellation not requested");
        require(
            block.timestamp >= a.cancellationRequestedAt + a.noticePeriodDays * 1 days,
            "StreamingAgreement: notice period not elapsed"
        );

        // Claim any remaining accrued to treasury before cancellation
        uint256 accrued = claimable(agreementId);
        if (accrued > 0 && accrued <= a.depositBalance) {
            a.totalClaimed   += accrued;
            a.totalStreamed   += accrued;
            a.depositBalance -= accrued;
            _transfer(a.token, treasury, accrued);
            emit StreamClaimed(agreementId, treasury, accrued);
        }

        uint256 refund = a.depositBalance;
        a.depositBalance = 0;
        a.endTime        = block.timestamp;

        if (refund > 0) {
            _transfer(a.token, a.payer, refund);
        }

        emit AgreementCancelled(agreementId, a.payer, refund);
    }

    // -------------------------------------------------------------------------
    // Global pause (Pausable)
    // -------------------------------------------------------------------------

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _effectiveEnd(Agreement storage a) internal view returns (uint256) {
        if (a.endTime > 0 && a.endTime < block.timestamp) return a.endTime;
        return block.timestamp;
    }

    function _transfer(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "StreamingAgreement: ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    function _getAgreement(uint256 id) internal view returns (Agreement storage) {
        require(id > 0 && id < _nextAgreementId, "StreamingAgreement: does not exist");
        return agreements[id];
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    function totalAgreements() external view returns (uint256) { return _nextAgreementId - 1; }

    // -------------------------------------------------------------------------
    // Receive
    // -------------------------------------------------------------------------

    receive() external payable {}
}
