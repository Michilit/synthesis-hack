// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IERC8004 - Identity Registry Interface for AI Agents
/// @notice ERC-8004 defines a standard for on-chain AI agent identity cards,
///         allowing agents to register capabilities, service endpoints, and
///         payment addresses in a soulbound token registry.
interface IERC8004 {
    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    /// @notice On-chain identity card for a registered AI agent.
    /// @param name             Human-readable agent name.
    /// @param capabilities     Array of capability descriptors (e.g. "code-review", "triage").
    /// @param serviceEndpoints Array of URL/IRI endpoints where the agent is reachable.
    /// @param paymentAddress   Address that receives payments on behalf of this agent.
    /// @param metadataURI      URI pointing to off-chain extended metadata (IPFS/Arweave).
    struct AgentCard {
        string   name;
        string[] capabilities;
        string[] serviceEndpoints;
        address  paymentAddress;
        string   metadataURI;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a new agent is registered and a token is minted.
    /// @param tokenId  The newly minted identity token ID.
    /// @param owner    The address that owns this identity token.
    /// @param name     The agent's human-readable name.
    event AgentRegistered(uint256 indexed tokenId, address indexed owner, string name);

    /// @notice Emitted when an existing agent's card metadata is updated.
    /// @param tokenId  The identity token ID whose card was updated.
    event AgentCardUpdated(uint256 indexed tokenId);

    // -------------------------------------------------------------------------
    // Write Functions
    // -------------------------------------------------------------------------

    /// @notice Register a new agent identity on-chain.
    /// @dev    Mints a soulbound token to msg.sender. Each address may only hold
    ///         one identity token; a second call MUST revert.
    /// @param  card    The AgentCard struct containing all identity metadata.
    /// @return tokenId The ID of the newly minted identity token.
    function registerAgent(AgentCard calldata card) external returns (uint256 tokenId);

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    /// @notice Retrieve the full identity card for a given token.
    /// @param  tokenId The identity token ID to query.
    /// @return         The AgentCard struct stored for that token.
    function getAgentCard(uint256 tokenId) external view returns (AgentCard memory);

    /// @notice Look up the token ID owned by a specific address.
    /// @dev    Returns 0 if the address has not registered an agent.
    ///         Token IDs start at 1, so 0 is an unambiguous "not found" sentinel.
    /// @param  owner   The address to query.
    /// @return         The token ID owned by `owner`, or 0 if none.
    function getTokenIdByOwner(address owner) external view returns (uint256);

    /// @notice Verify that a token ID represents a valid, active agent registration.
    /// @dev    Returns false for token ID 0, burnt tokens, or revoked registrations.
    /// @param  tokenId The identity token ID to verify.
    /// @return valid   True if the agent is currently valid and active.
    function verifyAgent(uint256 tokenId) external view returns (bool valid);
}
