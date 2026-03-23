export interface AgentStatus {
  id: string;
  name: string;
  status: "idle" | "running" | "error" | "paused";
  lastAction: string;
  lastRun: string;
  nextRun: string;
  actionsToday: number;
  tokenId: number;
  color: string;
  icon: string;
}

export interface SpendingEntry {
  date: string;
  amount: number;
  category: string;
  description: string;
}

export interface RWAAllocation {
  type: string;
  value: number;
  valueUSD: number;
  pct: number;
  color: string;
}

export interface TreasuryData {
  balance: string;
  yieldBalance: string;
  totalRaised: string;
  apy: string;
  monthlyBurn: string;
  runway: string;
  spendingHistory: SpendingEntry[];
  rwaAllocations: RWAAllocation[];
}

export interface Contributor {
  rank: number;
  githubHandle: string;
  score: number;
  badges: string[];
  contributions: number;
  address: string;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  agentName: string;
  agentColor: string;
  action: string;
  details: string;
  txHash?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
  reward?: string;
  claimed: boolean;
  repo: string;
}

export interface EscrowInfo {
  id: string;
  feature: string;
  amount: string;
  state: string;
  deadline: string;
}
