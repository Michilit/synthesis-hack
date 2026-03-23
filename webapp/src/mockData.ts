import type {
  AgentStatus,
  TreasuryData,
  Contributor,
  ActivityEvent,
  Task,
  EscrowInfo,
} from "./types";

export const mockAgents: AgentStatus[] = [
  {
    id: "agent-001",
    name: "Maintainer Agent",
    status: "running",
    lastAction:
      "Reviewed go-libp2p#2847 — approved merge after interop + security analysis. Flagged #2851 as AI-slop (no tests, copy-paste pattern).",
    lastRun: "2026-03-22T14:55:00Z",
    nextRun: "2026-03-22T21:00:00Z",
    actionsToday: 18,
    tokenId: 1,
    color: "#a855f7",
    icon: "🔧",
  },
  {
    id: "agent-002",
    name: "Treasury Agent",
    status: "idle",
    lastAction:
      "Rebalanced portfolio: swapped 0.3 ETH → USDC (stables now 61%). Claimed 0.14 ETH from EF streaming agreement. Runway: 14.2 months.",
    lastRun: "2026-03-22T06:00:00Z",
    nextRun: "2026-03-23T06:00:00Z",
    actionsToday: 4,
    tokenId: 2,
    color: "#f59e0b",
    icon: "💰",
  },
  {
    id: "agent-003",
    name: "Community Agent",
    status: "idle",
    lastAction:
      "Weekly newsletter sent to 847 subscribers. Flagged Optimism RPGF5 grant deadline (Apr 12). Welcomed 3 new contributors to the board.",
    lastRun: "2026-03-22T09:00:00Z",
    nextRun: "2026-03-29T09:00:00Z",
    actionsToday: 6,
    tokenId: 3,
    color: "#22c55e",
    icon: "🌐",
  },
  {
    id: "agent-004",
    name: "Support Agent",
    status: "idle",
    lastAction:
      "Answered 4 developer questions about WebTransport configuration. Logged 2 DX improvement suggestions. Maintainer time this month: 23 min.",
    lastRun: "2026-03-22T14:10:00Z",
    nextRun: "2026-03-22T16:00:00Z",
    actionsToday: 11,
    tokenId: 4,
    color: "#3b82f6",
    icon: "🤝",
  },
  {
    id: "agent-005",
    name: "Review Agent",
    status: "idle",
    lastAction:
      'Scored 6 PRs: 4 approved (avg 81/100), 2 flagged as AI-slop. Issued silver "testing" badge to @elenaf9 for interop test suite contribution.',
    lastRun: "2026-03-22T14:30:00Z",
    nextRun: "2026-03-22T20:30:00Z",
    actionsToday: 9,
    tokenId: 5,
    color: "#f97316",
    icon: "✅",
  },
];

export const mockTreasury: TreasuryData = {
  balance: "3.2 ETH",
  yieldBalance: "0.22 ETH",
  totalRaised: "18.7 ETH",
  apy: "5.2%",
  monthlyBurn: "0.22 ETH",
  runway: "14.2 months",
  rwaAllocations: [
    {
      type: "ETH / Crypto",
      value: 3.2,
      valueUSD: 8000,
      pct: 30,
      color: "#a855f7",
    },
    {
      type: "Stablecoins (USDC/DAI)",
      value: 6.1,
      valueUSD: 15250,
      pct: 58,
      color: "#3b82f6",
    },
    {
      type: "Tokenized Bonds",
      value: 0.8,
      valueUSD: 2000,
      pct: 8,
      color: "#10b981",
    },
    {
      type: "Tokenized Real Estate",
      value: 0.4,
      valueUSD: 1000,
      pct: 4,
      color: "#f59e0b",
    },
  ],
  spendingHistory: [
    {
      date: "Oct 2025",
      amount: 0.38,
      category: "Agent Ops",
      description: "LLM inference costs for agent swarm",
    },
    {
      date: "Oct 2025",
      amount: 0.18,
      category: "Stewardship",
      description: "Shipyard team — Q4 milestone payment",
    },
    {
      date: "Oct 2025",
      amount: 0.12,
      category: "Infrastructure",
      description: "RPC node + IPFS pinning services",
    },
    {
      date: "Nov 2025",
      amount: 0.41,
      category: "Agent Ops",
      description: "LLM inference — volume increase",
    },
    {
      date: "Nov 2025",
      amount: 0.2,
      category: "Stewardship",
      description: "Shipyard team — November milestone",
    },
    {
      date: "Nov 2025",
      amount: 0.15,
      category: "Security Audits",
      description: "Smart contract security review (partial)",
    },
    {
      date: "Nov 2025",
      amount: 0.09,
      category: "Infrastructure",
      description: "Monitoring stack + alerting",
    },
    {
      date: "Dec 2025",
      amount: 0.44,
      category: "Agent Ops",
      description: "LLM inference — holiday surge",
    },
    {
      date: "Dec 2025",
      amount: 0.22,
      category: "Stewardship",
      description: "Shipyard team — December milestone",
    },
    {
      date: "Dec 2025",
      amount: 0.2,
      category: "Security Audits",
      description: "Smart contract security review (final)",
    },
    {
      date: "Jan 2026",
      amount: 0.4,
      category: "Agent Ops",
      description: "LLM inference — stable month",
    },
    {
      date: "Jan 2026",
      amount: 0.24,
      category: "Stewardship",
      description: "Shipyard team — Q1 milestone",
    },
    {
      date: "Jan 2026",
      amount: 0.13,
      category: "Infrastructure",
      description: "Storage expansion for SBOM archive",
    },
    {
      date: "Feb 2026",
      amount: 0.43,
      category: "Agent Ops",
      description: "LLM inference costs",
    },
    {
      date: "Feb 2026",
      amount: 0.24,
      category: "Stewardship",
      description: "Shipyard team — February milestone",
    },
    {
      date: "Feb 2026",
      amount: 0.1,
      category: "Infrastructure",
      description: "CI pipeline optimization",
    },
    {
      date: "Mar 2026",
      amount: 0.39,
      category: "Agent Ops",
      description: "LLM inference — current month",
    },
    {
      date: "Mar 2026",
      amount: 0.2,
      category: "Stewardship",
      description: "Shipyard team — March milestone",
    },
    {
      date: "Mar 2026",
      amount: 0.08,
      category: "Infrastructure",
      description: "Cloud infra — current month",
    },
    {
      date: "Mar 2026",
      amount: 0.05,
      category: "Security Audits",
      description: "Ongoing security retainer",
    },
  ],
};

export const mockContributors: Contributor[] = [
  {
    rank: 1,
    githubHandle: "mxinden",
    score: 924,
    badges: ["Core Maintainer", "Security Reviewer", "Release Lead", "100 PRs"],
    contributions: 312,
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  },
  {
    rank: 2,
    githubHandle: "thomaseizinger",
    score: 871,
    badges: ["Core Maintainer", "Protocol Designer", "50 PRs"],
    contributions: 278,
    address: "0x1234567890abcdef1234567890abcdef12345678",
  },
  {
    rank: 3,
    githubHandle: "elenaf9",
    score: 803,
    badges: ["Security Reviewer", "Docs Champion", "50 PRs"],
    contributions: 204,
    address: "0xabcdef1234567890abcdef1234567890abcdef12",
  },
  {
    rank: 4,
    githubHandle: "diegomrsantos",
    score: 715,
    badges: ["Protocol Designer", "25 PRs"],
    contributions: 167,
    address: "0xfedcba9876543210fedcba9876543210fedcba98",
  },
  {
    rank: 5,
    githubHandle: "koivunej",
    score: 634,
    badges: ["Bug Hunter", "25 PRs"],
    contributions: 143,
    address: "0x1111222233334444555566667777888899990000",
  },
  {
    rank: 6,
    githubHandle: "ckousoulis",
    score: 502,
    badges: ["Docs Champion", "First PR"],
    contributions: 98,
    address: "0xaaaa1111bbbb2222cccc3333dddd4444eeee5555",
  },
  {
    rank: 7,
    githubHandle: "p0n1",
    score: 287,
    badges: ["Bug Hunter"],
    contributions: 54,
    address: "0x9999888877776666555544443333222211110000",
  },
  {
    rank: 8,
    githubHandle: "hunjixin",
    score: 124,
    badges: ["First PR"],
    contributions: 21,
    address: "0x0000111122223333444455556666777788889999",
  },
];

const now = new Date("2026-03-22T14:58:00Z");
const minutesAgo = (m: number) =>
  new Date(now.getTime() - m * 60 * 1000).toISOString();

export const mockActivity: ActivityEvent[] = [
  {
    id: "evt-001",
    timestamp: minutesAgo(3),
    agentName: "Maintainer Agent",
    agentColor: "#a855f7",
    action: "Approved pull request",
    details:
      "go-libp2p#2847: fix: prevent double-close on swarm connections — score 88/100, interop verified",
    txHash: "0x7f3e1a2b4c8d6e9f1a3b5c7d9e2f4a6b8c1d3e5f",
  },
  {
    id: "evt-002",
    timestamp: minutesAgo(8),
    agentName: "Treasury Agent",
    agentColor: "#f59e0b",
    action: "Streaming payment claimed",
    details:
      "Claimed 0.14 ETH from Ethereum Foundation streaming agreement. Treasury updated on-chain.",
    txHash: "0x4a2b8c1d9e3f7a6b2c4d8e1f3a7b9c2d4e6f8a1b",
  },
  {
    id: "evt-003",
    timestamp: minutesAgo(14),
    agentName: "Review Agent",
    agentColor: "#f97316",
    action: "AI-slop flagged",
    details:
      "go-libp2p#2851 closed — score 18/100. AI-generated boilerplate, no tests, copy-paste pattern. Feedback sent to author.",
  },
  {
    id: "evt-004",
    timestamp: minutesAgo(21),
    agentName: "Community Agent",
    agentColor: "#22c55e",
    action: "Grant opportunity flagged",
    details:
      "Optimism RPGF5 round opens Apr 1 — deadline Apr 12. Draft application prepared for Board review.",
    txHash: "0x2c4e6a8b1d3f5a7c9e2b4d6f8a1c3e5b7d9f2a4c",
  },
  {
    id: "evt-005",
    timestamp: minutesAgo(29),
    agentName: "Support Agent",
    agentColor: "#3b82f6",
    action: "Developer question answered",
    details:
      "Resolved WebTransport configuration issue for @kusamari — connection behind symmetric NAT. DX improvement logged.",
  },
  {
    id: "evt-006",
    timestamp: minutesAgo(36),
    agentName: "Treasury Agent",
    agentColor: "#f59e0b",
    action: "Portfolio rebalanced",
    details:
      "Swapped 0.3 ETH → 750 USDC via Uniswap. Allocation now: 58% stables, 30% ETH, 8% tokenized bonds, 4% real estate.",
    txHash: "0x8b1d4f7a2e5c9b3f6a1d4e8c2b5f9a3d7e1c4b8f",
  },
  {
    id: "evt-007",
    timestamp: minutesAgo(44),
    agentName: "Review Agent",
    agentColor: "#f97316",
    action: "Badge issued",
    details:
      'Silver "testing" badge awarded to @elenaf9 for interop test suite contribution (score 91/100). Cross-DPI reputation updated.',
    txHash: "0x1a3c5e7b9d2f4a6c8e1b3d5f7a9c2e4b6d8f1a3c",
  },
  {
    id: "evt-008",
    timestamp: minutesAgo(52),
    agentName: "Maintainer Agent",
    agentColor: "#a855f7",
    action: "Dependency vulnerability assessed",
    details:
      "GHSA-xxxx-yyyy-zzzz in noise-protocol — reachability: HIGH. Patched in v0.6.1, PR opened, maintainers notified.",
    txHash: "0x5d7f9b2e4c6a8d1f3b5e7a9c2d4f6b8e1a3c5d7f",
  },
  {
    id: "evt-009",
    timestamp: minutesAgo(61),
    agentName: "Community Agent",
    agentColor: "#22c55e",
    action: "Newsletter sent",
    details:
      "Weekly ecosystem update sent to 847 subscribers. Featured: @diegomrsantos QUIC improvements. 3 new contributors welcomed.",
  },
  {
    id: "evt-010",
    timestamp: minutesAgo(73),
    agentName: "Maintainer Agent",
    agentColor: "#a855f7",
    action: "Spec divergence flagged",
    details:
      "go-libp2p and js-libp2p AutoNAT v2 implementations diverge on probe timeout handling. Task created for human expert.",
  },
  {
    id: "evt-011",
    timestamp: minutesAgo(85),
    agentName: "Treasury Agent",
    agentColor: "#f59e0b",
    action: "Stewardship milestone released",
    details:
      "Shipyard team Q1 milestone verified complete. 0.20 ETH released for delivery of go-libp2p v0.38.x maintenance.",
    txHash: "0x3e5a7c9f2b4d6e8a1c3f5b7d9e2a4c6f8b1d3e5a",
  },
  {
    id: "evt-012",
    timestamp: minutesAgo(97),
    agentName: "Community Agent",
    agentColor: "#22c55e",
    action: "Project showcase published",
    details:
      "Highlighted Waku Protocol as critical libp2p user (criticalityScore: 94/100). Referral link generated, funding prompt sent.",
  },
  {
    id: "evt-013",
    timestamp: minutesAgo(110),
    agentName: "Support Agent",
    agentColor: "#3b82f6",
    action: "Autonomy metric updated",
    details:
      "Core maintainer time this month: 23 min (down from 847 min at launch). Phase 2 → Phase 3 transition approved for DX reviews.",
    txHash: "0x9c2e4a6b8d1f3c5e7a9b2d4f6a8c1e3b5d7f9a2c",
  },
  {
    id: "evt-014",
    timestamp: minutesAgo(124),
    agentName: "Maintainer Agent",
    agentColor: "#a855f7",
    action: "Task board updated",
    details:
      "2 tasks added: QUIC v2 transport (Expert), Kademlia no-std Rust (Hard). Routine tasks (typos, README) handled by agents directly.",
  },
  {
    id: "evt-015",
    timestamp: minutesAgo(140),
    agentName: "Treasury Agent",
    agentColor: "#f59e0b",
    action: "P&L report generated",
    details:
      "March 2026: income 0.51 ETH (streaming + tips), expenses 0.72 ETH (agents + Shipyard + infra). Runway: 14.2 months.",
    txHash: "0x6a8c1e3b5d7f9a2c4e6b8d1f3a5c7e9b2d4f6a8c",
  },
];

export const mockTasks: Task[] = [
  {
    id: "task-003",
    title: "Write unit tests for AutoNAT v2 state machine",
    description:
      "AutoNAT v2 was merged but test coverage is at 61%. Add tests covering the probe timeout and reachability flap scenarios. Routine tasks (typos, README fixes) are handled by agents — only meaningful contributions appear here.",
    difficulty: "medium",
    reward: "",
    claimed: false,
    repo: "libp2p/go-libp2p",
  },
  {
    id: "task-004",
    title: "Benchmark yamux vs mplex throughput regression",
    description:
      "Users report yamux throughput degraded ~15% between v0.36 and v0.38. Profile and identify the regression commit. Requires deep familiarity with Go profiling and the yamux framing protocol.",
    difficulty: "medium",
    reward: "",
    claimed: true,
    repo: "libp2p/go-yamux",
  },
  {
    id: "task-005",
    title: "Implement connection gating in browser WebTransport",
    description:
      "The WebTransport browser implementation does not respect the ConnectionGater interface. Implement gating support matching the TCP transport behavior.",
    difficulty: "medium",
    reward: "",
    claimed: false,
    repo: "libp2p/js-libp2p",
  },
  {
    id: "task-006",
    title: "Fix goroutine leak on yamux stream reset under load",
    description:
      "Under high-concurrency conditions (>500 concurrent streams), yamux stream reset does not properly drain the readBuffer goroutine. Tracked in #3901. This is a critical reliability bug affecting Ethereum consensus clients.",
    difficulty: "hard",
    reward: "",
    claimed: false,
    repo: "libp2p/go-yamux",
  },
  {
    id: "task-007",
    title: "Implement peer routing via Kademlia DHT in no-std Rust",
    description:
      "rust-libp2p requires std for Kademlia DHT peer routing. Implement a no-std compatible routing table for embedded and WASM targets. Significant protocol expertise required.",
    difficulty: "hard",
    reward: "",
    claimed: false,
    repo: "libp2p/rust-libp2p",
  },
  {
    id: "task-008",
    title:
      "Design libp2p protocol negotiation v2 (multistream-select replacement)",
    description:
      "The current multistream-select protocol has known latency issues on high-latency links. Design a backwards-compatible v2 that reduces round-trips from 2 to 1 for the common case. This is a protocol-level change affecting all three implementations.",
    difficulty: "expert",
    reward: "",
    claimed: false,
    repo: "libp2p/specs",
  },
  {
    id: "task-009",
    title: "QUIC v2 transport implementation for go-libp2p",
    description:
      "Implement QUIC v2 (RFC 9369) transport support in go-libp2p. Must maintain backwards compatibility with QUIC v1 peers. Requires deep knowledge of QUIC internals and the go-libp2p transport abstraction layer.",
    difficulty: "expert",
    reward: "",
    claimed: false,
    repo: "libp2p/go-libp2p",
  },
];

export const mockEscrows: EscrowInfo[] = [
  {
    id: "escrow-001",
    feature: "WebRTC browser-to-server connection pooling",
    amount: "0.25 ETH",
    state: "FUNDED",
    deadline: "2026-04-15",
  },
  {
    id: "escrow-002",
    feature: "QUIC v2 transport implementation for go-libp2p",
    amount: "0.5 ETH",
    state: "IN_PROGRESS",
    deadline: "2026-05-01",
  },
];
