// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IERC8004
/// @notice Interface for ERC-8004: on-chain AI agent identity registry.
///         Tokens are soulbound (non-transferable).  One token per address.
interface IERC8004 {

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    /// @notice Portable agent card returned by view functions and accepted by write functions.
    struct AgentCard {
        string   name;
        string[] capabilities;
        string   serviceEndpoint;
        address  paymentAddress;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a new agent is registered and its soulbound token is minted.
    /// @param tokenId  Newly minted token ID (starts at 1; 0 is the unregistered sentinel).
    /// @param owner    Address that now owns the token.
    /// @param name     Human-readable agent name.
    event AgentRegistered(uint256 indexed tokenId, address indexed owner, string name);

    /// @notice Emitted when an agent updates its card metadata.
    /// @param tokenId  Token whose card was updated.
    event AgentCardUpdated(uint256 indexed tokenId);

    // -------------------------------------------------------------------------
    // Write
    // -------------------------------------------------------------------------

    /// @notice Register a new agent identity.
    /// @dev    Mints a soulbound token to msg.sender.  Reverts if the caller already
    ///         holds a token (one-per-address enforcement).
    /// @param  card     AgentCard with all identity metadata.
    /// @return tokenId  ID of the newly minted token.
    function registerAgent(AgentCard calldata card) external returns (uint256 tokenId);

    /// @notice Update an existing agent card.
    /// @dev    Only the token owner may call this.
    /// @param  tokenId  Token to update.
    /// @param  card     Replacement AgentCard.
    function updateAgentCard(uint256 tokenId, AgentCard calldata card) external;

    // -------------------------------------------------------------------------
    // Read
    // -------------------------------------------------------------------------

    /// @notice Retrieve the portable card for a given token.
    /// @param  tokenId  Token to query.
    /// @return          AgentCard stored for that token.
    function getAgentCard(uint256 tokenId) external view returns (AgentCard memory);

    /// @notice Look up the token ID owned by a specific address.
    /// @dev    Returns 0 if the address has not registered.
    /// @param  owner    Address to query.
    /// @return          Token ID, or 0 if not registered.
    function getTokenIdByOwner(address owner) external view returns (uint256);

    /// @notice Check whether a token represents a currently active registration.
    /// @dev    Returns false for token ID 0, non-existent tokens, or deactivated agents.
    /// @param  tokenId  Token to verify.
    /// @return valid    True if the agent is active and valid.
    function verifyAgent(uint256 tokenId) external view returns (bool valid);
}
