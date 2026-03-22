import type { AgentStatus, TreasuryData, Contributor, ActivityEvent, Task, EscrowInfo } from './types'

export const mockAgents: AgentStatus[] = [
  {
    id: 'agent-001',
    name: 'PR Reviewer',
    status: 'idle',
    lastAction: 'Reviewed libp2p/go-libp2p#2847 — approved merge after security analysis',
    lastRun: '2026-03-22T14:32:00Z',
    nextRun: '2026-03-22T15:00:00Z',
    actionsToday: 14,
    tokenId: 1,
    color: '#a855f7',
    icon: '🔍'
  },
  {
    id: 'agent-002',
    name: 'Issue Triager',
    status: 'running',
    lastAction: 'Triaging issue #3901: yamux stream reset causes goroutine leak on high-throughput',
    lastRun: '2026-03-22T14:55:00Z',
    nextRun: '2026-03-22T15:30:00Z',
    actionsToday: 27,
    tokenId: 2,
    color: '#f59e0b',
    icon: '🗂️'
  },
  {
    id: 'agent-003',
    name: 'Release Manager',
    status: 'idle',
    lastAction: 'Drafted changelog for go-libp2p v0.38.2 — 8 bugfixes, 2 performance improvements',
    lastRun: '2026-03-22T12:00:00Z',
    nextRun: '2026-03-22T18:00:00Z',
    actionsToday: 5,
    tokenId: 3,
    color: '#22c55e',
    icon: '🚀'
  },
  {
    id: 'agent-004',
    name: 'Security Monitor',
    status: 'idle',
    lastAction: 'Scanned 3 new dependencies — no CVEs found, SBOM updated on-chain',
    lastRun: '2026-03-22T14:00:00Z',
    nextRun: '2026-03-22T16:00:00Z',
    actionsToday: 9,
    tokenId: 4,
    color: '#3b82f6',
    icon: '🔐'
  },
  {
    id: 'agent-005',
    name: 'Docs Writer',
    status: 'idle',
    lastAction: 'Updated hole-punching tutorial — added NAT traversal troubleshooting section',
    lastRun: '2026-03-22T13:45:00Z',
    nextRun: '2026-03-22T17:00:00Z',
    actionsToday: 7,
    tokenId: 5,
    color: '#f97316',
    icon: '📝'
  }
]

export const mockTreasury: TreasuryData = {
  balance: '2.5 ETH',
  yieldBalance: '0.15 ETH',
  totalRaised: '12.3 ETH',
  apy: '5.2%',
  monthlyBurn: '0.42 ETH',
  runway: '7.1 months',
  spendingHistory: [
    { date: 'Oct 2025', amount: 0.38, category: 'OPERATIONAL', description: 'LLM inference costs for agent swarm' },
    { date: 'Oct 2025', amount: 0.12, category: 'INFRASTRUCTURE', description: 'RPC node + IPFS pinning services' },
    { date: 'Nov 2025', amount: 0.41, category: 'OPERATIONAL', description: 'LLM inference — volume increase' },
    { date: 'Nov 2025', amount: 0.15, category: 'AUDIT', description: 'Smart contract security review (partial)' },
    { date: 'Nov 2025', amount: 0.09, category: 'INFRASTRUCTURE', description: 'Monitoring stack + alerting' },
    { date: 'Dec 2025', amount: 0.44, category: 'OPERATIONAL', description: 'LLM inference — holiday surge' },
    { date: 'Dec 2025', amount: 0.20, category: 'AUDIT', description: 'Smart contract security review (final)' },
    { date: 'Dec 2025', amount: 0.11, category: 'INFRASTRUCTURE', description: 'Redundant RPC endpoints added' },
    { date: 'Jan 2026', amount: 0.40, category: 'OPERATIONAL', description: 'LLM inference — stable month' },
    { date: 'Jan 2026', amount: 0.13, category: 'INFRASTRUCTURE', description: 'Storage expansion for SBOM archive' },
    { date: 'Feb 2026', amount: 0.43, category: 'OPERATIONAL', description: 'LLM inference costs' },
    { date: 'Feb 2026', amount: 0.10, category: 'INFRASTRUCTURE', description: 'CI pipeline optimization' },
    { date: 'Mar 2026', amount: 0.39, category: 'OPERATIONAL', description: 'LLM inference — current month' },
    { date: 'Mar 2026', amount: 0.08, category: 'INFRASTRUCTURE', description: 'Cloud infra — current month' },
    { date: 'Mar 2026', amount: 0.05, category: 'AUDIT', description: 'Ongoing security retainer' }
  ]
}

export const mockContributors: Contributor[] = [
  {
    rank: 1,
    githubHandle: 'mxinden',
    score: 924,
    badges: ['Core Maintainer', 'Security Reviewer', 'Release Lead', '100 PRs'],
    contributions: 312,
    address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
  },
  {
    rank: 2,
    githubHandle: 'thomaseizinger',
    score: 871,
    badges: ['Core Maintainer', 'Protocol Designer', '50 PRs'],
    contributions: 278,
    address: '0x1234567890abcdef1234567890abcdef12345678'
  },
  {
    rank: 3,
    githubHandle: 'elenaf9',
    score: 803,
    badges: ['Security Reviewer', 'Docs Champion', '50 PRs'],
    contributions: 204,
    address: '0xabcdef1234567890abcdef1234567890abcdef12'
  },
  {
    rank: 4,
    githubHandle: 'diegomrsantos',
    score: 715,
    badges: ['Protocol Designer', '25 PRs'],
    contributions: 167,
    address: '0xfedcba9876543210fedcba9876543210fedcba98'
  },
  {
    rank: 5,
    githubHandle: 'koivunej',
    score: 634,
    badges: ['Bug Hunter', '25 PRs'],
    contributions: 143,
    address: '0x1111222233334444555566667777888899990000'
  },
  {
    rank: 6,
    githubHandle: 'ckousoulis',
    score: 502,
    badges: ['Docs Champion', 'First PR'],
    contributions: 98,
    address: '0xaaaa1111bbbb2222cccc3333dddd4444eeee5555'
  },
  {
    rank: 7,
    githubHandle: 'p0n1',
    score: 287,
    badges: ['Bug Hunter'],
    contributions: 54,
    address: '0x9999888877776666555544443333222211110000'
  },
  {
    rank: 8,
    githubHandle: 'hunjixin',
    score: 124,
    badges: ['First PR'],
    contributions: 21,
    address: '0x0000111122223333444455556666777788889999'
  }
]

const now = new Date('2026-03-22T14:58:00Z')
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000).toISOString()

export const mockActivity: ActivityEvent[] = [
  {
    id: 'evt-001',
    timestamp: minutesAgo(2),
    agentName: 'Issue Triager',
    agentColor: '#f59e0b',
    action: 'Labeled and assigned issue',
    details: 'go-libp2p#3901: yamux goroutine leak → priority:high, area:yamux, help-wanted',
    txHash: '0x4a2b8c1d9e3f7a6b2c4d8e1f3a7b9c2d4e6f8a1b'
  },
  {
    id: 'evt-002',
    timestamp: minutesAgo(7),
    agentName: 'PR Reviewer',
    agentColor: '#a855f7',
    action: 'Approved pull request',
    details: 'go-libp2p#2847: fix: prevent double-close on swarm connections',
    txHash: '0x7f3e1a2b4c8d6e9f1a3b5c7d9e2f4a6b8c1d3e5f'
  },
  {
    id: 'evt-003',
    timestamp: minutesAgo(12),
    agentName: 'Security Monitor',
    agentColor: '#3b82f6',
    action: 'Dependency scan completed',
    details: 'Scanned go-libp2p v0.38.2 deps — 47 packages, 0 CVEs, SBOM pinned to IPFS',
    txHash: '0x2c4e6a8b1d3f5a7c9e2b4d6f8a1c3e5b7d9f2a4c'
  },
  {
    id: 'evt-004',
    timestamp: minutesAgo(18),
    agentName: 'Docs Writer',
    agentColor: '#f97316',
    action: 'Documentation PR opened',
    details: 'docs: add comprehensive NAT traversal troubleshooting guide (#2901)',
  },
  {
    id: 'evt-005',
    timestamp: minutesAgo(24),
    agentName: 'PR Reviewer',
    agentColor: '#a855f7',
    action: 'Requested changes on pull request',
    details: 'go-libp2p#2851: needs additional test coverage for connection manager edge cases',
  },
  {
    id: 'evt-006',
    timestamp: minutesAgo(31),
    agentName: 'Release Manager',
    agentColor: '#22c55e',
    action: 'Changelog drafted',
    details: 'go-libp2p v0.38.2 release notes prepared — 8 fixes, 2 perf improvements, 1 breaking change noted',
    txHash: '0x8b1d4f7a2e5c9b3f6a1d4e8c2b5f9a3d7e1c4b8f'
  },
  {
    id: 'evt-007',
    timestamp: minutesAgo(38),
    agentName: 'Issue Triager',
    agentColor: '#f59e0b',
    action: 'Closed stale issue',
    details: 'go-libp2p#3654: no activity in 90 days, issue predates v0.36.0 fix',
  },
  {
    id: 'evt-008',
    timestamp: minutesAgo(45),
    agentName: 'Security Monitor',
    agentColor: '#3b82f6',
    action: 'Alert dispatched',
    details: 'New advisory GHSA-xxxx-yyyy-zzzz affects noise-protocol — patched in v0.6.1, notifying maintainers',
    txHash: '0x1a3c5e7b9d2f4a6c8e1b3d5f7a9c2e4b6d8f1a3c'
  },
  {
    id: 'evt-009',
    timestamp: minutesAgo(53),
    agentName: 'Docs Writer',
    agentColor: '#f97316',
    action: 'API reference updated',
    details: 'Updated Host interface docs to reflect v0.38.x changes to Connect() signature',
  },
  {
    id: 'evt-010',
    timestamp: minutesAgo(61),
    agentName: 'PR Reviewer',
    agentColor: '#a855f7',
    action: 'Reviewed and merged',
    details: 'go-libp2p#2844: feat: expose per-protocol bandwidth stats in ResourceManager',
    txHash: '0x5d7f9b2e4c6a8d1f3b5e7a9c2d4f6b8e1a3c5d7f'
  },
  {
    id: 'evt-011',
    timestamp: minutesAgo(70),
    agentName: 'Issue Triager',
    agentColor: '#f59e0b',
    action: 'Cross-repo issue linked',
    details: 'go-libp2p#3899 linked to rust-libp2p#4201 — same yamux framing bug, tracking in both repos',
  },
  {
    id: 'evt-012',
    timestamp: minutesAgo(79),
    agentName: 'Release Manager',
    agentColor: '#22c55e',
    action: 'Milestone closed',
    details: 'go-libp2p v0.38.1 milestone 100% complete — triggered release pipeline',
    txHash: '0x3e5a7c9f2b4d6e8a1c3f5b7d9e2a4c6f8b1d3e5a'
  },
  {
    id: 'evt-013',
    timestamp: minutesAgo(88),
    agentName: 'Security Monitor',
    agentColor: '#3b82f6',
    action: 'Audit report published',
    details: 'Q1 2026 security audit summary posted to governance forum — 0 critical, 2 low severity findings',
    txHash: '0x9c2e4a6b8d1f3c5e7a9b2d4f6a8c1e3b5d7f9a2c'
  },
  {
    id: 'evt-014',
    timestamp: minutesAgo(97),
    agentName: 'PR Reviewer',
    agentColor: '#a855f7',
    action: 'Auto-assigned reviewer',
    details: 'go-libp2p#2856: refactor: simplify identify protocol handler — assigned to @mxinden based on CODEOWNERS',
  },
  {
    id: 'evt-015',
    timestamp: minutesAgo(112),
    agentName: 'Docs Writer',
    agentColor: '#f97316',
    action: 'Tutorial published',
    details: 'New "Building with libp2p in 2026" getting-started guide live on docs.libp2p.io',
    txHash: '0x6a8c1e3b5d7f9a2c4e6b8d1f3a5c7e9b2d4f6a8c'
  }
]

export const mockTasks: Task[] = [
  {
    id: 'task-001',
    title: 'Fix typo in identify protocol documentation',
    description: 'The identify protocol docs have a typo in the "Signed Peer Records" section. Fix and submit a PR to libp2p/specs.',
    difficulty: 'easy',
    reward: '0.005 ETH',
    claimed: false,
    repo: 'libp2p/specs'
  },
  {
    id: 'task-002',
    title: 'Add missing error codes to go-libp2p README',
    description: 'Several new error codes introduced in v0.37.0 are not documented in the README troubleshooting section.',
    difficulty: 'easy',
    reward: '0.005 ETH',
    claimed: true,
    repo: 'libp2p/go-libp2p'
  },
  {
    id: 'task-003',
    title: 'Write unit tests for AutoNAT v2 state machine',
    description: 'AutoNAT v2 was merged but test coverage is at 61%. Add tests covering the probe timeout and reachability flap scenarios.',
    difficulty: 'medium',
    reward: '0.02 ETH',
    claimed: false,
    repo: 'libp2p/go-libp2p'
  },
  {
    id: 'task-004',
    title: 'Benchmark yamux vs mplex throughput regression',
    description: 'Users report yamux throughput degraded ~15% between v0.36 and v0.38. Profile and identify the regression commit.',
    difficulty: 'medium',
    reward: '0.03 ETH',
    claimed: true,
    repo: 'libp2p/go-yamux'
  },
  {
    id: 'task-005',
    title: 'Implement connection gating in browser-transport',
    description: 'The WebTransport browser implementation does not respect the ConnectionGater interface. Implement gating support matching the TCP transport behavior.',
    difficulty: 'medium',
    reward: '0.025 ETH',
    claimed: false,
    repo: 'libp2p/js-libp2p'
  },
  {
    id: 'task-006',
    title: 'Fix goroutine leak on yamux stream reset under load',
    description: 'Under high-concurrency conditions (>500 concurrent streams), yamux stream reset does not properly drain the readBuffer goroutine. Tracked in #3901.',
    difficulty: 'hard',
    reward: '0.08 ETH',
    claimed: false,
    repo: 'libp2p/go-yamux'
  },
  {
    id: 'task-007',
    title: 'Implement peer routing via DHT in no-std Rust',
    description: 'rust-libp2p currently requires std for Kademlia DHT peer routing. Implement a no-std compatible routing table for embedded and WASM targets.',
    difficulty: 'hard',
    reward: '0.1 ETH',
    claimed: false,
    repo: 'libp2p/rust-libp2p'
  },
  {
    id: 'task-008',
    title: 'Design and implement libp2p protocol negotiation v2',
    description: 'The current multistream-select protocol has known latency issues on high-latency links. Design a backwards-compatible v2 that reduces round-trips from 2 to 1 for the common case.',
    difficulty: 'expert',
    reward: '0.5 ETH',
    claimed: false,
    repo: 'libp2p/specs'
  }
]

export const mockEscrows: EscrowInfo[] = [
  {
    id: 'escrow-001',
    feature: 'WebRTC browser-to-server connection pooling',
    amount: '0.25 ETH',
    state: 'FUNDED',
    deadline: '2026-04-15'
  },
  {
    id: 'escrow-002',
    feature: 'QUIC v2 transport implementation for go-libp2p',
    amount: '0.5 ETH',
    state: 'IN_PROGRESS',
    deadline: '2026-05-01'
  }
]
