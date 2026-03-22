import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ContextManager } from '../storage/ContextManager';

const DATA_DIR = path.join(process.cwd(), 'data');

async function writeJson(filename: string, data: unknown): Promise<void> {
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  Written: data/${filename}`);
}

async function main(): Promise<void> {
  console.log('\nDPI Guardians — Seed Data\n');

  // Ensure data directory exists
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'storage'), { recursive: true });

  // ─── mock-prs.json ────────────────────────────────────────────────────────
  const mockPRs = [
    {
      number: 2847,
      title: 'feat: implement QUIC v2 transport with 0-RTT handshake',
      author: 'protocol-dev',
      repo: 'libp2p/go-libp2p',
      body: 'This PR implements the QUIC v2 transport protocol with 0-RTT session resumption, significantly reducing connection establishment latency by ~40%. Includes comprehensive unit and integration tests covering happy path, packet loss simulation, NAT traversal, and handshake timeout. Benchmark results in PR description. Fixes #2103, relates to #1847.',
      additions: 234,
      deletions: 45,
      hasTests: true,
      qualityHint: 'high',
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      number: 1203,
      title: 'Update code',
      author: 'spam-bot',
      repo: 'libp2p/js-libp2p',
      body: 'Updated some code to fix issues.',
      additions: 3,
      deletions: 3,
      hasTests: false,
      qualityHint: 'ai-slop',
      createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
    {
      number: 891,
      title: 'fix: noise protocol handshake timeout in high-latency environments',
      author: 'mesh-builder',
      repo: 'libp2p/rust-libp2p',
      body: 'Fixes intermittent handshake timeouts seen in high-latency (>200ms RTT) environments. Root cause: fixed 5s timeout too aggressive. Changed to adaptive timeout based on observed RTT with configurable ceiling (default 30s). Added integration tests with network latency simulation using tc-netem.',
      additions: 89,
      deletions: 12,
      hasTests: true,
      qualityHint: 'medium',
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      number: 3012,
      title: 'docs: comprehensive WebTransport integration guide with examples',
      author: 'quic-wizard',
      repo: 'libp2p/go-libp2p',
      body: 'Adds a complete WebTransport integration guide covering browser-to-server connections, certificate handling, ALPN negotiation, and fallback strategies. Includes runnable code examples for Go and JavaScript. Also fixes several outdated references in existing docs.',
      additions: 45,
      deletions: 8,
      hasTests: false,
      qualityHint: 'medium',
      createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
    {
      number: 567,
      title: 'security: fix connection handler use-after-free in stream multiplexer',
      author: 'sec-researcher',
      repo: 'libp2p/js-libp2p',
      body: 'Fixes a use-after-free vulnerability in the yamux stream multiplexer where a stream could be accessed after the underlying connection was closed under concurrent load. The bug could lead to data corruption or potential RCE in server-side applications processing untrusted peer connections. Added regression tests that reproduce the race condition. Coordinated disclosure with libp2p security team — 30-day embargo ended.',
      additions: 123,
      deletions: 34,
      hasTests: true,
      qualityHint: 'high',
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
  ];
  await writeJson('mock-prs.json', mockPRs);

  // ─── reputation.json ──────────────────────────────────────────────────────
  const reputation = {
    'protocol-dev': {
      githubHandle: 'protocol-dev',
      score: 847,
      badges: ['CORE_CONTRIBUTOR', 'INTEROP_HERO'],
      lastUpdated: new Date().toISOString(),
    },
    'mesh-builder': {
      githubHandle: 'mesh-builder',
      score: 634,
      badges: ['SECURITY_EXPERT'],
      lastUpdated: new Date().toISOString(),
    },
    'quic-wizard': {
      githubHandle: 'quic-wizard',
      score: 521,
      badges: ['DOC_MASTER'],
      lastUpdated: new Date().toISOString(),
    },
    'sec-researcher': {
      githubHandle: 'sec-researcher',
      score: 712,
      badges: ['SECURITY_EXPERT', 'FIRST_PR'],
      lastUpdated: new Date().toISOString(),
    },
    'rustacean42': {
      githubHandle: 'rustacean42',
      score: 903,
      badges: ['CORE_CONTRIBUTOR', 'PROTOCOL_DESIGNER'],
      lastUpdated: new Date().toISOString(),
    },
    'cryptobuilder': {
      githubHandle: 'cryptobuilder',
      score: 389,
      badges: ['FIRST_PR'],
      lastUpdated: new Date().toISOString(),
    },
    'go-gopher': {
      githubHandle: 'go-gopher',
      score: 156,
      badges: [],
      lastUpdated: new Date().toISOString(),
    },
    'wasm-wrangler': {
      githubHandle: 'wasm-wrangler',
      score: 234,
      badges: ['FIRST_PR'],
      lastUpdated: new Date().toISOString(),
    },
  };
  await writeJson('reputation.json', reputation);

  // ─── treasury-state.json ──────────────────────────────────────────────────
  const now = Date.now();
  const treasuryState = {
    balance: '2.5',
    yieldBalance: '0.15',
    apy: '5.2',
    totalRaised: '12.3',
    monthlyBurnRate: '0.3',
    lastUpdated: new Date().toISOString(),
    spendingHistory: [
      {
        date: new Date(now - 28 * 86400000).toISOString(),
        amount: '0.15',
        category: 'infrastructure',
        description: 'Server costs — February 2026',
        txHash: '0xabc1230000000000000000000000000000000000000000000000000000000001',
      },
      {
        date: new Date(now - 21 * 86400000).toISOString(),
        amount: '0.05',
        category: 'tooling',
        description: 'LLM API costs — February 2026',
        txHash: '0xdef4560000000000000000000000000000000000000000000000000000000002',
      },
      {
        date: new Date(now - 14 * 86400000).toISOString(),
        amount: '0.2',
        category: 'grants',
        description: 'Contributor grant — @protocol-dev QUIC v2 implementation',
        txHash: '0x7890ab0000000000000000000000000000000000000000000000000000000003',
      },
      {
        date: new Date(now - 7 * 86400000).toISOString(),
        amount: '0.15',
        category: 'infrastructure',
        description: 'Server costs — March 2026',
        txHash: '0xcdef010000000000000000000000000000000000000000000000000000000004',
      },
      {
        date: new Date(now - 2 * 86400000).toISOString(),
        amount: '0.05',
        category: 'tooling',
        description: 'LLM API costs — March 2026 (partial)',
        txHash: '0x234567000000000000000000000000000000000000000000000000000000000005',
      },
    ],
  };
  await writeJson('treasury-state.json', treasuryState);

  // ─── escrow-state.json ────────────────────────────────────────────────────
  const escrowState = [
    {
      id: '1',
      featureDescription: 'Add WebTransport support to js-libp2p',
      amount: '0.5',
      state: 'Assigned',
      briber: '0x1234567890abcdef1234567890abcdef12345678',
      assignedContributor: '0x5678901234abcdef5678901234abcdef56789012',
      deadline: new Date(now + 7 * 86400000).toISOString(),
    },
    {
      id: '2',
      featureDescription: 'Optimize DHT routing table for large networks (>10k peers)',
      amount: '0.25',
      state: 'Deposited',
      briber: '0xabcdef1234567890abcdef1234567890abcdef12',
      assignedContributor: null,
      deadline: new Date(now + 14 * 86400000).toISOString(),
    },
  ];
  await writeJson('escrow-state.json', escrowState);

  // ─── streaming-state.json ─────────────────────────────────────────────────
  const streamingState = [
    {
      id: '1',
      payer: '0xProtocolFoundation000000000000000000000001',
      recipient: '0xTreasuryContract000000000000000000000001',
      ratePerSecond: '0.000001',
      totalDeposited: '0.3',
      totalClaimed: '0.05',
      active: true,
      slaMaxDowntimeHours: 24,
      paused: false,
      startedAt: new Date(now - 30 * 86400000).toISOString(),
      lastClaimedAt: new Date(now - 7 * 86400000).toISOString(),
    },
  ];
  await writeJson('streaming-state.json', streamingState);

  // ─── metrics.json ─────────────────────────────────────────────────────────
  const metrics = {
    maintainerMinutesSavedThisMonth: 847,
    maintainerMinutesSavedLastMonth: 623,
    totalPRsReviewed: 1247,
    totalBadgesIssued: 89,
    totalContributors: 23,
    totalTipped: '12.3',
    lastUpdated: new Date().toISOString(),
  };
  await writeJson('metrics.json', metrics);

  // ─── Initialize context.md ────────────────────────────────────────────────
  const contextManager = new ContextManager();
  await contextManager.initialize();
  console.log('  Initialized: data/context.md');

  // Summary
  console.log('\nSeed complete! Files written:');
  console.log('  data/mock-prs.json       — 5 pull requests (varying quality)');
  console.log('  data/reputation.json     — 8 contributors with scores and badges');
  console.log('  data/treasury-state.json — treasury balance, yield, spending history');
  console.log('  data/escrow-state.json   — 2 bribe escrow entries');
  console.log('  data/streaming-state.json — 1 active streaming agreement');
  console.log('  data/metrics.json        — project metrics');
  console.log('  data/context.md          — initialized if not present');
  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
