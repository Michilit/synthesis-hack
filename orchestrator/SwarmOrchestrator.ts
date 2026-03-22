import 'dotenv/config';
import { AgentConfig } from '../agents/base/AgentBase';
import { MaintainerAgent } from '../agents/maintainer/MaintainerAgent';
import { TreasuryAgent } from '../agents/treasury/TreasuryAgent';
import { CommunityAgent } from '../agents/community/CommunityAgent';
import { ReviewAgent } from '../agents/review/ReviewAgent';
import { SupportAgent } from '../agents/support/SupportAgent';
import { AgentIdentityManager } from '../identity/AgentIdentity';
import { ContextManager } from '../storage/ContextManager';
import { Scheduler } from './scheduler';
import { defaultConfig, SwarmConfig } from './config';

export interface AgentStatus {
  agentId: string;
  name: string;
  lastRun?: Date;
  nextRun?: string;
  status: 'idle' | 'running' | 'error';
  actionsToday: number;
  tokenId?: number;
}

function loadEnvConfig(): Partial<SwarmConfig> {
  return {
    mockLLM: process.env.MOCK_LLM !== 'false',
    demoMode: process.env.DEMO_MODE !== 'false',
    storageMode: (process.env.STORAGE_MODE as 'local' | 'filecoin') ?? 'local',
    networkRpc: process.env.NETWORK_RPC ?? 'http://127.0.0.1:8545',
    contractAddresses: {
      treasury: process.env.TREASURY_ADDRESS ?? '',
      tippingSystem: process.env.TIPPING_ADDRESS ?? '',
      bribeEscrow: process.env.BRIBE_ESCROW_ADDRESS ?? '',
      streamingAgreement: process.env.STREAMING_ADDRESS ?? '',
      erc8004Registry: process.env.ERC8004_ADDRESS ?? '',
    },
  };
}

function buildAgentConfig(overrides: Partial<SwarmConfig> = {}): AgentConfig {
  const env = loadEnvConfig();
  const merged = { ...defaultConfig, ...env, ...overrides };
  return {
    agentId: 'swarm',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    storageMode: merged.storageMode ?? 'local',
    contractAddresses: merged.contractAddresses ?? {},
    networkRpc: merged.networkRpc ?? 'http://127.0.0.1:8545',
    privateKey: process.env.PRIVATE_KEY ?? '0x0000000000000000000000000000000000000000000000000000000000000001',
    mockLLM: merged.mockLLM ?? true,
    demoMode: merged.demoMode ?? true,
  };
}

function printBanner(): void {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║                                                      ║');
  console.log('║        DPI GUARDIANS — SWARM ACTIVE                  ║');
  console.log('║                                                      ║');
  console.log('║  Autonomous AI agents maintaining libp2p as DPI      ║');
  console.log('║                                                      ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('\n');
}

function printStatusTable(statuses: AgentStatus[]): void {
  console.log('┌─────────────────────┬──────────────────┬──────────┬────────────┐');
  console.log('│ Agent               │ Schedule         │ TokenID  │ Status     │');
  console.log('├─────────────────────┼──────────────────┼──────────┼────────────┤');
  for (const s of statuses) {
    const name = s.name.padEnd(19);
    const schedule = (defaultConfig.agents.find(a => a.agentId === s.agentId)?.cron ?? 'unknown').padEnd(16);
    const tokenId = (s.tokenId?.toString() ?? 'pending').padEnd(8);
    const status = s.status.padEnd(10);
    console.log(`│ ${name} │ ${schedule} │ ${tokenId} │ ${status} │`);
  }
  console.log('└─────────────────────┴──────────────────┴──────────┴────────────┘');
}

export class SwarmOrchestrator {
  private config: SwarmConfig;
  private agentConfig: AgentConfig;
  private scheduler: Scheduler;
  private identityManager: AgentIdentityManager;
  private contextManager: ContextManager;

  private maintainerAgent: MaintainerAgent;
  private treasuryAgent: TreasuryAgent;
  private communityAgent: CommunityAgent;
  private reviewAgent: ReviewAgent;
  private supportAgent: SupportAgent;

  private agentStatuses: Map<string, AgentStatus> = new Map();
  private tokenIds: Map<string, number> = new Map();
  private actionCounters: Map<string, number> = new Map();

  constructor() {
    const envConfig = loadEnvConfig();
    this.config = { ...defaultConfig, ...envConfig };
    this.agentConfig = buildAgentConfig();

    this.scheduler = new Scheduler();
    this.identityManager = new AgentIdentityManager(this.config.demoMode);
    this.contextManager = new ContextManager();

    this.maintainerAgent = new MaintainerAgent(this.agentConfig);
    this.treasuryAgent = new TreasuryAgent(this.agentConfig);
    this.communityAgent = new CommunityAgent(this.agentConfig);
    this.reviewAgent = new ReviewAgent(this.agentConfig);
    this.supportAgent = new SupportAgent(this.agentConfig);

    // Initialize status map
    const agentDefs = [
      { id: 'maintainer', name: 'MaintainerAgent' },
      { id: 'treasury', name: 'TreasuryAgent' },
      { id: 'community', name: 'CommunityAgent' },
      { id: 'review', name: 'ReviewAgent' },
      { id: 'support', name: 'SupportAgent' },
    ];
    for (const a of agentDefs) {
      this.agentStatuses.set(a.id, {
        agentId: a.id,
        name: a.name,
        status: 'idle',
        actionsToday: 0,
      });
      this.actionCounters.set(a.id, 0);
    }
  }

  async start(): Promise<void> {
    // 1. Initialize context
    await this.contextManager.initialize();

    // 2. Register agents with identity manager
    await this.registerAgents();

    // 3. Print banner
    printBanner();

    // 4. Schedule agents
    this.scheduleAgents();
    this.scheduler.start();

    // 5. Print status table
    const statuses = this.getAgentStatuses();
    printStatusTable(statuses);

    console.log('\n[SwarmOrchestrator] All agents scheduled. Swarm is running.\n');
    console.log('[SwarmOrchestrator] Press Ctrl+C to stop.\n');

    // 6. Graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  private async registerAgents(): Promise<void> {
    const agentDefs = [
      {
        id: 'maintainer',
        name: 'MaintainerAgent',
        capabilities: ['pr-review', 'dependency-management', 'interop-testing', 'task-curation'],
        endpoints: ['https://dpi-guardians.io/agents/maintainer'],
        paymentAddress: '0x1111111111111111111111111111111111111111',
        metadataURI: 'ipfs://QmMaintainerMetadata',
      },
      {
        id: 'treasury',
        name: 'TreasuryAgent',
        capabilities: ['fund-management', 'yield-optimization', 'pnl-reporting', 'escrow-management'],
        endpoints: ['https://dpi-guardians.io/agents/treasury'],
        paymentAddress: '0x2222222222222222222222222222222222222222',
        metadataURI: 'ipfs://QmTreasuryMetadata',
      },
      {
        id: 'community',
        name: 'CommunityAgent',
        capabilities: ['newsletter-generation', 'project-discovery', 'contributor-board', 'referral-tracking'],
        endpoints: ['https://dpi-guardians.io/agents/community'],
        paymentAddress: '0x3333333333333333333333333333333333333333',
        metadataURI: 'ipfs://QmCommunityMetadata',
      },
      {
        id: 'review',
        name: 'ReviewAgent',
        capabilities: ['pr-quality-scoring', 'ai-slop-detection', 'badge-issuance', 'reputation-management'],
        endpoints: ['https://dpi-guardians.io/agents/review'],
        paymentAddress: '0x4444444444444444444444444444444444444444',
        metadataURI: 'ipfs://QmReviewMetadata',
      },
      {
        id: 'support',
        name: 'SupportAgent',
        capabilities: ['developer-support', 'dx-improvement', 'documentation'],
        endpoints: ['https://dpi-guardians.io/agents/support'],
        paymentAddress: '0x5555555555555555555555555555555555555555',
        metadataURI: 'ipfs://QmSupportMetadata',
      },
    ];

    console.log('[SwarmOrchestrator] Registering agents with identity manager...');

    for (const def of agentDefs) {
      try {
        // Check if already registered
        const existing = await this.identityManager.getTokenIdByOwner(def.paymentAddress);
        if (existing !== null) {
          this.tokenIds.set(def.id, existing);
          const status = this.agentStatuses.get(def.id);
          if (status) status.tokenId = existing;
          console.log(`  [${def.name}] Already registered with tokenId ${existing}`);
          continue;
        }

        const tokenId = await this.identityManager.registerAgent({
          name: def.name,
          capabilities: def.capabilities,
          serviceEndpoints: def.endpoints,
          paymentAddress: def.paymentAddress,
          metadataURI: def.metadataURI,
        });

        this.tokenIds.set(def.id, tokenId);
        const status = this.agentStatuses.get(def.id);
        if (status) status.tokenId = tokenId;
      } catch (err) {
        console.error(`  Failed to register ${def.name}:`, err);
      }
    }
  }

  private scheduleAgents(): void {
    const agentSchedules = this.config.agents;

    for (const schedule of agentSchedules) {
      if (!schedule.enabled) continue;

      if (schedule.cron === 'on-demand') {
        // Support agent is on-demand — register without cron
        this.scheduler.addTask(
          schedule.agentId,
          schedule.name,
          'on-demand',
          async () => this.runAgent(schedule.agentId)
        );
        continue;
      }

      const cronExpr = schedule.cron;
      if (!cronExpr) continue;

      this.scheduler.addTask(
        schedule.agentId,
        schedule.name,
        cronExpr,
        async () => this.runAgent(schedule.agentId)
      );
    }
  }

  private async runAgent(agentId: string): Promise<void> {
    const status = this.agentStatuses.get(agentId);
    if (status) {
      status.status = 'running';
      status.lastRun = new Date();
    }

    try {
      switch (agentId) {
        case 'maintainer':
          await this.maintainerAgent.run();
          break;
        case 'treasury':
          await this.treasuryAgent.run();
          break;
        case 'community':
          await this.communityAgent.run();
          break;
        case 'review':
          await this.reviewAgent.run();
          break;
        case 'support':
          await this.supportAgent.run();
          break;
        default:
          console.warn(`[SwarmOrchestrator] Unknown agent: ${agentId}`);
      }

      const counter = (this.actionCounters.get(agentId) ?? 0) + 1;
      this.actionCounters.set(agentId, counter);

      if (status) {
        status.status = 'idle';
        status.actionsToday = counter;
      }

      await this.contextManager.appendToLog(`[${agentId}] Run completed successfully`);
    } catch (err) {
      console.error(`[SwarmOrchestrator] Agent ${agentId} failed:`, err);
      if (status) status.status = 'error';
    }
  }

  stop(): void {
    console.log('\n[SwarmOrchestrator] Shutting down swarm...');
    this.scheduler.stop();
    console.log('[SwarmOrchestrator] All agents stopped. Goodbye.\n');
    process.exit(0);
  }

  getAgentStatuses(): AgentStatus[] {
    return Array.from(this.agentStatuses.values()).map((s) => ({
      ...s,
      tokenId: this.tokenIds.get(s.agentId) ?? s.tokenId,
      actionsToday: this.actionCounters.get(s.agentId) ?? 0,
    }));
  }
}

if (require.main === module) {
  new SwarmOrchestrator().start().catch((err) => {
    console.error('[SwarmOrchestrator] Fatal error:', err);
    process.exit(1);
  });
}
