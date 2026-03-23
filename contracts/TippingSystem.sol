// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title TippingSystem
/// @notice Accepts ETH and whitelisted ERC-20 tips; routes all funds to treasury.
///         Supports predefined tiers, anonymous tipping, and per-address rate-limit tracking.
contract TippingSystem is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants – tier identifiers
    // -------------------------------------------------------------------------

    uint8 public constant TIER_OPEN = 0;
    uint8 public constant TIER_1    = 1; // 0.001 ETH – "1 week CI costs"
    uint8 public constant TIER_2    = 2; // 0.01  ETH – "1 month security audit"
    uint8 public constant TIER_3    = 3; // 0.1   ETH – "3 months of dependency management"

    uint256 public constant TIER_1_AMOUNT = 0.001 ether;
    uint256 public constant TIER_2_AMOUNT = 0.01  ether;
    uint256 public constant TIER_3_AMOUNT = 0.1   ether;

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct TierInfo {
        uint256 amount;
        string  humanDescription;
        string  agentDescription;
    }

    struct TipRecord {
        address tipper;        // address(0) when isAnonymous
        address token;         // address(0) = ETH
        uint256 amount;
        uint8   tier;
        bool    isAnonymous;
        bool    displayAmount;
        uint256 timestamp;
        string  message;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address public immutable treasury;

    mapping(uint8 => TierInfo) public tiers;

    // Token whitelist; address(0) represents native ETH (always accepted)
    mapping(address => bool) public acceptedTokens;

    // Rate-limit state
    mapping(address => uint256) public lastTipRequest;   // last tip timestamp
    mapping(address => uint256) public tipHistory;        // cumulative amount tipped
    uint256 public averageTipAmount;

    uint256 private _totalTipCount;
    uint256 private _totalTipSum;

    // Public tip log
    TipRecord[] public tipLog;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TipReceived(
        address indexed tipper,
        address indexed token,
        uint256 amount,
        uint8   tier,
        bool    isAnonymous,
        string  message
    );

    event AcceptedTokenSet(address indexed token, bool accepted);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _treasury  Destination address for all tip proceeds.
    /// @param _usdc      USDC token address to whitelist (can be address(0) to skip).
    /// @param _dai       DAI  token address to whitelist (can be address(0) to skip).
    /// @param _weth      WETH token address to whitelist (can be address(0) to skip).
    constructor(
        address _treasury,
        address _usdc,
        address _dai,
        address _weth
    ) Ownable(msg.sender) {
        require(_treasury != address(0), "TippingSystem: zero treasury");
        treasury = _treasury;

        tiers[TIER_1] = TierInfo({
            amount:           TIER_1_AMOUNT,
            humanDescription: "1 week CI costs",
            agentDescription: "Small maintenance tier covering one week of continuous-integration costs."
        });
        tiers[TIER_2] = TierInfo({
            amount:           TIER_2_AMOUNT,
            humanDescription: "1 month security audit",
            agentDescription: "Medium support tier covering one month of security-audit costs."
        });
        tiers[TIER_3] = TierInfo({
            amount:           TIER_3_AMOUNT,
            humanDescription: "3 months of dependency management",
            agentDescription: "Large sustainer tier covering three months of dependency-management costs."
        });

        if (_usdc != address(0)) { acceptedTokens[_usdc] = true; emit AcceptedTokenSet(_usdc, true); }
        if (_dai  != address(0)) { acceptedTokens[_dai]  = true; emit AcceptedTokenSet(_dai,  true); }
        if (_weth != address(0)) { acceptedTokens[_weth] = true; emit AcceptedTokenSet(_weth, true); }
    }

    // -------------------------------------------------------------------------
    // Tipping – ETH
    // -------------------------------------------------------------------------

    /// @notice Send a native-ETH tip.
    /// @param tier          Predefined tier id (0 = open amount).
    /// @param isAnonymous   If true, tipper address is masked to address(0) in the event.
    /// @param displayAmount Whether the public tip record should reveal the amount.
    /// @param message       Optional freeform message.
    function tipETH(
        uint8          tier,
        bool           isAnonymous,
        bool           displayAmount,
        string calldata message
    )
        external
        payable
        nonReentrant
        whenNotPaused
    {
        require(msg.value > 0, "TippingSystem: zero value");
        _validateTier(tier, msg.value);
        _recordTip(msg.sender, address(0), msg.value, tier, isAnonymous, displayAmount, message);

        (bool ok, ) = treasury.call{value: msg.value}("");
        require(ok, "TippingSystem: ETH transfer failed");
    }

    // -------------------------------------------------------------------------
    // Tipping – ERC-20
    // -------------------------------------------------------------------------

    /// @notice Send an ERC-20 tip.
    function tipERC20(
        address        token,
        uint256        amount,
        uint8          tier,
        bool           isAnonymous,
        bool           displayAmount,
        string calldata message
    )
        external
        nonReentrant
        whenNotPaused
    {
        require(acceptedTokens[token], "TippingSystem: token not accepted");
        require(amount > 0, "TippingSystem: zero amount");
        _validateTier(tier, amount);
        _recordTip(msg.sender, token, amount, tier, isAnonymous, displayAmount, message);

        IERC20(token).safeTransferFrom(msg.sender, treasury, amount);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _validateTier(uint8 tier, uint256 amount) internal pure {
        if      (tier == TIER_1) require(amount == TIER_1_AMOUNT, "TippingSystem: wrong TIER_1 amount");
        else if (tier == TIER_2) require(amount == TIER_2_AMOUNT, "TippingSystem: wrong TIER_2 amount");
        else if (tier == TIER_3) require(amount == TIER_3_AMOUNT, "TippingSystem: wrong TIER_3 amount");
        // TIER_OPEN (0) accepts any positive amount
    }

    function _recordTip(
        address         sender,
        address         token,
        uint256         amount,
        uint8           tier,
        bool            isAnon,
        bool            displayAmount,
        string calldata message
    ) internal {
        updateRateLimit(sender, amount);

        address emittedTipper = isAnon ? address(0) : sender;

        tipLog.push(TipRecord({
            tipper:        emittedTipper,
            token:         token,
            amount:        amount,
            tier:          tier,
            isAnonymous:   isAnon,
            displayAmount: displayAmount,
            timestamp:     block.timestamp,
            message:       message
        }));

        emit TipReceived(emittedTipper, token, amount, tier, isAnon, message);
    }

    // -------------------------------------------------------------------------
    // Rate limiting
    // -------------------------------------------------------------------------

    /// @notice Update rate-limit state for a user after a tip.
    function updateRateLimit(address user, uint256 amount) internal {
        lastTipRequest[user]  = block.timestamp;
        tipHistory[user]     += amount;

        _totalTipSum   += amount;
        _totalTipCount += 1;
        averageTipAmount = _totalTipSum / _totalTipCount;
    }

    /// @notice Returns the rate-limit tier for a given user.
    /// @return  0 = never donated, 1 = below average, 2 = above average, 3 = agent-level
    function getRateLimitTier(address user) external view returns (uint8) {
        if (tipHistory[user] == 0)                         return 0;
        if (tipHistory[user] < averageTipAmount)           return 1;
        if (tipHistory[user] >= averageTipAmount * 3)      return 3;
        return 2;
    }

    // -------------------------------------------------------------------------
    // Owner administration
    // -------------------------------------------------------------------------

    function setAcceptedToken(address token, bool accepted) external onlyOwner {
        require(token != address(0), "TippingSystem: zero address");
        acceptedTokens[token] = accepted;
        emit AcceptedTokenSet(token, accepted);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    function getTipCount() external view returns (uint256) { return tipLog.length; }

    function getTier(uint8 tier) external view returns (TierInfo memory) {
        return tiers[tier];
    }

    // -------------------------------------------------------------------------
    // Reject accidental ETH sends
    // -------------------------------------------------------------------------

    receive() external payable { revert("TippingSystem: use tipETH()"); }
}
