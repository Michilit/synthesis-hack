import * as fs from 'fs/promises';
import * as path from 'path';

export interface ContributorReputation {
  address: string;
  handle: string;
  score: number;
  badges: string[];
  badgeDetails: BadgeDetail[];
  prsReviewed: number;
  prsApproved: number;
  prsRejected: number;
  aiSlopFlagged: number;
  tasksCompleted: number;
  tasksCompletedByDifficulty: Record<'beginner' | 'intermediate' | 'advanced' | 'expert', number>;
  firstContribution: string;
  lastActive: string;
  streak: number; // consecutive weeks active
  totalEarned: string; // ETH as string
  reviewQualityScore: number; // 0-100, how accurate their self-reviews are
}

export interface BadgeDetail {
  id: string;
  name: string;
  emoji: string;
  description: string;
  awardedAt: string;
  criteria: string;
}

export interface ReputationStore {
  contributors: ContributorReputation[];
  lastUpdated: string;
  version: '1.0';
}

const BADGE_DEFINITIONS: Record<string, Omit<BadgeDetail, 'awardedAt'>> = {
  'first-pr': {
    id: 'first-pr',
    name: 'First PR',
    emoji: '🌱',
    description: 'Merged their first pull request',
    criteria: 'First approved PR',
  },
  'protocol-expert': {
    id: 'protocol-expert',
    name: 'Protocol Expert',
    emoji: '🔧',
    description: 'Deep protocol implementation contributions',
    criteria: '5+ protocol-level PRs approved',
  },
  'speed-demon': {
    id: 'speed-demon',
    name: 'Speed Demon',
    emoji: '⚡',
    description: 'Performance optimization contributor',
    criteria: '3+ PRs with measurable performance improvements',
  },
  'documentation-hero': {
    id: 'documentation-hero',
    name: 'Documentation Hero',
    emoji: '📚',
    description: 'Significant documentation contributions',
    criteria: '10+ documentation PRs merged',
  },
  'top-contributor': {
    id: 'top-contributor',
    name: 'Top Contributor',
    emoji: '🏆',
    description: 'Top 5 contributor by score',
    criteria: 'Score in top 5 of all contributors',
  },
  'rust-champion': {
    id: 'rust-champion',
    name: 'Rust Champion',
    emoji: '🦀',
    description: 'Expert rust-libp2p contributor',
    criteria: '10+ rust-libp2p PRs approved',
  },
  'slop-hunter': {
    id: 'slop-hunter',
    name: 'Slop Hunter',
    emoji: '🚩',
    description: 'Helped identify and remove AI-generated low-quality PRs',
    criteria: '5+ AI slop PRs correctly flagged',
  },
  'streaker': {
    id: 'streaker',
    name: '4-Week Streak',
    emoji: '🔥',
    description: 'Active contributor for 4+ consecutive weeks',
    criteria: 'streak >= 4',
  },
};

export class ReputationTool {
  private storePath: string;

  constructor(storePath?: string) {
    this.storePath = storePath ?? path.join(process.cwd(), 'data', 'reputation.json');
  }

  private async loadStore(): Promise<ReputationStore> {
    try {
      const raw = await fs.readFile(this.storePath, 'utf-8');
      return JSON.parse(raw) as ReputationStore;
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        const initial = this.getInitialStore();
        await this.saveStore(initial);
        return initial;
      }
      throw err;
    }
  }

  private async saveStore(store: ReputationStore): Promise<void> {
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
    store.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.storePath, JSON.stringify(store, null, 2), 'utf-8');
  }

  private getInitialStore(): ReputationStore {
    const now = new Date().toISOString();
    return {
      version: '1.0',
      lastUpdated: now,
      contributors: [
        {
          address: '0x742d35Cc6634C0532925a3b8D4C9B7B3E3A1F2d4',
          handle: 'protocol-dev',
          score: 1250,
          badges: ['🌱', '🔧', '⚡'],
          badgeDetails: [
            { ...BADGE_DEFINITIONS['first-pr'], awardedAt: new Date(Date.now() - 180 * 86400000).toISOString() },
            { ...BADGE_DEFINITIONS['protocol-expert'], awardedAt: new Date(Date.now() - 90 * 86400000).toISOString() },
            { ...BADGE_DEFINITIONS['speed-demon'], awardedAt: new Date(Date.now() - 30 * 86400000).toISOString() },
          ],
          prsReviewed: 47,
          prsApproved: 31,
          prsRejected: 16,
          aiSlopFlagged: 3,
          tasksCompleted: 8,
          tasksCompletedByDifficulty: { beginner: 2, intermediate: 4, advanced: 2, expert: 0 },
          firstContribution: new Date(Date.now() - 365 * 86400000).toISOString(),
          lastActive: new Date(Date.now() - 2 * 3600000).toISOString(),
          streak: 12,
          totalEarned: '1500000000000000000', // 1.5 ETH
          reviewQualityScore: 87,
        },
        {
          address: '0xA1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0',
          handle: 'rustacean42',
          score: 1580,
          badges: ['🦀', '🔧', '⚡', '🏆'],
          badgeDetails: [
            { ...BADGE_DEFINITIONS['first-pr'], awardedAt: new Date(Date.now() - 400 * 86400000).toISOString() },
            { ...BADGE_DEFINITIONS['rust-champion'], awardedAt: new Date(Date.now() - 120 * 86400000).toISOString() },
            { ...BADGE_DEFINITIONS['protocol-expert'], awardedAt: new Date(Date.now() - 60 * 86400000).toISOString() },
            { ...BADGE_DEFINITIONS['top-contributor'], awardedAt: new Date(Date.now() - 14 * 86400000).toISOString() },
          ],
          prsReviewed: 89,
          prsApproved: 67,
          prsRejected: 22,
          aiSlopFlagged: 8,
          tasksCompleted: 12,
          tasksCompletedByDifficulty: { beginner: 1, intermediate: 5, advanced: 5, expert: 1 },
          firstContribution: new Date(Date.now() - 500 * 86400000).toISOString(),
          lastActive: new Date(Date.now() - 1 * 3600000).toISOString(),
          streak: 18,
          totalEarned: '2800000000000000000', // 2.8 ETH
          reviewQualityScore: 93,
        },
        {
          address: '0x8B3F7A2C9E4D1B6A0C5E8F3D7A2B9C4E1F6A0B3',
          handle: 'mesh-builder',
          score: 890,
          badges: ['🌱', '🔧', '📚'],
          badgeDetails: [
            { ...BADGE_DEFINITIONS['first-pr'], awardedAt: new Date(Date.now() - 200 * 86400000).toISOString() },
            { ...BADGE_DEFINITIONS['protocol-expert'], awardedAt: new Date(Date.now() - 45 * 86400000).toISOString() },
            { ...BADGE_DEFINITIONS['documentation-hero'], awardedAt: new Date(Date.now() - 10 * 86400000).toISOString() },
          ],
          prsReviewed: 23,
          prsApproved: 18,
          prsRejected: 5,
          aiSlopFlagged: 2,
          tasksCompleted: 5,
          tasksCompletedByDifficulty: { beginner: 3, intermediate: 2, advanced: 0, expert: 0 },
          firstContribution: new Date(Date.now() - 270 * 86400000).toISOString(),
          lastActive: new Date(Date.now() - 5 * 3600000).toISOString(),
          streak: 7,
          totalEarned: '900000000000000000', // 0.9 ETH
          reviewQualityScore: 78,
        },
        {
          address: '0xC4D7E9A2B5F8C1E4A7D0B3F6C9E2A5B8D1F4C7E',
          handle: 'cryptobuilder',
          score: 640,
          badges: ['🌱', '📚'],
          badgeDetails: [
            { ...BADGE_DEFINITIONS['first-pr'], awardedAt: new Date(Date.now() - 90 * 86400000).toISOString() },
            { ...BADGE_DEFINITIONS['documentation-hero'], awardedAt: new Date(Date.now() - 7 * 86400000).toISOString() },
          ],
          prsReviewed: 12,
          prsApproved: 9,
          prsRejected: 3,
          aiSlopFlagged: 0,
          tasksCompleted: 3,
          tasksCompletedByDifficulty: { beginner: 3, intermediate: 0, advanced: 0, expert: 0 },
          firstContribution: new Date(Date.now() - 120 * 86400000).toISOString(),
          lastActive: new Date(Date.now() - 24 * 3600000).toISOString(),
          streak: 4,
          totalEarned: '400000000000000000', // 0.4 ETH
          reviewQualityScore: 72,
        },
        {
          address: '0xF0E1D2C3B4A5968778695A4B3C2D1E0F9A8B7C6D',
          handle: 'go-gopher',
          score: 430,
          badges: ['🌱'],
          badgeDetails: [
            { ...BADGE_DEFINITIONS['first-pr'], awardedAt: new Date(Date.now() - 45 * 86400000).toISOString() },
          ],
          prsReviewed: 5,
          prsApproved: 3,
          prsRejected: 2,
          aiSlopFlagged: 0,
          tasksCompleted: 1,
          tasksCompletedByDifficulty: { beginner: 1, intermediate: 0, advanced: 0, expert: 0 },
          firstContribution: new Date(Date.now() - 60 * 86400000).toISOString(),
          lastActive: new Date(Date.now() - 48 * 3600000).toISOString(),
          streak: 3,
          totalEarned: '200000000000000000', // 0.2 ETH
          reviewQualityScore: 65,
        },
      ],
    };
  }

  async getReputation(handle: string): Promise<ContributorReputation | null> {
    const store = await this.loadStore();
    return store.contributors.find(c => c.handle === handle) ?? null;
  }

  async getReputationByAddress(address: string): Promise<ContributorReputation | null> {
    const store = await this.loadStore();
    const normalized = address.toLowerCase();
    return store.contributors.find(c => c.address.toLowerCase() === normalized) ?? null;
  }

  async updateScore(handle: string, delta: number, reason: string): Promise<ContributorReputation | null> {
    const store = await this.loadStore();
    const contributor = store.contributors.find(c => c.handle === handle);

    if (!contributor) {
      console.warn(`[ReputationTool] Contributor not found: ${handle}`);
      return null;
    }

    const oldScore = contributor.score;
    contributor.score = Math.max(0, contributor.score + delta);
    contributor.lastActive = new Date().toISOString();

    console.log(`[ReputationTool] Score updated for @${handle}: ${oldScore} → ${contributor.score} (${delta > 0 ? '+' : ''}${delta} — ${reason})`);

    await this.saveStore(store);
    return contributor;
  }

  async issueBadge(handle: string, badgeId: string): Promise<{ issued: boolean; badge?: BadgeDetail; alreadyHad: boolean }> {
    const store = await this.loadStore();
    const contributor = store.contributors.find(c => c.handle === handle);

    if (!contributor) {
      return { issued: false, alreadyHad: false };
    }

    const badgeDef = BADGE_DEFINITIONS[badgeId];
    if (!badgeDef) {
      throw new Error(`Unknown badge ID: ${badgeId}`);
    }

    // Check if already has this badge
    const alreadyHas = contributor.badgeDetails.some(b => b.id === badgeId);
    if (alreadyHas) {
      return { issued: false, alreadyHad: true };
    }

    const badge: BadgeDetail = {
      ...badgeDef,
      awardedAt: new Date().toISOString(),
    };

    contributor.badges.push(badge.emoji);
    contributor.badgeDetails.push(badge);
    contributor.score += 100; // bonus points for badge

    await this.saveStore(store);
    console.log(`[ReputationTool] Badge issued to @${handle}: ${badge.emoji} ${badge.name}`);
    return { issued: true, badge, alreadyHad: false };
  }

  async getLeaderboard(limit = 10): Promise<Array<ContributorReputation & { rank: number }>> {
    const store = await this.loadStore();
    return [...store.contributors]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((c, idx) => ({ ...c, rank: idx + 1 }));
  }

  async createOrUpdateContributor(
    handle: string,
    address: string,
    updates?: Partial<ContributorReputation>
  ): Promise<ContributorReputation> {
    const store = await this.loadStore();
    let contributor = store.contributors.find(c => c.handle === handle);

    if (!contributor) {
      contributor = {
        address,
        handle,
        score: 0,
        badges: [],
        badgeDetails: [],
        prsReviewed: 0,
        prsApproved: 0,
        prsRejected: 0,
        aiSlopFlagged: 0,
        tasksCompleted: 0,
        tasksCompletedByDifficulty: { beginner: 0, intermediate: 0, advanced: 0, expert: 0 },
        firstContribution: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        streak: 0,
        totalEarned: '0',
        reviewQualityScore: 50,
      };
      store.contributors.push(contributor);
      // Auto-issue first-pr badge
      await this.issueBadge(handle, 'first-pr');
    }

    if (updates) {
      Object.assign(contributor, updates);
    }

    contributor.lastActive = new Date().toISOString();
    await this.saveStore(store);
    return contributor;
  }

  async checkAndAwardBadges(handle: string): Promise<BadgeDetail[]> {
    const contributor = await this.getReputation(handle);
    if (!contributor) return [];

    const newBadges: BadgeDetail[] = [];

    const checks: Array<{ badgeId: string; condition: boolean }> = [
      { badgeId: 'first-pr', condition: contributor.prsApproved >= 1 },
      { badgeId: 'protocol-expert', condition: contributor.prsApproved >= 5 },
      { badgeId: 'speed-demon', condition: contributor.prsApproved >= 3 },
      { badgeId: 'documentation-hero', condition: contributor.prsApproved >= 10 },
      { badgeId: 'slop-hunter', condition: contributor.aiSlopFlagged >= 5 },
      { badgeId: 'streaker', condition: contributor.streak >= 4 },
    ];

    for (const check of checks) {
      if (check.condition) {
        const result = await this.issueBadge(handle, check.badgeId);
        if (result.issued && result.badge) {
          newBadges.push(result.badge);
        }
      }
    }

    return newBadges;
  }
}
