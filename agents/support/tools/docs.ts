/**
 * libp2p documentation search tool (mock)
 */

export interface DocResult {
  path: string;
  title: string;
  excerpt: string;
  relevance: number;
}

const MOCK_DOCS: DocResult[] = [
  { path: '/docs/getting-started', title: 'Getting Started with libp2p', excerpt: 'Learn how to create your first libp2p node with peer discovery and transport configuration.', relevance: 0 },
  { path: '/docs/concepts/peer-id', title: 'Peer Identity (PeerId)', excerpt: 'Every libp2p node has a unique PeerId derived from a cryptographic key pair. This identity is used for all communications.', relevance: 0 },
  { path: '/docs/concepts/transports', title: 'Transports', excerpt: 'libp2p supports TCP, WebSockets, QUIC, WebRTC, and more. Configure multiple transports for maximum connectivity.', relevance: 0 },
  { path: '/docs/concepts/pubsub', title: 'Publish-Subscribe (GossipSub)', excerpt: 'GossipSub is the default pub/sub implementation in libp2p. Used by Ethereum for consensus message propagation.', relevance: 0 },
  { path: '/docs/concepts/kad-dht', title: 'Kademlia DHT', excerpt: 'The Kademlia DHT provides content routing and peer discovery. Used by IPFS for content addressing.', relevance: 0 },
  { path: '/docs/guides/circuit-relay', title: 'Circuit Relay v2', excerpt: 'Circuit relay enables communication between peers behind NATs. Configure relay nodes for improved connectivity.', relevance: 0 },
  { path: '/docs/guides/security', title: 'Security and Noise Protocol', excerpt: 'All libp2p connections are encrypted using the Noise protocol by default. TLS 1.3 is also supported.', relevance: 0 },
  { path: '/docs/api/node', title: 'Libp2p Node API', excerpt: 'Complete API reference for creating and managing libp2p nodes programmatically.', relevance: 0 },
  { path: '/docs/guides/interop', title: 'Cross-implementation Interoperability', excerpt: 'Go, Rust, and JavaScript implementations must maintain protocol compatibility. Run the interop test suite to verify.', relevance: 0 },
  { path: '/docs/guides/debugging', title: 'Debugging Connection Issues', excerpt: 'Common libp2p connection issues and how to diagnose them using debug logging and protocol inspectors.', relevance: 0 },
];

const KEYWORDS: Record<string, string[]> = {
  '/docs/getting-started': ['start', 'install', 'hello', 'first', 'setup', 'begin'],
  '/docs/concepts/peer-id': ['peer', 'identity', 'peerid', 'key', 'id'],
  '/docs/concepts/transports': ['transport', 'tcp', 'quic', 'websocket', 'connect'],
  '/docs/concepts/pubsub': ['pubsub', 'gossip', 'gossipsub', 'subscribe', 'publish', 'topic'],
  '/docs/concepts/kad-dht': ['dht', 'discovery', 'routing', 'kademlia', 'find'],
  '/docs/guides/circuit-relay': ['relay', 'nat', 'firewall', 'traversal'],
  '/docs/guides/security': ['security', 'noise', 'tls', 'encrypt', 'auth'],
  '/docs/api/node': ['api', 'node', 'createnode', 'method'],
  '/docs/guides/interop': ['interop', 'compatibility', 'go', 'rust', 'js', 'sync'],
  '/docs/guides/debugging': ['debug', 'error', 'connection', 'fail', 'issue', 'problem'],
};

export class DocsTool {
  async search(query: string): Promise<DocResult[]> {
    const words = query.toLowerCase().split(/\s+/);
    return MOCK_DOCS.map(doc => {
      const docKeywords = KEYWORDS[doc.path] || [];
      const matches = words.filter(w => docKeywords.some(k => k.includes(w) || w.includes(k))).length;
      return { ...doc, relevance: matches };
    })
    .filter(d => d.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5);
  }

  async getSection(docPath: string): Promise<string> {
    const doc = MOCK_DOCS.find(d => d.path === docPath);
    if (!doc) return `Documentation not found for path: ${docPath}`;
    return `# ${doc.title}\n\n${doc.excerpt}\n\n[Full documentation available at https://docs.libp2p.io${docPath}]`;
  }
}
