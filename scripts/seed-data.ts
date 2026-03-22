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
  // Format must match ReputationStore: { contributors: ContributorReputation[], lastUpdated, version }
  const reputation = {
    contributors: [
      { address: '0x1111111111111111111111111111111111111111', handle: 'rustacean42', score: 903, badges: ['core-contributor', 'protocol-designer'], badgeDetails: [], prsReviewed: 31, prsApproved: 29, prsRejected: 2, aiSlopFlagged: 1, tasksCompleted: 8, tasksCompletedByDifficulty: { beginner: 2, intermediate: 3, advanced: 2, expert: 1 }, firstContribution: '2024-01-15T00:00:00.000Z', lastActive: new Date().toISOString(), streak: 12, totalEarned: '0', reviewQualityScore: 94 },
      { address: '0x2222222222222222222222222222222222222222', handle: 'protocol-dev', score: 847, badges: ['core-contributor', 'interop-hero'], badgeDetails: [], prsReviewed: 23, prsApproved: 21, prsRejected: 2, aiSlopFlagged: 0, tasksCompleted: 6, tasksCompletedByDifficulty: { beginner: 1, intermediate: 2, advanced: 2, expert: 1 }, firstContribution: '2024-03-10T00:00:00.000Z', lastActive: new Date().toISOString(), streak: 8, totalEarned: '0', reviewQualityScore: 91 },
      { address: '0x3333333333333333333333333333333333333333', handle: 'sec-researcher', score: 712, badges: ['security-expert', 'first-pr'], badgeDetails: [], prsReviewed: 18, prsApproved: 16, prsRejected: 2, aiSlopFlagged: 3, tasksCompleted: 4, tasksCompletedByDifficulty: { beginner: 0, intermediate: 1, advanced: 2, expert: 1 }, firstContribution: '2024-05-22T00:00:00.000Z', lastActive: new Date().toISOString(), streak: 6, totalEarned: '0', reviewQualityScore: 88 },
      { address: '0x4444444444444444444444444444444444444444', handle: 'mesh-builder', score: 634, badges: ['security-expert'], badgeDetails: [], prsReviewed: 17, prsApproved: 15, prsRejected: 2, aiSlopFlagged: 2, tasksCompleted: 5, tasksCompletedByDifficulty: { beginner: 1, intermediate: 2, advanced: 2, expert: 0 }, firstContribution: '2024-06-01T00:00:00.000Z', lastActive: new Date().toISOString(), streak: 5, totalEarned: '0', reviewQualityScore: 85 },
      { address: '0x5555555555555555555555555555555555555555', handle: 'quic-wizard', score: 521, badges: ['doc-master'], badgeDetails: [], prsReviewed: 14, prsApproved: 13, prsRejected: 1, aiSlopFlagged: 0, tasksCompleted: 3, tasksCompletedByDifficulty: { beginner: 1, intermediate: 2, advanced: 0, expert: 0 }, firstContribution: '2024-07-14T00:00:00.000Z', lastActive: new Date().toISOString(), streak: 4, totalEarned: '0', reviewQualityScore: 82 },
      { address: '0x6666666666666666666666666666666666666666', handle: 'cryptobuilder', score: 389, badges: ['first-pr'], badgeDetails: [], prsReviewed: 9, prsApproved: 7, prsRejected: 2, aiSlopFlagged: 1, tasksCompleted: 2, tasksCompletedByDifficulty: { beginner: 2, intermediate: 0, advanced: 0, expert: 0 }, firstContribution: '2024-09-03T00:00:00.000Z', lastActive: new Date().toISOString(), streak: 2, totalEarned: '0', reviewQualityScore: 71 },
      { address: '0x7777777777777777777777777777777777777777', handle: 'wasm-wrangler', score: 234, badges: ['first-pr'], badgeDetails: [], prsReviewed: 5, prsApproved: 4, prsRejected: 1, aiSlopFlagged: 0, tasksCompleted: 1, tasksCompletedByDifficulty: { beginner: 1, intermediate: 0, advanced: 0, expert: 0 }, firstContribution: '2024-11-20T00:00:00.000Z', lastActive: new Date().toISOString(), streak: 1, totalEarned: '0', reviewQualityScore: 65 },
      { address: '0x8888888888888888888888888888888888888888', handle: 'go-gopher', score: 156, badges: [], badgeDetails: [], prsReviewed: 3, prsApproved: 2, prsRejected: 1, aiSlopFlagged: 0, tasksCompleted: 0, tasksCompletedByDifficulty: { beginner: 0, intermediate: 0, advanced: 0, expert: 0 }, firstContribution: '2025-01-08T00:00:00.000Z', lastActive: new Date().toISOString(), streak: 0, totalEarned: '0', reviewQualityScore: 58 },
    ],
    lastUpdated: new Date().toISOString(),
    version: '1.0',
  };
  await writeJson('reputation.json', reputation);

  // ─── treasury-state.json ──────────────────────────────────────────────────
  // Format must match TreasuryState interface in TreasuryAgent.ts
  const now = Date.now();
  const treasuryState = {
    address: '0xTreasuryContract000000000000000000000001',
    lastUpdated: new Date().toISOString(),
    balances: { eth: 2.5, usdc: 500, dai: 250 },
    yieldPositions: [
      { protocol: 'Lido stETH', asset: 'ETH', deposited: 1.0, currentValue: 1.05, apy: 4.8, earnedToDate: 0.05, lastCompound: new Date(now - 7 * 86400000).toISOString() },
      { protocol: 'Ondo OUSG', asset: 'USDC', deposited: 500, currentValue: 512, apy: 5.1, earnedToDate: 12, lastCompound: new Date(now - 3 * 86400000).toISOString() },
    ],
    totalValueEth: 2.75,
    monthlyBurnEth: 0.26,
    runwayMonths: 10.6,
    revenueThisMonth: 0.81,
    costsThisMonth: 0.26,
    pendingEscrowEth: 0.75,
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
  // Format must match MetricsData interface in SupportAgent.ts
  const metrics = {
    totalQuestionsAnswered: 847,
    totalMaintainerMinutesSaved: 12705,
    questionsByCategory: { debugging: 312, 'api-usage': 289, performance: 134, deployment: 78, protocol: 34 },
    questionsByLanguage: { go: 398, javascript: 301, rust: 148 },
    averageResponseTimeMs: 340,
    lastUpdated: new Date().toISOString(),
    runHistory: [
      { date: new Date(now - 14 * 86400000).toISOString(), questionsAnswered: 12, minutesSaved: 180 },
      { date: new Date(now - 7 * 86400000).toISOString(), questionsAnswered: 15, minutesSaved: 225 },
      { date: new Date(now - 1 * 86400000).toISOString(), questionsAnswered: 9, minutesSaved: 135 },
    ],
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
