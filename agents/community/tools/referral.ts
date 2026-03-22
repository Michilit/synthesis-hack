import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ReferralLink {
  id: string;
  code: string;
  url: string;
  createdBy: string;
  createdAt: string;
  description: string;
  campaign: string;
  clicks: number;
  conversions: number;
  revenueEth: number;
  active: boolean;
}

export interface ReferralRevenue {
  linkId: string;
  code: string;
  amountEth: number;
  source: string;
  timestamp: string;
  txHash?: string;
}

export interface ReferralState {
  links: ReferralLink[];
  revenueEvents: ReferralRevenue[];
  totalRevenueEth: number;
  lastUpdated: string;
}

export class ReferralTool {
  private statePath: string;
  private mockMode: boolean;
  private baseUrl: string;

  constructor(mockMode = true, statePath?: string, baseUrl = 'https://libp2p.io/ref') {
    this.mockMode = mockMode;
    this.statePath = statePath ?? path.join(process.cwd(), 'data', 'referral-state.json');
    this.baseUrl = baseUrl;
  }

  private async loadState(): Promise<ReferralState> {
    try {
      const raw = await fs.readFile(this.statePath, 'utf-8');
      return JSON.parse(raw) as ReferralState;
    } catch {
      const initial = this.getInitialMockState();
      await this.saveState(initial);
      return initial;
    }
  }

  private async saveState(state: ReferralState): Promise<void> {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    state.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  private getInitialMockState(): ReferralState {
    const now = new Date();
    return {
      lastUpdated: now.toISOString(),
      totalRevenueEth: 0.847,
      links: [
        {
          id: 'ref-001',
          code: 'ETH-STORAGE-2024',
          url: `${this.baseUrl}/ETH-STORAGE-2024`,
          createdBy: 'CommunityAgent',
          createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
          description: 'EthStorage integration referral',
          campaign: 'ecosystem-partnerships-q1-2026',
          clicks: 847,
          conversions: 23,
          revenueEth: 0.46,
          active: true,
        },
        {
          id: 'ref-002',
          code: 'WAKU-COLLAB',
          url: `${this.baseUrl}/WAKU-COLLAB`,
          createdBy: 'CommunityAgent',
          createdAt: new Date(now.getTime() - 14 * 86400000).toISOString(),
          description: 'Waku protocol collaboration referral',
          campaign: 'ecosystem-partnerships-q1-2026',
          clicks: 312,
          conversions: 8,
          revenueEth: 0.19,
          active: true,
        },
        {
          id: 'ref-003',
          code: 'DEVCONF-MARCH',
          url: `${this.baseUrl}/DEVCONF-MARCH`,
          createdBy: 'CommunityAgent',
          createdAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
          description: 'DevConf March 2026 conference referral',
          campaign: 'conference-march-2026',
          clicks: 156,
          conversions: 4,
          revenueEth: 0.197,
          active: true,
        },
        {
          id: 'ref-004',
          code: 'NEWSLETTER-FEB',
          url: `${this.baseUrl}/NEWSLETTER-FEB`,
          createdBy: 'CommunityAgent',
          createdAt: new Date(now.getTime() - 45 * 86400000).toISOString(),
          description: 'February 2026 newsletter CTA',
          campaign: 'newsletter-feb-2026',
          clicks: 423,
          conversions: 12,
          revenueEth: 0.0,
          active: false,
        },
      ],
      revenueEvents: [
        {
          linkId: 'ref-001',
          code: 'ETH-STORAGE-2024',
          amountEth: 0.2,
          source: 'EthStorage protocol integration fee',
          timestamp: new Date(now.getTime() - 20 * 86400000).toISOString(),
          txHash: '0xabc123def456789012345678901234567890abcdef1234567890abcdef123456',
        },
        {
          linkId: 'ref-001',
          code: 'ETH-STORAGE-2024',
          amountEth: 0.26,
          source: 'EthStorage usage fee Q1 2026',
          timestamp: new Date(now.getTime() - 5 * 86400000).toISOString(),
          txHash: '0xdef789abc012345678901234567890abcdef1234567890abcdef123456789012',
        },
        {
          linkId: 'ref-002',
          code: 'WAKU-COLLAB',
          amountEth: 0.19,
          source: 'Waku protocol maintenance fee',
          timestamp: new Date(now.getTime() - 3 * 86400000).toISOString(),
          txHash: '0x456789abcdef012345678901234567890abcdef1234567890abcdef12345678',
        },
      ],
    };
  }

  async generateLink(campaign: string, description: string, createdBy = 'CommunityAgent'): Promise<ReferralLink> {
    const state = await this.loadState();

    const codeBytes = crypto.randomBytes(6);
    const code = campaign.toUpperCase().replace(/[^A-Z0-9]/g, '-').substring(0, 12) +
      '-' + codeBytes.toString('hex').toUpperCase().substring(0, 6);

    const link: ReferralLink = {
      id: 'ref-' + (state.links.length + 1).toString().padStart(3, '0'),
      code,
      url: `${this.baseUrl}/${code}`,
      createdBy,
      createdAt: new Date().toISOString(),
      description,
      campaign,
      clicks: 0,
      conversions: 0,
      revenueEth: 0,
      active: true,
    };

    state.links.push(link);
    await this.saveState(state);

    this.log(`Generated referral link: ${link.url} for campaign: ${campaign}`);
    return link;
  }

  async getStats(linkId?: string): Promise<{
    totalLinks: number;
    activeLinks: number;
    totalClicks: number;
    totalConversions: number;
    totalRevenueEth: number;
    conversionRate: number;
    links?: ReferralLink[];
  }> {
    const state = await this.loadState();
    const links = linkId ? state.links.filter(l => l.id === linkId) : state.links;

    const totalClicks = links.reduce((sum, l) => sum + l.clicks, 0);
    const totalConversions = links.reduce((sum, l) => sum + l.conversions, 0);
    const totalRevenueEth = links.reduce((sum, l) => sum + l.revenueEth, 0);

    return {
      totalLinks: state.links.length,
      activeLinks: state.links.filter(l => l.active).length,
      totalClicks,
      totalConversions,
      totalRevenueEth,
      conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
      links: linkId ? links : undefined,
    };
  }

  async trackRevenue(linkId: string, amountEth: number, source: string, txHash?: string): Promise<void> {
    const state = await this.loadState();
    const link = state.links.find(l => l.id === linkId);

    if (!link) {
      throw new Error(`Referral link ${linkId} not found`);
    }

    const event: ReferralRevenue = {
      linkId,
      code: link.code,
      amountEth,
      source,
      timestamp: new Date().toISOString(),
      txHash,
    };

    link.revenueEth += amountEth;
    link.conversions += 1;
    state.revenueEvents.push(event);
    state.totalRevenueEth += amountEth;

    await this.saveState(state);
    this.log(`Tracked ${amountEth} ETH revenue for link ${linkId} (${link.code}): ${source}`);
  }

  async incrementClicks(code: string): Promise<void> {
    const state = await this.loadState();
    const link = state.links.find(l => l.code === code);
    if (link) {
      link.clicks += 1;
      await this.saveState(state);
    }
  }

  async getTopLinks(limit = 5): Promise<ReferralLink[]> {
    const state = await this.loadState();
    return [...state.links]
      .sort((a, b) => b.revenueEth - a.revenueEth)
      .slice(0, limit);
  }

  async deactivateLink(linkId: string): Promise<void> {
    const state = await this.loadState();
    const link = state.links.find(l => l.id === linkId);
    if (link) {
      link.active = false;
      await this.saveState(state);
    }
  }

  private log(message: string): void {
    if (this.mockMode) {
      console.log(`[MOCK ReferralTool] ${message}`);
    }
  }
}
