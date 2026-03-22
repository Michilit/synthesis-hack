export interface AgentSchedule {
  agentId: string;
  name: string;
  cron: string;
  description: string;
  enabled: boolean;
}

export interface SwarmConfig {
  agents: AgentSchedule[];
  storageMode: 'local' | 'filecoin';
  networkRpc: string;
  mockLLM: boolean;
  demoMode: boolean;
  contractAddresses: Record<string, string>;
}

export const defaultConfig: SwarmConfig = {
  agents: [
    {
      agentId: 'maintainer',
      name: 'MaintainerAgent',
      cron: '0 */6 * * *',
      description: 'Reviews PRs, manages dependencies, curates tasks — runs every 6 hours',
      enabled: true,
    },
    {
      agentId: 'treasury',
      name: 'TreasuryAgent',
      cron: '0 9 * * *',
      description: 'Manages funds, generates P&L reports, handles escrow — runs daily at 9am',
      enabled: true,
    },
    {
      agentId: 'community',
      name: 'CommunityAgent',
      cron: '0 10 * * 1',
      description: 'Generates newsletter, discovers ecosystem projects — runs Mondays at 10am',
      enabled: true,
    },
    {
      agentId: 'review',
      name: 'ReviewAgent',
      cron: '0 */6 * * *',
      description: 'Scores PR quality, detects AI slop, issues badges — runs every 6 hours',
      enabled: true,
    },
    {
      agentId: 'support',
      name: 'SupportAgent',
      cron: 'on-demand',
      description: 'Answers developer questions, improves DX — triggered on-demand',
      enabled: true,
    },
  ],
  storageMode: 'local',
  networkRpc: 'http://127.0.0.1:8545',
  mockLLM: true,
  demoMode: true,
  contractAddresses: {},
};
