// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IERC8004.sol";

/// @title ERC8004Registry
/// @notice Soulbound (non-transferable) ERC-721 registry for AI agent identity cards.
///         One token per address.  Implements the IERC8004 interface.
contract ERC8004Registry is ERC721, Ownable, IERC8004 {

    // -------------------------------------------------------------------------
    // Enums
    // -------------------------------------------------------------------------

    enum AgentType { MAINTAINER, TREASURY, COMMUNITY, SUPPORT, REVIEW }

    // -------------------------------------------------------------------------
    // Extended AgentCard (registry-internal; richer than the interface struct)
    // -------------------------------------------------------------------------

    struct RegistryAgentCard {
        string    name;
        string[]  capabilities;
        string    serviceEndpoint;
        address   paymentAddress;
        AgentType agentType;
        bool      isActive;
        uint256   registeredAt;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    uint256 private _nextTokenId = 1;

    // tokenId => rich card
    mapping(uint256 => RegistryAgentCard) private _cards;

    // address => tokenId (0 = not registered)
    mapping(address => uint256) private _ownerToTokenId;

    // -------------------------------------------------------------------------
    // Events (satisfies IERC8004 + extras)
    // -------------------------------------------------------------------------

    // AgentRegistered and AgentCardUpdated are declared in IERC8004

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor() ERC721("DPI Guardian Agent", "DPIGA") Ownable(msg.sender) {}

    // -------------------------------------------------------------------------
    // Registration
    // -------------------------------------------------------------------------

    /// @notice Register an agent using the rich registry card format.
    function registerAgent(
        string   calldata name,
        string[] calldata capabilities,
        string   calldata serviceEndpoint,
        address           paymentAddress,
        AgentType         agentType
    )
        external
        returns (uint256 tokenId)
    {
        require(_ownerToTokenId[msg.sender] == 0, "ERC8004Registry: already registered");
        require(bytes(name).length > 0,            "ERC8004Registry: empty name");
        require(paymentAddress != address(0),      "ERC8004Registry: zero payment address");

        tokenId = _nextTokenId++;
        _ownerToTokenId[msg.sender] = tokenId;

        _cards[tokenId] = RegistryAgentCard({
            name:            name,
            capabilities:    capabilities,
            serviceEndpoint: serviceEndpoint,
            paymentAddress:  paymentAddress,
            agentType:       agentType,
            isActive:        true,
            registeredAt:    block.timestamp
        });

        _safeMint(msg.sender, tokenId);

        emit AgentRegistered(tokenId, msg.sender, name);
    }

    // IERC8004 interface shim – maps interface AgentCard to rich card
    function registerAgent(AgentCard calldata card) external override returns (uint256 tokenId) {
        require(_ownerToTokenId[msg.sender] == 0, "ERC8004Registry: already registered");
        require(bytes(card.name).length > 0,       "ERC8004Registry: empty name");
        require(card.paymentAddress != address(0), "ERC8004Registry: zero payment address");

        tokenId = _nextTokenId++;
        _ownerToTokenId[msg.sender] = tokenId;

        _cards[tokenId] = RegistryAgentCard({
            name:            card.name,
            capabilities:    card.capabilities,
            serviceEndpoint: card.serviceEndpoint,
            paymentAddress:  card.paymentAddress,
            agentType:       AgentType.MAINTAINER, // default; use rich registration to specify
            isActive:        true,
            registeredAt:    block.timestamp
        });

        _safeMint(msg.sender, tokenId);

        emit AgentRegistered(tokenId, msg.sender, card.name);
    }

    // -------------------------------------------------------------------------
    // Update
    // -------------------------------------------------------------------------

    /// @notice Update a rich registry card.  Only the token owner may call this.
    function updateAgentCard(
        uint256           tokenId,
        string   calldata name,
        string[] calldata capabilities,
        string   calldata serviceEndpoint,
        address           paymentAddress,
        AgentType         agentType,
        bool              isActive
    ) external {
        require(ownerOf(tokenId) == msg.sender, "ERC8004Registry: not token owner");
        require(bytes(name).length > 0,          "ERC8004Registry: empty name");
        require(paymentAddress != address(0),    "ERC8004Registry: zero payment address");

        RegistryAgentCard storage c = _cards[tokenId];
        c.name            = name;
        c.capabilities    = capabilities;
        c.serviceEndpoint = serviceEndpoint;
        c.paymentAddress  = paymentAddress;
        c.agentType       = agentType;
        c.isActive        = isActive;

        emit AgentCardUpdated(tokenId);
    }

    // IERC8004 interface shim
    function updateAgentCard(uint256 tokenId, AgentCard calldata card) external override {
        require(ownerOf(tokenId) == msg.sender, "ERC8004Registry: not token owner");
        require(bytes(card.name).length > 0,     "ERC8004Registry: empty name");
        require(card.paymentAddress != address(0), "ERC8004Registry: zero payment address");

        RegistryAgentCard storage c = _cards[tokenId];
        c.name            = card.name;
        c.capabilities    = card.capabilities;
        c.serviceEndpoint = card.serviceEndpoint;
        c.paymentAddress  = card.paymentAddress;

        emit AgentCardUpdated(tokenId);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Returns the IERC8004 interface AgentCard view.
    function getAgentCard(uint256 tokenId) external view override returns (AgentCard memory) {
        require(_ownerOf(tokenId) != address(0), "ERC8004Registry: token does not exist");
        RegistryAgentCard storage c = _cards[tokenId];
        return AgentCard({
            name:            c.name,
            capabilities:    c.capabilities,
            serviceEndpoint: c.serviceEndpoint,
            paymentAddress:  c.paymentAddress
        });
    }

    /// @notice Returns the full rich card.
    function getFullAgentCard(uint256 tokenId) external view returns (RegistryAgentCard memory) {
        require(_ownerOf(tokenId) != address(0), "ERC8004Registry: token does not exist");
        return _cards[tokenId];
    }

    function getTokenIdByOwner(address owner) external view override returns (uint256) {
        return _ownerToTokenId[owner];
    }

    function verifyAgent(uint256 tokenId) external view override returns (bool) {
        if (tokenId == 0)                        return false;
        if (_ownerOf(tokenId) == address(0))     return false;
        return _cards[tokenId].isActive;
    }

    function verifyAgent(address agent) external view returns (bool) {
        uint256 tokenId = _ownerToTokenId[agent];
        if (tokenId == 0) return false;
        return _cards[tokenId].isActive;
    }

    // -------------------------------------------------------------------------
    // Soulbound – disable all transfers
    // -------------------------------------------------------------------------

    function transferFrom(address, address, uint256) public pure override {
        revert("ERC8004Registry: soulbound - transfer disabled");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert("ERC8004Registry: soulbound - transfer disabled");
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Owner can deactivate a misbehaving agent.
    function deactivateAgent(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "ERC8004Registry: token does not exist");
        _cards[tokenId].isActive = false;
        emit AgentCardUpdated(tokenId);
    }

    function totalRegistered() external view returns (uint256) { return _nextTokenId - 1; }
}
