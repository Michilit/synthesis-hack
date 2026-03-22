import * as fs from 'fs/promises';
import * as path from 'path';

export interface AgentIdentityConfig {
  tokenId: number;
  name: string;
  capabilities: string[];
  serviceEndpoints: string[];
  paymentAddress: string;
  metadataURI: string;
}

const IDENTITIES_FILE = path.join(process.cwd(), 'data', 'agent-identities.json');

export class AgentIdentityManager {
  private demoMode: boolean;

  constructor(demoMode = true) {
    this.demoMode = demoMode;
  }

  async registerAgent(config: Omit<AgentIdentityConfig, 'tokenId'>): Promise<number> {
    const identities = await this.loadIdentities();
    const tokenId = Object.keys(identities).length + 1;
    identities[tokenId] = { ...config, tokenId };
    await this.saveIdentities(identities);
    console.log(`Registered agent "${config.name}" with tokenId ${tokenId}`);
    return tokenId;
  }

  async resolveAgent(tokenId: number): Promise<AgentIdentityConfig | null> {
    const identities = await this.loadIdentities();
    return identities[tokenId] || null;
  }

  async getTokenIdByOwner(paymentAddress: string): Promise<number | null> {
    const identities = await this.loadIdentities();
    const entry = Object.values(identities).find(
      (id: AgentIdentityConfig) => id.paymentAddress.toLowerCase() === paymentAddress.toLowerCase()
    );
    return entry ? entry.tokenId : null;
  }

  async verifyAgent(tokenId: number): Promise<boolean> {
    const identity = await this.resolveAgent(tokenId);
    return identity !== null;
  }

  async getAllAgents(): Promise<AgentIdentityConfig[]> {
    const identities = await this.loadIdentities();
    return Object.values(identities);
  }

  private async loadIdentities(): Promise<Record<number, AgentIdentityConfig>> {
    try {
      const data = await fs.readFile(IDENTITIES_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async saveIdentities(identities: Record<number, AgentIdentityConfig>): Promise<void> {
    await fs.mkdir(path.dirname(IDENTITIES_FILE), { recursive: true });
    await fs.writeFile(IDENTITIES_FILE, JSON.stringify(identities, null, 2));
  }
}
