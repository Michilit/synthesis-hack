import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger, transports, format } from 'winston';

export interface AgentConfig {
  agentId: string;
  openaiApiKey?: string; // kept for compat
  anthropicApiKey?: string;
  storageMode: 'local' | 'filecoin';
  contractAddresses: Record<string, string>;
  networkRpc: string;
  privateKey: string;
  mockLLM: boolean;
  demoMode: boolean;
}

export abstract class AgentBase {
  protected agentId: string;
  protected agentName: string;
  protected config: AgentConfig;
  protected logger: ReturnType<typeof createLogger>;
  protected anthropic: Anthropic | null = null;
  private inferenceCost = 0;
  private contextPath: string;

  constructor(agentId: string, agentName: string, config: AgentConfig) {
    this.agentId = agentId;
    this.agentName = agentName;
    this.config = config;
    this.contextPath = path.join(process.cwd(), 'data', 'context.md');

    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message }) =>
          `[${timestamp}] [${agentName}] ${level.toUpperCase()}: ${message}`
        )
      ),
      transports: [new transports.Console()],
    });

    if (!config.mockLLM && config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  protected log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    this.logger[level](data ? `${message} ${JSON.stringify(data)}` : message);
  }

  protected async loadContext(): Promise<string> {
    try {
      return await fs.readFile(this.contextPath, 'utf-8');
    } catch {
      return '# DPI Guardians Context\n\nNo context loaded yet.\n';
    }
  }

  protected async saveContext(content: string): Promise<void> {
    await fs.mkdir(path.dirname(this.contextPath), { recursive: true });
    await fs.writeFile(this.contextPath, content, 'utf-8');
  }

  protected async callLLM(systemPrompt: string, userMessage: string, model = 'claude-sonnet-4-6'): Promise<string> {
    if (this.config.mockLLM || !this.anthropic) {
      this.log('info', `[MOCK LLM] ${systemPrompt.substring(0, 50)}...`);
      return this.getMockLLMResponse(systemPrompt, userMessage);
    }

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    // Approximate cost: $3 per 1M input tokens, $15 per 1M output tokens for Sonnet
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    this.inferenceCost += (inputTokens * 3 + outputTokens * 15) / 1_000_000;

    const content = response.content[0];
    return content.type === 'text' ? content.text : '';
  }

  private getMockLLMResponse(systemPrompt: string, userMessage: string): string {
    if (systemPrompt.includes('PR') || systemPrompt.includes('review')) {
      return JSON.stringify({
        score: 7,
        aiSlop: false,
        approved: true,
        comment: '**DPI Guardians Review** ✓\n\nThis PR demonstrates solid understanding of the libp2p protocol. Tests are included and the implementation follows existing patterns. Approving with minor suggestions for inline documentation.',
        flags: [],
      });
    }
    if (systemPrompt.includes('treasury') || systemPrompt.includes('financial')) {
      return '## Monthly P&L Summary\n\n**Revenue:** 2.5 ETH\n**Costs:** 0.3 ETH\n**Net:** +2.2 ETH\n**Yield earned:** 0.15 ETH @ 5.2% APY\n\nTreasury health: STRONG. Runway: 8+ months at current burn rate.';
    }
    if (systemPrompt.includes('newsletter') || systemPrompt.includes('community')) {
      return '## libp2p Ecosystem Update — March 2026\n\n**This week in libp2p:**\n- go-libp2p v0.38 released with QUIC improvements\n- 3 new projects integrated libp2p\n- 847 developer questions answered by Support Agent\n\n**Featured project:** EthStorage uses libp2p for P2P data availability\n\n**Contributor spotlight:** @devname merged 3 high-quality PRs this week';
    }
    return `Mock LLM response for: ${userMessage.substring(0, 100)}`;
  }

  protected getInferenceCost(): number {
    return this.inferenceCost;
  }

  abstract run(): Promise<void>;
}
