import * as fs from 'fs';
import * as path from 'path';

const HISTORY_PATH = path.join(__dirname, '../data/funding-history.json');

export type UserType = 'human_no_donation' | 'human_below_avg' | 'human_above_avg' | 'agent';

interface FundingRecord {
  userId: string;
  lastShown: string;
  totalDonated: number;
  showCount: number;
}

interface FundingHistory {
  records: Record<string, FundingRecord>;
  averageDonation: number;
  lastUpdated: string;
}

// Rate limits in milliseconds
const LIMITS: Record<UserType, number> = {
  human_no_donation:  15 * 24 * 60 * 60 * 1000,  // twice/month ≈ every 15 days
  human_below_avg:   180 * 24 * 60 * 60 * 1000,  // once per 6 months
  human_above_avg:   365 * 24 * 60 * 60 * 1000,  // once per year
  agent:               7 * 24 * 60 * 60 * 1000,  // once per week
};

export class RateLimiter {
  private history: FundingHistory;

  constructor() {
    this.history = this.load();
  }

  private load(): FundingHistory {
    const dir = path.dirname(HISTORY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(HISTORY_PATH)) {
      return { records: {}, averageDonation: 0, lastUpdated: new Date().toISOString() };
    }
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
  }

  private save(): void {
    this.history.lastUpdated = new Date().toISOString();
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(this.history, null, 2));
  }

  getUserType(userId: string): UserType {
    const record = this.history.records[userId];
    if (!record || record.totalDonated === 0) return 'human_no_donation';
    if (userId.startsWith('agent:') || process.env.AGENT_MODE === 'true') return 'agent';
    if (record.totalDonated >= this.history.averageDonation) return 'human_above_avg';
    return 'human_below_avg';
  }

  shouldShowPrompt(userId: string, userType?: UserType): boolean {
    const type = userType || this.getUserType(userId);
    const record = this.history.records[userId];
    if (!record) return true;

    const lastShown = new Date(record.lastShown).getTime();
    const elapsed = Date.now() - lastShown;
    return elapsed >= LIMITS[type];
  }

  recordShow(userId: string): void {
    if (!this.history.records[userId]) {
      this.history.records[userId] = { userId, lastShown: '', totalDonated: 0, showCount: 0 };
    }
    this.history.records[userId].lastShown = new Date().toISOString();
    this.history.records[userId].showCount += 1;
    this.save();
  }

  recordDonation(userId: string, amount: number): void {
    if (!this.history.records[userId]) {
      this.history.records[userId] = { userId, lastShown: new Date().toISOString(), totalDonated: 0, showCount: 0 };
    }
    this.history.records[userId].totalDonated += amount;

    // Recalculate average
    const totals = Object.values(this.history.records)
      .filter(r => r.totalDonated > 0)
      .map(r => r.totalDonated);
    this.history.averageDonation = totals.length > 0
      ? totals.reduce((a, b) => a + b, 0) / totals.length
      : 0;

    this.save();
  }
}
