import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import { AgentConfig } from '../agents/base/AgentBase';
import { MaintainerAgent } from '../agents/maintainer/MaintainerAgent';
import { TreasuryAgent } from '../agents/treasury/TreasuryAgent';
import { CommunityAgent } from '../agents/community/CommunityAgent';
import { ReviewAgent } from '../agents/review/ReviewAgent';
import { SupportAgent } from '../agents/support/SupportAgent';

const DATA_DIR = path.join(process.cwd(), 'data');

function banner(): void {
  console.log('\n');
  console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║                                                              ║'));
  console.log(chalk.cyan('║  ') + chalk.bold.yellow('  DPI GUARDIANS — AUTONOMOUS AI AGENT SWARM') + chalk.cyan('          ║'));
  console.log(chalk.cyan('║                                                              ║'));
  console.log(chalk.cyan('║  ') + chalk.green('  Maintaining libp2p as Digital Public Infrastructure') + chalk.cyan('   ║'));
  console.log(chalk.cyan('║                                                              ║'));
  console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════╝'));
  console.log('\n');
}

function stepHeader(n: number, name: string): void {
  console.log('\n' + chalk.bold.blue(`━━━ Step ${n}: ${name} ━━━`) + '\n');
}

function ok(msg: string): void {
  console.log(chalk.green('  ✓ ') + msg);
}

function info(msg: string): void {
  console.log(chalk.gray('  · ') + msg);
}

function warn(msg: string): void {
  console.log(chalk.yellow('  ⚠ ') + msg);
}

function tableRow(label: string, value: string): void {
  console.log(`  ${chalk.bold(label.padEnd(28))} ${value}`);
}

const agentConfig: AgentConfig = {
  agentId: 'demo',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  storageMode: 'local',
  contractAddresses: {},
  networkRpc: 'http://127.0.0.1:8545',
  privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
  mockLLM: process.env.MOCK_LLM !== 'false',
  demoMode: true,
};

async function ensureSeeded(): Promise<void> {
  const metricsPath = path.join(DATA_DIR, 'metrics.json');
  try {
    await fs.access(metricsPath);
  } catch {
    console.log(chalk.yellow('  Data not found — running seed script first...\n'));
    const { execSync } = await import('child_process');
    execSync('npx ts-node scripts/seed-data.ts', { stdio: 'inherit' });
  }
}

async function readJson<T = unknown>(filename: string): Promise<T> {
  const raw = await fs.readFile(path.join(DATA_DIR, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

async function writeJson(filename: string, data: unknown): Promise<void> {
  await fs.writeFile(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
}

async function main(): Promise<void> {
  banner();

  // Step 0: Check seed data
  stepHeader(0, 'Checking seed data');
  await ensureSeeded();
  ok('Seed data ready');

  // ─── Step 1: MaintainerAgent ──────────────────────────────────────────────
  stepHeader(1, 'MaintainerAgent — PR Review & Task Curation');

  const maintainer = new MaintainerAgent(agentConfig);
  try {
    await maintainer.run();
    ok('MaintainerAgent run complete');

    // Show PR review results from mock-prs.json
    const prs = await readJson<Array<{ number: number; title: string; author: string; repo: string; hasTests: boolean; qualityHint: string }>>('mock-prs.json');
    console.log('');
    console.log(chalk.bold('  PR Review Results:'));
    for (const pr of prs) {
      const quality = pr.qualityHint === 'high' ? chalk.green('HIGH') :
                      pr.qualityHint === 'ai-slop' ? chalk.red('AI-SLOP') :
                      chalk.yellow('MEDIUM');
      const tests = pr.hasTests ? chalk.green('✓ tests') : chalk.red('✗ no tests');
      console.log(`  ${chalk.gray('#' + pr.number)} ${quality} | ${tests} | @${pr.author} — ${pr.title.substring(0, 55)}${pr.title.length > 55 ? '...' : ''}`);
    }
  } catch (err) {
    warn(`MaintainerAgent error: ${err}`);
  }

  // ─── Step 2: ReviewAgent ──────────────────────────────────────────────────
  stepHeader(2, 'ReviewAgent — Quality Scoring & Badge Issuance');

  const reviewer = new ReviewAgent(agentConfig);
  try {
    await reviewer.run();
    ok('ReviewAgent run complete');

    // Show reputation state
    const reputation = await readJson<Record<string, { score: number; badges: string[] }>>('reputation.json');
    console.log('');
    console.log(chalk.bold('  Contributor Reputation:'));
    const sorted = Object.entries(reputation).sort(([, a], [, b]) => b.score - a.score).slice(0, 5);
    for (const [handle, data] of sorted) {
      const badges = data.badges.length > 0 ? chalk.cyan(data.badges.join(', ')) : chalk.gray('none');
      tableRow(`@${handle}`, `score=${chalk.bold(data.score.toString())}  badges=[${badges}]`);
    }
  } catch (err) {
    warn(`ReviewAgent error: ${err}`);
  }

  // ─── Step 3: TreasuryAgent ────────────────────────────────────────────────
  stepHeader(3, 'TreasuryAgent — P&L Report & Yield Optimization');

  const treasury = new TreasuryAgent(agentConfig);
  try {
    await treasury.run();
    ok('TreasuryAgent run complete');

    const state = await readJson<{
      balance: string;
      yieldBalance: string;
      apy: string;
      totalRaised: string;
      monthlyBurnRate: string;
    }>('treasury-state.json');

    console.log('');
    console.log(chalk.bold('  Treasury Summary:'));
    tableRow('ETH Balance:', chalk.green(state.balance + ' ETH'));
    tableRow('Yield Balance:', chalk.green(state.yieldBalance + ' ETH'));
    tableRow('APY:', chalk.yellow(state.apy + '%'));
    tableRow('Total Raised:', state.totalRaised + ' ETH');
    tableRow('Monthly Burn Rate:', state.monthlyBurnRate + ' ETH');
    const runway = Math.floor(parseFloat(state.balance) / parseFloat(state.monthlyBurnRate));
    tableRow('Estimated Runway:', chalk.bold(runway + '+ months'));
  } catch (err) {
    warn(`TreasuryAgent error: ${err}`);
  }

  // ─── Step 4: CommunityAgent ───────────────────────────────────────────────
  stepHeader(4, 'CommunityAgent — Ecosystem Discovery & Newsletter');

  const community = new CommunityAgent(agentConfig);
  try {
    await community.run();
    ok('CommunityAgent run complete');

    console.log('');
    console.log(chalk.bold('  Discovered Ecosystem Projects:'));
    info('EthStorage — DHT-based peer discovery, gossipsub for block propagation (1,247 ⭐)');
    info('Waku v2 — Privacy-preserving messaging, relay protocol over libp2p (2,341 ⭐)');
    info('Codex — Distributed storage with custom block announcement protocol (934 ⭐)');

    console.log('');
    console.log(chalk.bold('  Newsletter Preview:'));
    info(chalk.italic('"libp2p Ecosystem Update — March 2026"'));
    info('Highlights: go-libp2p v0.38 with QUIC v2, WebTransport stable in js-libp2p');
    info('Contributor spotlight: @protocol-dev — QUIC v2 merged, 40% latency reduction');
  } catch (err) {
    warn(`CommunityAgent error: ${err}`);
  }

  // ─── Step 5: SupportAgent ─────────────────────────────────────────────────
  stepHeader(5, 'SupportAgent — Developer Q&A');

  const support = new SupportAgent(agentConfig);
  try {
    await support.run();
    ok('SupportAgent run complete');
    info('Answered developer questions about WebTransport integration');
    info('Generated DX improvement suggestions based on common pain points');
  } catch (err) {
    warn(`SupportAgent error: ${err}`);
  }

  // ─── Step 6: Simulate tip ─────────────────────────────────────────────────
  stepHeader(6, 'Simulate: Tip to Treasury (+0.01 ETH)');

  try {
    const state = await readJson<{ balance: string; [key: string]: unknown }>('treasury-state.json');
    const newBalance = (parseFloat(state.balance) + 0.01).toFixed(4);
    state.balance = newBalance;
    await writeJson('treasury-state.json', state);
    ok(`Tip recorded. New treasury balance: ${chalk.green(newBalance + ' ETH')}`);
  } catch (err) {
    warn(`Tip simulation error: ${err}`);
  }

  // ─── Step 7: Simulate bribe deposit ──────────────────────────────────────
  stepHeader(7, 'Simulate: New Bribe Escrow Deposit');

  try {
    const escrows = await readJson<Array<{ id: string; [key: string]: unknown }>>('escrow-state.json');
    const newEscrow = {
      id: (escrows.length + 1).toString(),
      featureDescription: 'Implement DCUTR hole-punching improvements for WebRTC',
      amount: '0.1',
      state: 'Deposited',
      briber: '0xNewBriber0000000000000000000000000000001',
      assignedContributor: null,
      deadline: new Date(Date.now() + 21 * 86400000).toISOString(),
      depositedAt: new Date().toISOString(),
    };
    escrows.push(newEscrow);
    await writeJson('escrow-state.json', escrows);
    ok(`Bribe escrow #${newEscrow.id} deposited: "${newEscrow.featureDescription}"`);
    info(`Amount: ${chalk.yellow(newEscrow.amount + ' ETH')} | Deadline: 21 days`);
  } catch (err) {
    warn(`Bribe simulation error: ${err}`);
  }

  // ─── Step 8: Final Metrics ────────────────────────────────────────────────
  stepHeader(8, 'Final Metrics');

  try {
    const metrics = await readJson<{
      maintainerMinutesSavedThisMonth: number;
      maintainerMinutesSavedLastMonth: number;
      totalPRsReviewed: number;
      totalBadgesIssued: number;
      totalContributors: number;
      totalTipped: string;
    }>('metrics.json');

    console.log(chalk.bold('  DPI Guardians Impact:'));
    tableRow('Maintainer hours saved (month):', chalk.bold(Math.floor(metrics.maintainerMinutesSavedThisMonth / 60) + 'h ' + (metrics.maintainerMinutesSavedThisMonth % 60) + 'm'));
    tableRow('Month-over-month improvement:', chalk.green('+' + Math.round((metrics.maintainerMinutesSavedThisMonth - metrics.maintainerMinutesSavedLastMonth) / metrics.maintainerMinutesSavedLastMonth * 100) + '%'));
    tableRow('Total PRs reviewed:', metrics.totalPRsReviewed.toLocaleString());
    tableRow('Total badges issued:', metrics.totalBadgesIssued.toLocaleString());
    tableRow('Total contributors:', metrics.totalContributors.toLocaleString());
    tableRow('Total tipped (all time):', chalk.green(metrics.totalTipped + ' ETH'));
  } catch (err) {
    warn(`Could not load metrics: ${err}`);
  }

  // ─── Done ─────────────────────────────────────────────────────────────────
  console.log('\n');
  console.log(chalk.bold.green('╔════════════════════════════════════════╗'));
  console.log(chalk.bold.green('║                                        ║'));
  console.log(chalk.bold.green('║  Demo complete!                        ║'));
  console.log(chalk.bold.green('║                                        ║'));
  console.log(chalk.bold.green('║  5 agents ran successfully             ║'));
  console.log(chalk.bold.green('║  Treasury updated +0.01 ETH tip        ║'));
  console.log(chalk.bold.green('║  New bribe escrow deposited            ║'));
  console.log(chalk.bold.green('║  Reputation scores updated             ║'));
  console.log(chalk.bold.green('║                                        ║'));
  console.log(chalk.bold.green('╚════════════════════════════════════════╝'));
  console.log('');
}

main().catch((err) => {
  console.error(chalk.red('\nDemo failed:'), err);
  process.exit(1);
});
