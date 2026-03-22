import * as fs from 'fs/promises';
import * as path from 'path';

export enum Badge {
  FIRST_PR = 'FIRST_PR',
  INTEROP_HERO = 'INTEROP_HERO',
  SECURITY_EXPERT = 'SECURITY_EXPERT',
  DOC_MASTER = 'DOC_MASTER',
  CORE_CONTRIBUTOR = 'CORE_CONTRIBUTOR',
  PROTOCOL_DESIGNER = 'PROTOCOL_DESIGNER',
}

export const BADGE_METADATA: Record<Badge, { label: string; emoji: string; description: string }> = {
  [Badge.FIRST_PR]: {
    label: 'First PR',
    emoji: '🌱',
    description: 'Merged their first pull request to a libp2p repository',
  },
  [Badge.INTEROP_HERO]: {
    label: 'Interop Hero',
    emoji: '🏆',
    description: 'Made significant contributions to cross-implementation interoperability',
  },
  [Badge.SECURITY_EXPERT]: {
    label: 'Security Expert',
    emoji: '🔒',
    description: 'Identified or fixed a critical security vulnerability',
  },
  [Badge.DOC_MASTER]: {
    label: 'Doc Master',
    emoji: '📚',
    description: 'Authored comprehensive documentation improvements',
  },
  [Badge.CORE_CONTRIBUTOR]: {
    label: 'Core Contributor',
    emoji: '⭐',
    description: 'Consistently contributed high-quality code across multiple modules',
  },
  [Badge.PROTOCOL_DESIGNER]: {
    label: 'Protocol Designer',
    emoji: '🔬',
    description: 'Contributed to protocol design and specification',
  },
};

export interface BadgeRecord {
  badge: Badge;
  issuedAt: string;
  issuedBy: string;
  reason: string;
}

export interface ContributorBadges {
  githubHandle: string;
  badges: BadgeRecord[];
}

const BADGES_FILE = path.join(process.cwd(), 'data', 'badges.json');

export class BadgeSystem {
  private async load(): Promise<Record<string, ContributorBadges>> {
    try {
      const data = await fs.readFile(BADGES_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async save(data: Record<string, ContributorBadges>): Promise<void> {
    await fs.mkdir(path.dirname(BADGES_FILE), { recursive: true });
    await fs.writeFile(BADGES_FILE, JSON.stringify(data, null, 2));
  }

  async issueBadge(
    githubHandle: string,
    badge: Badge,
    issuedBy: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    const data = await this.load();
    const handle = githubHandle.replace(/^@/, '');

    if (!data[handle]) {
      data[handle] = { githubHandle: handle, badges: [] };
    }

    const alreadyHas = data[handle].badges.some((b) => b.badge === badge);
    if (alreadyHas) {
      return {
        success: false,
        message: `${handle} already has badge ${badge}`,
      };
    }

    const record: BadgeRecord = {
      badge,
      issuedAt: new Date().toISOString(),
      issuedBy,
      reason,
    };

    data[handle].badges.push(record);
    await this.save(data);

    const meta = BADGE_METADATA[badge];
    console.log(`Issued badge ${meta.emoji} ${meta.label} to @${handle}: ${reason}`);

    return {
      success: true,
      message: `Issued ${meta.label} badge to @${handle}`,
    };
  }

  async getBadges(githubHandle: string): Promise<BadgeRecord[]> {
    const data = await this.load();
    const handle = githubHandle.replace(/^@/, '');
    return data[handle]?.badges ?? [];
  }

  async verifyBadge(githubHandle: string, badge: Badge): Promise<boolean> {
    const badges = await this.getBadges(githubHandle);
    return badges.some((b) => b.badge === badge);
  }

  async getBadgeDetails(badge: Badge): Promise<(typeof BADGE_METADATA)[Badge]> {
    return BADGE_METADATA[badge];
  }

  async getAllBadgeHolders(badge: Badge): Promise<string[]> {
    const data = await this.load();
    const holders: string[] = [];
    for (const [handle, contributor] of Object.entries(data)) {
      if (contributor.badges.some((b) => b.badge === badge)) {
        holders.push(handle);
      }
    }
    return holders;
  }

  async getContributorBadgeSummary(
    githubHandle: string
  ): Promise<{ badge: Badge; label: string; emoji: string; issuedAt: string }[]> {
    const badges = await this.getBadges(githubHandle);
    return badges.map((b) => ({
      badge: b.badge,
      label: BADGE_METADATA[b.badge].label,
      emoji: BADGE_METADATA[b.badge].emoji,
      issuedAt: b.issuedAt,
    }));
  }

  async revokeBadge(githubHandle: string, badge: Badge): Promise<boolean> {
    const data = await this.load();
    const handle = githubHandle.replace(/^@/, '');
    if (!data[handle]) return false;

    const before = data[handle].badges.length;
    data[handle].badges = data[handle].badges.filter((b) => b.badge !== badge);
    const after = data[handle].badges.length;

    if (before !== after) {
      await this.save(data);
      return true;
    }
    return false;
  }
}
