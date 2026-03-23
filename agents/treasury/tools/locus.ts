/**
 * Mock Locus spending control integration
 * Locus provides programmable spending limits for AI agents
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SpendBreakdown {
  agents: number;
  stewardshipTeams: number;
  infrastructure: number;
  audits: number;
  humanCosts: number;
  total: number;
}

interface SpendRecord {
  timestamp: string;
  amount: number;
  category: string;
  description: string;
  agentTokenId?: number;
}

const SPEND_LOG_PATH = path.join(__dirname, '../../data/spend-log.json');

export class LocusTool {
  threshold: number = 0.01; // ETH — matches AUTO_SPEND_THRESHOLD in Treasury.sol

  private loadLog(): SpendRecord[] {
    const dir = path.dirname(SPEND_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(SPEND_LOG_PATH)) return [];
    return JSON.parse(fs.readFileSync(SPEND_LOG_PATH, 'utf-8'));
  }

  private saveLog(records: SpendRecord[]): void {
    fs.writeFileSync(SPEND_LOG_PATH, JSON.stringify(records, null, 2));
  }

  async checkSpendingAllowed(amount: number, description: string, agentTokenId?: number): Promise<boolean> {
    if (amount > this.threshold) {
      console.log(`[Locus] Spend blocked: ${amount} ETH exceeds threshold ${this.threshold} ETH. Requires Board approval.`);
      return false;
    }
    if (description.length > 500) {
      console.log('[Locus] Spend blocked: description too long (potential injection).');
      return false;
    }
    console.log(`[Locus] Spend approved: ${amount} ETH for "${description.slice(0, 80)}"`);
    return true;
  }

  async recordSpend(amount: number, category: string, description?: string, agentTokenId?: number): Promise<void> {
    const records = this.loadLog();
    records.push({
      timestamp: new Date().toISOString(),
      amount,
      category,
      description: description || '',
      agentTokenId,
    });
    this.saveLog(records);
  }

  async getMonthlySpend(): Promise<SpendBreakdown> {
    const records = this.loadLog();
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = records.filter(r => new Date(r.timestamp).getTime() > monthAgo);

    const breakdown: SpendBreakdown = {
      agents: 0, stewardshipTeams: 0, infrastructure: 0, audits: 0, humanCosts: 0, total: 0
    };

    for (const r of recent) {
      breakdown.total += r.amount;
      if (r.category === 'agents') breakdown.agents += r.amount;
      else if (r.category === 'stewardship') breakdown.stewardshipTeams += r.amount;
      else if (r.category === 'infrastructure') breakdown.infrastructure += r.amount;
      else if (r.category === 'audits') breakdown.audits += r.amount;
      else breakdown.humanCosts += r.amount;
    }

    return breakdown;
  }
}
