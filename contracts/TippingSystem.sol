// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TippingSystem - Community tipping for DPI Guardians
/// @notice Supports three predefined tiers (COFFEE, SPRINT, CHAMPION) plus
///         an open CUSTOM tier. All funds are forwarded immediately to a
///         configurable treasury address. Tippers may opt for anonymity.
contract TippingSystem is Ownable, ReentrancyGuard {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice Predefined tip tiers with associated ETH amounts.
    enum Tier {
        COFFEE,   // 0.01 ETH  – 1 hour of CI/CD pipeline costs
        SPRINT,   // 0.10 ETH  – 1 week of infrastructure
        CHAMPION, // 1.00 ETH  – 1 month of full operations
        CUSTOM    // Any non-zero amount chosen by the tipper
    }

    /// @notice A single recorded tip.
    struct Tip {
        address tipper;    // address(0) when anonymous
        uint256 amount;
        Tier    tier;
        bool    anonymous;
        string  message;
        uint256 timestamp;
    }

    // -------------------------------------------------------------------------
    // Constants – Tier amounts
    // -------------------------------------------------------------------------

    uint256 public constant COFFEE_AMOUNT   = 0.01 ether;
    uint256 public constant SPRINT_AMOUNT   = 0.10 ether;
    uint256 public constant CHAMPION_AMOUNT = 1.00 ether;

    // -------------------------------------------------------------------------
    // Constants – Tier descriptions
    // -------------------------------------------------------------------------

    string public constant COFFEE_DESC   = "Funds 1 hour of CI/CD pipeline costs";
    string public constant SPRINT_DESC   = "Funds 1 week of infrastructure";
    string public constant CHAMPION_DESC = "Funds 1 month of full operations";

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Address that receives all tip funds.
    address payable public treasury;

    /// @notice Chronological history of all tips.
    Tip[] private _tips;

    /// @notice Cumulative ETH tipped by each address (non-anonymous contributions only).
    mapping(address => uint256) public totalTippedBy;

    /// @notice Total ETH raised through this contract.
    uint256 public totalRaised;

    /// @dev Tracks unique non-anonymous tipper addresses for getTopTippers.
    address[] private _uniqueTippers;
    mapping(address => bool) private _isTipper;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TipReceived(
        address indexed tipper,
        uint256         amount,
        Tier            tier,
        string          message,
        bool            anonymous
    );

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error WrongTierAmount(Tier tier, uint256 required, uint256 sent);
    error CustomAmountZero();
    error ZeroAddress();
    error TransferFailed();
    error InvalidTier();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _treasury     Address that receives all forwarded tip funds.
    /// @param initialOwner  Owner address (can update treasury).
    constructor(address payable _treasury, address initialOwner) Ownable(initialOwner) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    // -------------------------------------------------------------------------
    // External – Tipping
    // -------------------------------------------------------------------------

    /// @notice Send a tip in the specified tier.
    /// @dev    For COFFEE/SPRINT/CHAMPION, msg.value must equal the exact tier
    ///         amount. For CUSTOM, msg.value must be greater than zero.
    /// @param tier      One of the Tier enum values.
    /// @param message   Optional free-text message from the tipper.
    /// @param anon      If true, the tipper's address is not recorded or emitted.
    function tip(Tier tier, string calldata message, bool anon)
        external
        payable
        nonReentrant
    {
        if (tier == Tier.COFFEE) {
            if (msg.value != COFFEE_AMOUNT) {
                revert WrongTierAmount(Tier.COFFEE, COFFEE_AMOUNT, msg.value);
            }
        } else if (tier == Tier.SPRINT) {
            if (msg.value != SPRINT_AMOUNT) {
                revert WrongTierAmount(Tier.SPRINT, SPRINT_AMOUNT, msg.value);
            }
        } else if (tier == Tier.CHAMPION) {
            if (msg.value != CHAMPION_AMOUNT) {
                revert WrongTierAmount(Tier.CHAMPION, CHAMPION_AMOUNT, msg.value);
            }
        } else if (tier == Tier.CUSTOM) {
            if (msg.value == 0) revert CustomAmountZero();
        } else {
            revert InvalidTier();
        }

        address tipperAddr = anon ? address(0) : msg.sender;

        _tips.push(Tip({
            tipper:    tipperAddr,
            amount:    msg.value,
            tier:      tier,
            anonymous: anon,
            message:   message,
            timestamp: block.timestamp
        }));

        totalRaised += msg.value;

        if (!anon) {
            totalTippedBy[msg.sender] += msg.value;
            if (!_isTipper[msg.sender]) {
                _isTipper[msg.sender] = true;
                _uniqueTippers.push(msg.sender);
            }
        }

        emit TipReceived(tipperAddr, msg.value, tier, message, anon);

        (bool success, ) = treasury.call{value: msg.value}("");
        if (!success) revert TransferFailed();
    }

    // -------------------------------------------------------------------------
    // External – Admin
    // -------------------------------------------------------------------------

    /// @notice Update the treasury address that receives all future tips.
    /// @param newTreasury New treasury address; must be non-zero.
    function updateTreasury(address payable newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        address old = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(old, newTreasury);
    }

    // -------------------------------------------------------------------------
    // External – Views
    // -------------------------------------------------------------------------

    /// @notice Returns the fixed ETH amount for a given tier.
    /// @dev    Returns 0 for CUSTOM (no fixed amount).
    function getTierAmount(Tier tier) external pure returns (uint256) {
        if (tier == Tier.COFFEE)   return COFFEE_AMOUNT;
        if (tier == Tier.SPRINT)   return SPRINT_AMOUNT;
        if (tier == Tier.CHAMPION) return CHAMPION_AMOUNT;
        return 0; // CUSTOM
    }

    /// @notice Returns the human-readable description for a given tier.
    function getTierDescription(Tier tier) external pure returns (string memory) {
        if (tier == Tier.COFFEE)   return COFFEE_DESC;
        if (tier == Tier.SPRINT)   return SPRINT_DESC;
        if (tier == Tier.CHAMPION) return CHAMPION_DESC;
        return "Custom amount chosen by tipper";
    }

    /// @notice Returns the full tip history array.
    function getTipHistory() external view returns (Tip[] memory) {
        return _tips;
    }

    /// @notice Returns the top `n` non-anonymous tippers by cumulative contribution.
    /// @dev    Uses a partial selection sort; intended for off-chain/view calls only.
    /// @param n  Maximum number of results to return.
    /// @return tippers  Addresses of the top tippers (descending by amount).
    /// @return amounts  Corresponding cumulative amounts in wei.
    function getTopTippers(uint256 n)
        external
        view
        returns (address[] memory tippers, uint256[] memory amounts)
    {
        uint256 total = _uniqueTippers.length;
        uint256 resultLen = n < total ? n : total;

        // Build working copies to avoid mutating storage reads
        address[] memory addrs  = new address[](total);
        uint256[] memory amts   = new uint256[](total);
        for (uint256 i = 0; i < total; i++) {
            addrs[i] = _uniqueTippers[i];
            amts[i]  = totalTippedBy[_uniqueTippers[i]];
        }

        // Partial selection sort – O(resultLen * total)
        for (uint256 i = 0; i < resultLen; i++) {
            uint256 maxIdx = i;
            for (uint256 j = i + 1; j < total; j++) {
                if (amts[j] > amts[maxIdx]) maxIdx = j;
            }
            if (maxIdx != i) {
                (addrs[i], addrs[maxIdx]) = (addrs[maxIdx], addrs[i]);
                (amts[i],  amts[maxIdx])  = (amts[maxIdx],  amts[i]);
            }
        }

        tippers = new address[](resultLen);
        amounts = new uint256[](resultLen);
        for (uint256 i = 0; i < resultLen; i++) {
            tippers[i] = addrs[i];
            amounts[i] = amts[i];
        }
    }
}
