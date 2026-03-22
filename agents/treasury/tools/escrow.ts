import * as fs from 'fs/promises';
import * as path from 'path';

export interface EscrowInfo {
  id: string;
  contractorAddress: string;
  clientAddress: string;
  amount: string; // in wei as string to avoid BigInt serialization issues
  amountEth: number;
  token: 'ETH' | 'USDC' | 'DAI';
  description: string;
  milestoneId: string;
  status: 'pending' | 'active' | 'released' | 'refunded' | 'disputed';
  createdAt: string;
  dueAt: string;
  releasedAt?: string;
  refundedAt?: string;
  txHash?: string;
  prNumber?: number;
  repo?: string;
}

export interface EscrowState {
  escrows: EscrowInfo[];
  lastUpdated: string;
}

export class EscrowTool {
  private statePath: string;
  private mockMode: boolean;

  constructor(mockMode = true, statePath?: string) {
    this.mockMode = mockMode;
    this.statePath = statePath ?? path.join(process.cwd(), 'data', 'escrow-state.json');
  }

  private async loadState(): Promise<EscrowState> {
    try {
      const raw = await fs.readFile(this.statePath, 'utf-8');
      return JSON.parse(raw) as EscrowState;
    } catch {
      const initial = this.getInitialMockState();
      await this.saveState(initial);
      return initial;
    }
  }

  private async saveState(state: EscrowState): Promise<void> {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    state.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  private getInitialMockState(): EscrowState {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 86400000);
    const in14Days = new Date(now.getTime() + 14 * 86400000);
    const past3Days = new Date(now.getTime() - 3 * 86400000);

    return {
      lastUpdated: now.toISOString(),
      escrows: [
        {
          id: 'escrow-001',
          contractorAddress: '0x742d35Cc6634C0532925a3b8D4C9B7B3E3A1F2d4',
          clientAddress: '0xDPIGuardiansMultisig0000000000000000000001',
          amount: '500000000000000000', // 0.5 ETH
          amountEth: 0.5,
          token: 'ETH',
          description: 'QUIC v2 transport implementation — go-libp2p PR #847',
          milestoneId: 'milestone-go-quic-v2',
          status: 'active',
          createdAt: past3Days.toISOString(),
          dueAt: in7Days.toISOString(),
          prNumber: 847,
          repo: 'go-libp2p',
        },
        {
          id: 'escrow-002',
          contractorAddress: '0x8B3F7A2C9E4D1B6A0C5E8F3D7A2B9C4E1F6A0B3',
          clientAddress: '0xDPIGuardiansMultisig0000000000000000000001',
          amount: '300000000000000000', // 0.3 ETH
          amountEth: 0.3,
          token: 'ETH',
          description: 'mDNS peer discovery performance improvements — js-libp2p PR #849',
          milestoneId: 'milestone-js-mdns-perf',
          status: 'active',
          createdAt: new Date(now.getTime() - 1 * 86400000).toISOString(),
          dueAt: in14Days.toISOString(),
          prNumber: 849,
          repo: 'js-libp2p',
        },
        {
          id: 'escrow-003',
          contractorAddress: '0xC4D7E9A2B5F8C1E4A7D0B3F6C9E2A5B8D1F4C7E',
          clientAddress: '0xDPIGuardiansMultisig0000000000000000000001',
          amount: '1000000000000000000', // 1.0 ETH
          amountEth: 1.0,
          token: 'ETH',
          description: 'Noise protocol implementation audit — rust-libp2p',
          milestoneId: 'milestone-rust-noise-audit',
          status: 'pending',
          createdAt: now.toISOString(),
          dueAt: in14Days.toISOString(),
          repo: 'rust-libp2p',
        },
        {
          id: 'escrow-004',
          contractorAddress: '0xA1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0',
          clientAddress: '0xDPIGuardiansMultisig0000000000000000000001',
          amount: '200000000000000000', // 0.2 ETH
          amountEth: 0.2,
          token: 'ETH',
          description: 'Documentation update — libp2p onboarding guide',
          milestoneId: 'milestone-docs-onboarding',
          status: 'released',
          createdAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
          dueAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
          releasedAt: new Date(now.getTime() - 1 * 86400000).toISOString(),
          txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
          repo: 'go-libp2p',
        },
      ],
    };
  }

  async getActiveEscrows(): Promise<EscrowInfo[]> {
    const state = await this.loadState();
    return state.escrows.filter(e => e.status === 'active' || e.status === 'pending');
  }

  async getEscrowById(id: string): Promise<EscrowInfo | null> {
    const state = await this.loadState();
    return state.escrows.find(e => e.id === id) ?? null;
  }

  async getAllEscrows(): Promise<EscrowInfo[]> {
    const state = await this.loadState();
    return state.escrows;
  }

  async releaseEscrow(id: string): Promise<{ success: boolean; txHash: string; error?: string }> {
    const state = await this.loadState();
    const escrow = state.escrows.find(e => e.id === id);

    if (!escrow) {
      return { success: false, txHash: '', error: `Escrow ${id} not found` };
    }

    if (escrow.status !== 'active' && escrow.status !== 'pending') {
      return {
        success: false,
        txHash: '',
        error: `Cannot release escrow in status: ${escrow.status}`,
      };
    }

    if (this.mockMode) {
      // Simulate on-chain release
      const mockTxHash = '0x' + Array.from({ length: 64 }, (_, i) =>
        ((id.charCodeAt(i % id.length) + i) % 16).toString(16)
      ).join('');

      escrow.status = 'released';
      escrow.releasedAt = new Date().toISOString();
      escrow.txHash = mockTxHash;

      await this.saveState(state);
      console.log(`[MOCK EscrowTool] Released escrow ${id}: ${escrow.amountEth} ETH → ${escrow.contractorAddress}`);
      return { success: true, txHash: mockTxHash };
    }

    // Real on-chain release would use ethers v6 here
    // const provider = new ethers.JsonRpcProvider(rpcUrl);
    // const signer = new ethers.Wallet(privateKey, provider);
    // const contract = new ethers.Contract(escrowContractAddress, ESCROW_ABI, signer);
    // const tx = await contract.release(escrow.milestoneId);
    // await tx.wait();
    return { success: false, txHash: '', error: 'On-chain release not implemented in non-mock mode' };
  }

  async refundEscrow(id: string, reason: string): Promise<{ success: boolean; txHash: string; error?: string }> {
    const state = await this.loadState();
    const escrow = state.escrows.find(e => e.id === id);

    if (!escrow) {
      return { success: false, txHash: '', error: `Escrow ${id} not found` };
    }

    if (escrow.status !== 'active' && escrow.status !== 'pending') {
      return {
        success: false,
        txHash: '',
        error: `Cannot refund escrow in status: ${escrow.status}`,
      };
    }

    if (this.mockMode) {
      const mockTxHash = '0xrefund' + Array.from({ length: 58 }, (_, i) =>
        ((id.charCodeAt(i % id.length) * 3 + i) % 16).toString(16)
      ).join('');

      escrow.status = 'refunded';
      escrow.refundedAt = new Date().toISOString();
      escrow.txHash = mockTxHash;
      // Store reason in description
      escrow.description = `[REFUNDED: ${reason}] ${escrow.description}`;

      await this.saveState(state);
      console.log(`[MOCK EscrowTool] Refunded escrow ${id}: ${escrow.amountEth} ETH → ${escrow.clientAddress}. Reason: ${reason}`);
      return { success: true, txHash: mockTxHash };
    }

    return { success: false, txHash: '', error: 'On-chain refund not implemented in non-mock mode' };
  }

  async getTotalLockedValue(): Promise<number> {
    const active = await this.getActiveEscrows();
    return active.reduce((sum, e) => sum + e.amountEth, 0);
  }

  async getEscrowsByRepo(repo: string): Promise<EscrowInfo[]> {
    const state = await this.loadState();
    return state.escrows.filter(e => e.repo === repo);
  }
}
