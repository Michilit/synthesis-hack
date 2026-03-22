// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IERC8004.sol";

/// @title ERC8004Registry - On-chain AI Agent Identity Registry
/// @notice ERC-721 based registry implementing IERC8004. Each address may
///         register exactly one agent identity token. Token IDs start at 1.
contract ERC8004Registry is ERC721, Ownable, IERC8004 {
    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @dev Auto-incrementing token ID counter. Starts at 1 (0 is reserved as
    ///      "no token" sentinel in _ownerToTokenId).
    uint256 private _tokenIdCounter;

    /// @notice Agent card data keyed by token ID.
    mapping(uint256 => AgentCard) private _agentCards;

    /// @notice Maps an owner address to their token ID (0 = no token).
    mapping(address => uint256) private _ownerToTokenId;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error AlreadyRegistered(address owner, uint256 existingTokenId);
    error NotTokenOwner(uint256 tokenId, address caller);
    error TokenDoesNotExist(uint256 tokenId);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param initialOwner Address that becomes the contract owner (Ownable).
    constructor(address initialOwner)
        ERC721("ERC8004 Agent Registry", "AGENT")
        Ownable(initialOwner)
    {
        _tokenIdCounter = 1;
    }

    // -------------------------------------------------------------------------
    // IERC8004 – Write
    // -------------------------------------------------------------------------

    /// @inheritdoc IERC8004
    /// @dev Reverts if msg.sender already owns a token.
    function registerAgent(AgentCard calldata card)
        external
        override
        returns (uint256 tokenId)
    {
        if (_ownerToTokenId[msg.sender] != 0) {
            revert AlreadyRegistered(msg.sender, _ownerToTokenId[msg.sender]);
        }

        tokenId = _tokenIdCounter;
        unchecked { _tokenIdCounter++; }

        _safeMint(msg.sender, tokenId);
        _agentCards[tokenId] = AgentCard({
            name:             card.name,
            capabilities:     card.capabilities,
            serviceEndpoints: card.serviceEndpoints,
            paymentAddress:   card.paymentAddress,
            metadataURI:      card.metadataURI
        });
        _ownerToTokenId[msg.sender] = tokenId;

        emit AgentRegistered(tokenId, msg.sender, card.name);
    }

    /// @notice Update the agent card for an existing token.
    /// @dev    Only the token owner may update their card.
    /// @param tokenId  The token ID to update.
    /// @param card     The new agent card data.
    function updateAgentCard(uint256 tokenId, AgentCard calldata card) external {
        address owner = _requireOwned(tokenId);
        if (owner != msg.sender) revert NotTokenOwner(tokenId, msg.sender);

        _agentCards[tokenId] = AgentCard({
            name:             card.name,
            capabilities:     card.capabilities,
            serviceEndpoints: card.serviceEndpoints,
            paymentAddress:   card.paymentAddress,
            metadataURI:      card.metadataURI
        });

        emit AgentCardUpdated(tokenId);
    }

    // -------------------------------------------------------------------------
    // IERC8004 – Views
    // -------------------------------------------------------------------------

    /// @inheritdoc IERC8004
    function getAgentCard(uint256 tokenId)
        external
        view
        override
        returns (AgentCard memory)
    {
        _requireOwned(tokenId);
        return _agentCards[tokenId];
    }

    /// @inheritdoc IERC8004
    /// @dev Returns 0 if the address has not registered an agent.
    function getTokenIdByOwner(address owner)
        external
        view
        override
        returns (uint256)
    {
        return _ownerToTokenId[owner];
    }

    /// @inheritdoc IERC8004
    /// @dev Returns true when the token exists (ownerOf does not revert).
    function verifyAgent(uint256 tokenId)
        external
        view
        override
        returns (bool valid)
    {
        if (tokenId == 0) return false;
        // _ownerOf returns address(0) for non-existent tokens in OZ v5.
        return _ownerOf(tokenId) != address(0);
    }

    // -------------------------------------------------------------------------
    // ERC-721 overrides – hook into transfer to keep _ownerToTokenId in sync
    // -------------------------------------------------------------------------

    /// @dev Override _update to maintain the ownerToTokenId reverse mapping
    ///      whenever a token is minted, transferred, or burned.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = super._update(to, tokenId, auth);

        // Clear the old owner's reverse mapping (except on mint where from == address(0))
        if (from != address(0)) {
            delete _ownerToTokenId[from];
        }

        // Set the new owner's reverse mapping (except on burn where to == address(0))
        if (to != address(0)) {
            _ownerToTokenId[to] = tokenId;
        }

        return from;
    }
}
