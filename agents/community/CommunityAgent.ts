import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentBase, AgentConfig } from '../base/AgentBase';
import { ReferralTool, ReferralLink } from './tools/referral';
import { ContextTool } from '../maintainer/tools/context';

export interface Project {
  name: string;
  description: string;
  stars: number;
  libp2pVersion: string;
  url: string;
  language: string;
  category: string;
  integrationDepth: 'deep' | 'shallow' | 'experimental';
}

export interface ContributorEntry {
  address: string;
  handle: string;
  score: number;
  badges: string[];
  prsReviewed: number;
  prsApproved: number;
  tasksCompleted: number;
  lastActive: string;
}

export interface ReputationData {
  contributors: ContributorEntry[];
  lastUpdated: string;
}

export class CommunityAgent extends AgentBase {
  private referral: ReferralTool;
  private context: ContextTool;
  private reputationPath: string;

  constructor(config: AgentConfig) {
    super('community-agent', 'CommunityAgent', config);
    this.referral = new ReferralTool(config.demoMode || config.mockLLM);
    this.context = new ContextTool();
    this.reputationPath = path.join(process.cwd(), 'data', 'reputation.json');
  }

  async run(): Promise<void> {
    this.log('info', 'CommunityAgent starting run cycle');
    const startTime = Date.now();

    // Step 1: Discover projects using libp2p
    const projects = await this.discoverProjects();
    this.log('info', `Discovered ${projects.length} projects using libp2p`);

    // Step 2: Generate newsletter
    const newsletter = await this.generateNewsletter(projects);
    this.log('info', 'Newsletter generated');

    // Step 3: Update contributor leaderboard
    const leaderboard = await this.updateContributorBoard();
    this.log('info', `Leaderboard updated: ${leaderboard.length} contributors`);

    // Step 4: Track referral revenue
    const referralStats = await this.referral.getStats();
    this.log('info', `Referral stats: ${referralStats.totalRevenueEth} ETH revenue, ${referralStats.totalConversions} conversions`);

    // Generate a new referral link if we have new projects to feature
    let newLink: ReferralLink | null = null;
    if (projects.length > 0) {
      const featuredProject = projects.sort((a, b) => b.stars - a.stars)[0];
      newLink = await this.referral.generateLink(
        `ecosystem-${featuredProject.name.toLowerCase().replace(/\s+/g, '-')}`,
        `Referral for ${featuredProject.name} integration campaign`
      );
      this.log('info', `Generated referral link for ${featuredProject.name}: ${newLink.url}`);
    }

    // Step 5: Update context with community summary
    const communitySummary = this.buildCommunitySummary(projects, leaderboard, referralStats, newLink);
    await this.context.appendSection('Community Update', communitySummary);
    await this.context.appendSection('Latest Newsletter', newsletter);

    const elapsedMs = Date.now() - startTime;
    this.log('info', 'CommunityAgent run complete', {
      elapsedMs,
      projectsDiscovered: projects.length,
      contributorsTracked: leaderboard.length,
      referralRevenueEth: referralStats.totalRevenueEth,
      inferenceCostUsd: this.getInferenceCost().toFixed(6),
    });
  }

  async discoverProjects(): Promise<Project[]> {
    // In a real implementation, this would query GitHub search API, DeFi registries,
    // and community channels for projects using libp2p
    const projects: Project[] = [
      {
        name: 'EthStorage',
        description: 'Decentralized storage protocol that uses libp2p for P2P data availability and retrieval. Implements custom DHT routing on top of go-libp2p.',
        stars: 1847,
        libp2pVersion: 'go-libp2p v0.36.1',
        url: 'https://github.com/ethstorage/go-ethstorage',
        language: 'Go',
        category: 'storage',
        integrationDepth: 'deep',
      },
      {
        name: 'Waku v2',
        description: 'Privacy-preserving messaging protocol built on libp2p. Uses GossipSub for message propagation and implements the Waku relay protocol over libp2p streams.',
        stars: 2341,
        libp2pVersion: 'js-libp2p v1.3.1 / go-libp2p v0.35.0',
        url: 'https://github.com/waku-org/js-waku',
        language: 'TypeScript/Go',
        category: 'messaging',
        integrationDepth: 'deep',
      },
      {
        name: 'Codex',
        description: 'Distributed storage network for Ethereum with decentralized data availability. Uses rust-libp2p for its P2P layer with custom block announcement protocol.',
        stars: 934,
        libp2pVersion: 'rust-libp2p v0.53.2',
        url: 'https://github.com/codex-storage/nim-codex',
        language: 'Nim/Rust',
        category: 'storage',
        integrationDepth: 'deep',
      },
      {
        name: 'Séquence P2P Layer',
        description: 'Experimental P2P coordination layer for Séquence smart account relayers using js-libp2p WebRTC transport for browser-to-browser connections.',
        stars: 287,
        libp2pVersion: 'js-libp2p v1.2.4',
        url: 'https://github.com/0xsequence/p2p-relayer',
        language: 'TypeScript',
        category: 'wallet-infra',
        integrationDepth: 'experimental',
      },
      {
        name: 'Forest (Filecoin)',
        description: 'Rust implementation of the Filecoin protocol. Uses rust-libp2p for block propagation, transaction gossip, and peer discovery via the Filecoin DHT.',
        stars: 1203,
        libp2pVersion: 'rust-libp2p v0.53.2',
        url: 'https://github.com/ChainSafe/forest',
        language: 'Rust',
        category: 'blockchain',
        integrationDepth: 'deep',
      },
    ];

    return projects;
  }

  async generateNewsletter(projects: Project[]): Promise<string> {
    const systemPrompt = `You are the community manager for the libp2p ecosystem. Write an engaging, concise weekly newsletter update for developers building with libp2p.
Tone: technical but approachable. Audience: P2P developers, protocol engineers, DApp builders.
Format: markdown. Include sections: Protocol Updates, Featured Projects, Contributor Spotlight, Upcoming Events.`;

    const topProjects = [...projects].sort((a, b) => b.stars - a.stars).slice(0, 3);

    const userMessage = [
      `## Data for Newsletter — Week of ${new Date().toLocaleDateString()}`,
      ``,
      `### New/Featured Projects`,
      ...topProjects.map(p =>
        `- **${p.name}** (${p.stars}⭐, ${p.language}): ${p.description.substring(0, 100)}... [${p.url}]`
      ),
      ``,
      `### Recent Protocol Milestones`,
      `- go-libp2p v0.38.0 released with QUIC v2 experimental support`,
      `- js-libp2p WebRTC transport now stable in production (v1.3.1)`,
      `- rust-libp2p v0.54 RC1 available for testing`,
      `- libp2p interop test suite expanded to 100+ test cases`,
      ``,
      `### Community Stats This Week`,
      `- GitHub stars: +234 across all repos`,
      `- Discord members: 8,947 (+89 this week)`,
      `- Questions answered on GitHub: 47`,
      `- PRs merged: 23 across go/js/rust implementations`,
      ``,
      `### Contributor Highlights`,
      `- @protocol-dev: QUIC v2 transport PR merged after 3 weeks of review`,
      `- @mesh-builder: mDNS performance PR improved discovery latency by 40%`,
      `- @cryptobuilder: First-time contributor added WebTransport certificate pinning docs`,
    ].join('\n');

    return this.callLLM(systemPrompt, userMessage);
  }

  async updateContributorBoard(): Promise<ContributorEntry[]> {
    let reputationData: ReputationData;

    try {
      const raw = await fs.readFile(this.reputationPath, 'utf-8');
      reputationData = JSON.parse(raw) as ReputationData;
    } catch {
      // Initialize with mock data if file doesn't exist
      reputationData = this.getInitialReputationData();
      await this.writeReputationData(reputationData);
    }

    // Sort by score descending for leaderboard
    const leaderboard = [...reputationData.contributors].sort((a, b) => b.score - a.score);

    // Generate leaderboard section for context
    const leaderboardMd = [
      `| Rank | Handle | Score | Badges | PRs Approved | Tasks |`,
      `|---|---|---|---|---|---|`,
      ...leaderboard.slice(0, 10).map((c, i) =>
        `| ${i + 1} | @${c.handle} | ${c.score} | ${c.badges.join(' ')} | ${c.prsApproved} | ${c.tasksCompleted} |`
      ),
    ].join('\n');

    this.log('info', `Contributor leaderboard updated:\n${leaderboardMd}`);

    return leaderboard;
  }

  private getInitialReputationData(): ReputationData {
    return {
      lastUpdated: new Date().toISOString(),
      contributors: [
        {
          address: '0x742d35Cc6634C0532925a3b8D4C9B7B3E3A1F2d4',
          handle: 'protocol-dev',
          score: 1250,
          badges: ['🔧', '⚡', '🌟'],
          prsReviewed: 47,
          prsApproved: 31,
          tasksCompleted: 8,
          lastActive: new Date(Date.now() - 2 * 3600000).toISOString(),
        },
        {
          address: '0x8B3F7A2C9E4D1B6A0C5E8F3D7A2B9C4E1F6A0B3',
          handle: 'mesh-builder',
          score: 890,
          badges: ['🔧', '📚'],
          prsReviewed: 23,
          prsApproved: 18,
          tasksCompleted: 5,
          lastActive: new Date(Date.now() - 5 * 3600000).toISOString(),
        },
        {
          address: '0xC4D7E9A2B5F8C1E4A7D0B3F6C9E2A5B8D1F4C7E',
          handle: 'cryptobuilder',
          score: 640,
          badges: ['🌱', '📚'],
          prsReviewed: 12,
          prsApproved: 9,
          tasksCompleted: 3,
          lastActive: new Date(Date.now() - 24 * 3600000).toISOString(),
        },
        {
          address: '0xA1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0',
          handle: 'rustacean42',
          score: 1580,
          badges: ['🦀', '🔧', '⚡', '🏆'],
          prsReviewed: 89,
          prsApproved: 67,
          tasksCompleted: 12,
          lastActive: new Date(Date.now() - 1 * 3600000).toISOString(),
        },
        {
          address: '0xF0E1D2C3B4A5968778695A4B3C2D1E0F9A8B7C6D',
          handle: 'go-gopher',
          score: 430,
          badges: ['🌱'],
          prsReviewed: 5,
          prsApproved: 3,
          tasksCompleted: 1,
          lastActive: new Date(Date.now() - 48 * 3600000).toISOString(),
        },
      ],
    };
  }

  private async writeReputationData(data: ReputationData): Promise<void> {
    await fs.mkdir(path.dirname(this.reputationPath), { recursive: true });
    data.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.reputationPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private buildCommunitySummary(
    projects: Project[],
    leaderboard: ContributorEntry[],
    referralStats: Awaited<ReturnType<ReferralTool['getStats']>>,
    newLink: ReferralLink | null
  ): string {
    const topContributors = leaderboard.slice(0, 3);

    return [
      `**Updated:** ${new Date().toISOString()}`,
      ``,
      `### Ecosystem Projects (${projects.length} discovered)`,
      ...projects.slice(0, 3).map(p => `- **${p.name}** (${p.stars}⭐): ${p.description.substring(0, 80)}...`),
      ``,
      `### Top Contributors`,
      ...topContributors.map((c, i) => `${i + 1}. @${c.handle} — ${c.score} pts, ${c.badges.join('')}`),
      ``,
      `### Referral Program`,
      `- Total revenue: ${referralStats.totalRevenueEth.toFixed(4)} ETH`,
      `- Active links: ${referralStats.activeLinks}`,
      `- Conversions: ${referralStats.totalConversions}`,
      `- Conversion rate: ${referralStats.conversionRate.toFixed(1)}%`,
      newLink ? `- New link generated: ${newLink.url}` : '',
    ].filter(Boolean).join('\n');
  }
}
