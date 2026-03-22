import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentBase, AgentConfig } from '../base/AgentBase';
import { EscrowTool, EscrowInfo } from './tools/escrow';
import { ContextTool } from '../maintainer/tools/context';

export interface YieldPosition {
  protocol: string;
  asset: string;
  deposited: number;
  currentValue: number;
  apy: number;
  earnedToDate: number;
  lastCompound?: string;
}

export interface TreasuryState {
  address: string;
  lastUpdated: string;
  balances: {
    eth: number;
    usdc: number;
    dai: number;
  };
  yieldPositions: YieldPosition[];
  totalValueEth: number;
  monthlyBurnEth: number;
  runwayMonths: number;
  revenueThisMonth: number;
  costsThisMonth: number;
  pendingEscrowEth: number;
}

export interface RebalanceProposal {
  action: 'increase-yield' | 'reduce-yield' | 'swap-asset' | 'no-action';
  description: string;
  estimatedImpact: string;
  urgency: 'low' | 'medium' | 'high';
}

export class TreasuryAgent extends AgentBase {
  private escrow: EscrowTool;
  private context: ContextTool;
  private statePath: string;

  constructor(config: AgentConfig) {
    super('treasury-agent', 'TreasuryAgent', config);
    this.escrow = new EscrowTool(config.demoMode || config.mockLLM);
    this.context = new ContextTool();
    this.statePath = path.join(process.cwd(), 'data', 'treasury-state.json');
  }

  private async loadTreasuryState(): Promise<TreasuryState> {
    try {
      const raw = await fs.readFile(this.statePath, 'utf-8');
      return JSON.parse(raw) as TreasuryState;
    } catch {
      const initial: TreasuryState = {
        address: '0xDPIGuardiansMultisig0000000000000000000001',
        lastUpdated: new Date().toISOString(),
        balances: { eth: 8.5, usdc: 4200, dai: 1800 },
        yieldPositions: [
          {
            protocol: 'Aave v3',
            asset: 'USDC',
            deposited: 3000,
            currentValue: 3157.23,
            apy: 4.8,
            earnedToDate: 157.23,
            lastCompound: new Date(Date.now() - 24 * 3600000).toISOString(),
          },
          {
            protocol: 'Lido',
            asset: 'stETH',
            deposited: 2.0,
            currentValue: 2.082,
            apy: 3.9,
            earnedToDate: 0.082,
            lastCompound: new Date(Date.now() - 12 * 3600000).toISOString(),
          },
          {
            protocol: 'Compound v3',
            asset: 'DAI',
            deposited: 1500,
            currentValue: 1561.88,
            apy: 5.2,
            earnedToDate: 61.88,
            lastCompound: new Date(Date.now() - 6 * 3600000).toISOString(),
          },
        ],
        totalValueEth: 14.2,
        monthlyBurnEth: 1.8,
        runwayMonths: 7.9,
        revenueThisMonth: 2.5,
        costsThisMonth: 0.3,
        pendingEscrowEth: 0,
      };
      await this.saveTreasuryState(initial);
      return initial;
    }
  }

  private async saveTreasuryState(state: TreasuryState): Promise<void> {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    state.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  async run(): Promise<void> {
    this.log('info', 'TreasuryAgent starting run cycle');
    const startTime = Date.now();

    // Step 1: Load treasury state
    const state = await this.loadTreasuryState();
    this.log('info', `Treasury balance: ${state.balances.eth} ETH, runway: ${state.runwayMonths} months`);

    // Step 2: Check yield positions
    const yieldReport = await this.checkYield(state);
    this.log('info', `Yield check complete. Total yield positions: ${state.yieldPositions.length}`);

    // Step 3: Run rebalancing check
    const rebalanceProposal = await this.proposeRebalance(state);
    this.log('info', `Rebalance proposal: ${rebalanceProposal.action} — ${rebalanceProposal.urgency} urgency`);

    // Step 4: Generate P&L report via LLM
    const pnlReport = await this.generatePnLReport(state);
    this.log('info', 'P&L report generated');

    // Step 5: Check and process pending escrows
    const activeEscrows = await this.escrow.getActiveEscrows();
    const pendingEscrowEth = await this.escrow.getTotalLockedValue();
    state.pendingEscrowEth = pendingEscrowEth;
    this.log('info', `Active escrows: ${activeEscrows.length}, total locked: ${pendingEscrowEth} ETH`);

    const escrowActions = await this.processEscrows(activeEscrows, state);

    // Step 6: Update context with financial summary
    const financialSummary = this.buildFinancialSummary(state, yieldReport, rebalanceProposal, escrowActions);
    await this.context.appendSection('Treasury Status', financialSummary);
    await this.context.appendSection('Latest P&L Report', pnlReport);

    // Step 7: Save updated treasury state
    await this.saveTreasuryState(state);

    const elapsedMs = Date.now() - startTime;
    this.log('info', 'TreasuryAgent run complete', {
      elapsedMs,
      totalValueEth: state.totalValueEth,
      runwayMonths: state.runwayMonths,
      pendingEscrowEth,
      inferenceCostUsd: this.getInferenceCost().toFixed(6),
    });
  }

  async generatePnLReport(state: TreasuryState): Promise<string> {
    const totalYieldEarned = state.yieldPositions.reduce((sum, p) => sum + p.earnedToDate, 0);
    const netEth = state.revenueThisMonth - state.costsThisMonth;

    const systemPrompt = `You are a DeFi treasury analyst for a decentralized protocol infrastructure (DPI) project called DPI Guardians.
Generate a concise monthly P&L summary in markdown format. Be precise with numbers. Include health assessment and actionable recommendations.`;

    const userMessage = [
      `## Treasury Data for P&L Report`,
      ``,
      `**Treasury Address:** ${state.address}`,
      `**Report Date:** ${new Date().toISOString()}`,
      ``,
      `### Current Balances`,
      `- ETH: ${state.balances.eth}`,
      `- USDC: ${state.balances.usdc}`,
      `- DAI: ${state.balances.dai}`,
      `- Total Value (ETH equiv): ${state.totalValueEth}`,
      ``,
      `### This Month`,
      `- Revenue: ${state.revenueThisMonth} ETH`,
      `- Costs: ${state.costsThisMonth} ETH`,
      `- Net: ${netEth.toFixed(4)} ETH`,
      ``,
      `### Yield Positions`,
      ...state.yieldPositions.map(p =>
        `- ${p.protocol} (${p.asset}): ${p.deposited} deposited, ${p.currentValue.toFixed(4)} current, ${p.apy}% APY, earned ${p.earnedToDate.toFixed(4)}`
      ),
      `- Total yield earned to date: ${totalYieldEarned.toFixed(4)}`,
      ``,
      `### Burn Rate & Runway`,
      `- Monthly burn: ${state.monthlyBurnEth} ETH`,
      `- Runway: ${state.runwayMonths.toFixed(1)} months`,
      `- Pending escrow locked: ${state.pendingEscrowEth} ETH`,
    ].join('\n');

    return this.callLLM(systemPrompt, userMessage);
  }

  async checkYield(state: TreasuryState): Promise<string> {
    const now = new Date();
    let report = '### Yield Position Updates\n\n';

    for (const position of state.yieldPositions) {
      // Simulate daily yield accrual
      const dailyRate = position.apy / 100 / 365;
      const lastCompound = position.lastCompound ? new Date(position.lastCompound) : new Date(now.getTime() - 86400000);
      const daysSinceCompound = (now.getTime() - lastCompound.getTime()) / 86400000;
      const newYield = position.currentValue * dailyRate * daysSinceCompound;

      position.currentValue = parseFloat((position.currentValue + newYield).toFixed(6));
      position.earnedToDate = parseFloat((position.earnedToDate + newYield).toFixed(6));
      position.lastCompound = now.toISOString();

      report += `- **${position.protocol}** (${position.asset}): +${newYield.toFixed(6)} accrued, total ${position.earnedToDate.toFixed(6)} earned\n`;
    }

    // Recalculate total value
    const ethPrice = 3200; // mock ETH price in USD
    const usdcValue = state.balances.usdc + state.yieldPositions
      .filter(p => p.asset === 'USDC' || p.asset === 'DAI')
      .reduce((sum, p) => sum + p.currentValue, 0);
    const stEthValue = state.yieldPositions
      .filter(p => p.asset === 'stETH')
      .reduce((sum, p) => sum + p.currentValue, 0);

    state.totalValueEth = parseFloat((state.balances.eth + stEthValue + usdcValue / ethPrice + state.balances.dai / ethPrice).toFixed(4));
    state.runwayMonths = parseFloat((state.totalValueEth / state.monthlyBurnEth).toFixed(1));

    return report;
  }

  async proposeRebalance(state: TreasuryState): Promise<RebalanceProposal> {
    const totalYieldApy = state.yieldPositions.reduce(
      (sum, p) => sum + p.apy * (p.currentValue / state.totalValueEth),
      0
    );

    // Check if we have too much idle ETH not earning yield
    const yieldedEth = state.yieldPositions.reduce((sum, p) => {
      if (p.asset === 'stETH') return sum + p.currentValue;
      return sum;
    }, 0);
    const idleEthRatio = (state.balances.eth - yieldedEth) / state.totalValueEth;

    if (state.runwayMonths < 3) {
      return {
        action: 'reduce-yield',
        description: 'Runway below 3 months. Withdraw yield positions to increase liquid ETH reserves.',
        estimatedImpact: `Unwinding ${state.yieldPositions[0]?.protocol} position would add ${state.yieldPositions[0]?.currentValue.toFixed(4)} ${state.yieldPositions[0]?.asset} to liquid reserves`,
        urgency: 'high',
      };
    }

    if (idleEthRatio > 0.4) {
      return {
        action: 'increase-yield',
        description: `${(idleEthRatio * 100).toFixed(1)}% of ETH is idle. Consider depositing into Lido (stETH) for ~3.9% APY.`,
        estimatedImpact: `Depositing 1 ETH into Lido would earn ~0.039 ETH/year at current rates`,
        urgency: 'low',
      };
    }

    if (totalYieldApy < 3.5) {
      return {
        action: 'swap-asset',
        description: `Blended yield APY is ${totalYieldApy.toFixed(2)}%. Consider moving USDC from Aave to a higher-yield protocol.`,
        estimatedImpact: 'Switching to a 6% APY position would increase annual yield by ~$180 on the $3000 USDC position',
        urgency: 'medium',
      };
    }

    return {
      action: 'no-action',
      description: `Treasury is healthy. Blended APY: ${totalYieldApy.toFixed(2)}%, runway: ${state.runwayMonths} months.`,
      estimatedImpact: 'No changes needed at this time',
      urgency: 'low',
    };
  }

  private async processEscrows(escrows: EscrowInfo[], state: TreasuryState): Promise<string[]> {
    const actions: string[] = [];
    const now = new Date();

    for (const escrow of escrows) {
      const dueDate = new Date(escrow.dueAt);
      const daysUntilDue = (dueDate.getTime() - now.getTime()) / 86400000;

      if (daysUntilDue < 0 && escrow.status === 'active') {
        // Overdue — flag for human review rather than auto-refund
        actions.push(`⚠️ OVERDUE: ${escrow.id} (${escrow.description}) was due ${Math.abs(daysUntilDue).toFixed(0)} days ago — manual review required`);
        this.log('warn', `Overdue escrow: ${escrow.id}`, { daysOverdue: Math.abs(daysUntilDue).toFixed(0) });
      } else if (daysUntilDue < 2 && escrow.status === 'active') {
        actions.push(`⏰ DUE SOON: ${escrow.id} — ${escrow.description} due in ${daysUntilDue.toFixed(1)} days`);
        this.log('warn', `Escrow due soon: ${escrow.id}`, { daysUntilDue: daysUntilDue.toFixed(1) });
      } else {
        actions.push(`✅ OK: ${escrow.id} — ${escrow.amountEth} ETH locked, due ${dueDate.toLocaleDateString()}`);
      }
    }

    return actions;
  }

  private buildFinancialSummary(
    state: TreasuryState,
    yieldReport: string,
    rebalance: RebalanceProposal,
    escrowActions: string[]
  ): string {
    return [
      `**Last Updated:** ${new Date().toISOString()}`,
      `**Total Value:** ${state.totalValueEth} ETH`,
      `**Runway:** ${state.runwayMonths} months`,
      `**Net This Month:** ${(state.revenueThisMonth - state.costsThisMonth).toFixed(4)} ETH`,
      ``,
      yieldReport,
      ``,
      `### Rebalance Check`,
      `**Action:** ${rebalance.action} (${rebalance.urgency} urgency)`,
      rebalance.description,
      ``,
      `### Escrow Status`,
      ...escrowActions,
    ].join('\n');
  }
}
