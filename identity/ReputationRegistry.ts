import * as fs from 'fs/promises';
import * as path from 'path';

export interface ContributorReputation {
  githubHandle: string;
  score: number;
  badges: string[];
  lastUpdated: string;
}

const REPUTATION_FILE = path.join(process.cwd(), 'data', 'reputation.json');

export class ReputationRegistry {
  private async load(): Promise<Record<string, ContributorReputation>> {
    try {
      const data = await fs.readFile(REPUTATION_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async save(data: Record<string, ContributorReputation>): Promise<void> {
    await fs.mkdir(path.dirname(REPUTATION_FILE), { recursive: true });
    await fs.writeFile(REPUTATION_FILE, JSON.stringify(data, null, 2));
  }

  async getScore(githubHandle: string): Promise<number> {
    const data = await this.load();
    const handle = githubHandle.replace(/^@/, '');
    return data[handle]?.score ?? 0;
  }

  async setScore(githubHandle: string, score: number): Promise<void> {
    const data = await this.load();
    const handle = githubHandle.replace(/^@/, '');
    if (!data[handle]) {
      data[handle] = {
        githubHandle: handle,
        score: 0,
        badges: [],
        lastUpdated: new Date().toISOString(),
      };
    }
    data[handle].score = score;
    data[handle].lastUpdated = new Date().toISOString();
    await this.save(data);
  }

  async incrementScore(githubHandle: string, amount: number): Promise<number> {
    const current = await this.getScore(githubHandle);
    const newScore = current + amount;
    await this.setScore(githubHandle, newScore);
    return newScore;
  }

  async getBadges(githubHandle: string): Promise<string[]> {
    const data = await this.load();
    const handle = githubHandle.replace(/^@/, '');
    return data[handle]?.badges ?? [];
  }

  async grantBadge(githubHandle: string, badge: string): Promise<void> {
    const data = await this.load();
    const handle = githubHandle.replace(/^@/, '');
    if (!data[handle]) {
      data[handle] = {
        githubHandle: handle,
        score: 0,
        badges: [],
        lastUpdated: new Date().toISOString(),
      };
    }
    if (!data[handle].badges.includes(badge)) {
      data[handle].badges.push(badge);
      data[handle].lastUpdated = new Date().toISOString();
      await this.save(data);
    }
  }

  async hasBadge(githubHandle: string, badge: string): Promise<boolean> {
    const badges = await this.getBadges(githubHandle);
    return badges.includes(badge);
  }

  async getContributor(githubHandle: string): Promise<ContributorReputation | null> {
    const data = await this.load();
    const handle = githubHandle.replace(/^@/, '');
    return data[handle] ?? null;
  }

  async getAllContributors(): Promise<ContributorReputation[]> {
    const data = await this.load();
    return Object.values(data);
  }

  async getTopContributors(limit = 10): Promise<ContributorReputation[]> {
    const all = await this.getAllContributors();
    return all.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
