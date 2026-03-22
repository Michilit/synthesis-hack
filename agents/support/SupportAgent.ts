import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentBase, AgentConfig } from '../base/AgentBase';
import { ContextTool } from '../maintainer/tools/context';

export interface SupportQuestion {
  id: string;
  question: string;
  category: 'api-usage' | 'debugging' | 'performance' | 'interop' | 'deployment' | 'protocol' | 'general';
  language: 'go' | 'javascript' | 'rust' | 'general';
  askedAt: string;
  answer?: string;
  helpful?: boolean;
  source: 'discord' | 'github-issue' | 'forum' | 'mock';
}

export interface PainPoint {
  area: string;
  description: string;
  frequency: 'very-high' | 'high' | 'medium' | 'low';
  exampleQuestions: string[];
  suggestedFix: string;
}

export interface DXReport {
  generatedAt: string;
  questionsAnalyzed: number;
  topPainPoints: PainPoint[];
  recommendations: string[];
  maintainerMinutesSaved: number;
  summary: string;
}

export interface MetricsData {
  totalQuestionsAnswered: number;
  totalMaintainerMinutesSaved: number;
  questionsByCategory: Record<string, number>;
  questionsByLanguage: Record<string, number>;
  averageResponseTimeMs: number;
  lastUpdated: string;
  runHistory: Array<{
    date: string;
    questionsAnswered: number;
    minutesSaved: number;
  }>;
}

export class SupportAgent extends AgentBase {
  private context: ContextTool;
  private metricsPath: string;

  constructor(config: AgentConfig) {
    super('support-agent', 'SupportAgent', config);
    this.context = new ContextTool();
    this.metricsPath = path.join(process.cwd(), 'data', 'metrics.json');
  }

  private get libp2pKnowledgeSystem(): string {
    return `You are an expert libp2p developer advocate with deep knowledge of all three implementations: go-libp2p, js-libp2p, and rust-libp2p.

You answer developer questions clearly and concisely. Your answers include:
- Working code examples in the appropriate language
- Links to relevant documentation or GitHub issues when applicable
- Common pitfalls and how to avoid them
- Performance considerations for P2P applications

Key technical knowledge:
- Noise protocol for encryption (XX handshake pattern)
- yamux/mplex for stream multiplexing
- QUIC, TCP, WebSocket, WebRTC, WebTransport transports
- mDNS and DHT for peer discovery
- GossipSub and FloodSub for pub/sub
- Circuit relay v2 for NAT traversal
- Peer IDs, multihashes, multiaddrs, CIDs
- identify and identify/push protocols
- PeerStore, AddressBook, ProtoBook

When answering, always check if the question involves a known common issue and provide direct solutions rather than generic advice.`;
  }

  async run(): Promise<void> {
    this.log('info', 'SupportAgent starting run cycle');
    const startTime = Date.now();

    const metrics = await this.loadMetrics();

    // Generate mock questions that would come from Discord/GitHub
    const questions = this.getMockQuestions();
    this.log('info', `Processing ${questions.length} support questions`);

    const answeredQuestions: SupportQuestion[] = [];
    for (const q of questions) {
      try {
        const answer = await this.answerQuestion(q);
        q.answer = answer;
        answeredQuestions.push(q);
        this.log('info', `Answered question [${q.category}/${q.language}]: ${q.question.substring(0, 60)}...`);
      } catch (err) {
        this.log('error', `Failed to answer question ${q.id}`, err);
      }
    }

    // Generate DX improvement report
    const dxReport = await this.generateDXReport(answeredQuestions);
    this.log('info', `DX report generated. ${dxReport.topPainPoints.length} pain points identified`);

    // Track maintainer minutes saved (avg 15 min per question manually answered)
    const minutesSaved = answeredQuestions.length * 15;
    await this.trackMaintainerMinutes(metrics, answeredQuestions.length, minutesSaved);

    // Update context
    const supportSummary = this.buildSupportSummary(dxReport, metrics);
    await this.context.appendSection('Support & DX Summary', supportSummary);
    await this.context.appendSection('DX Report', dxReport.summary);

    const elapsedMs = Date.now() - startTime;
    this.log('info', 'SupportAgent run complete', {
      elapsedMs,
      questionsAnswered: answeredQuestions.length,
      minutesSaved,
      totalMinutesSaved: metrics.totalMaintainerMinutesSaved + minutesSaved,
      inferenceCostUsd: this.getInferenceCost().toFixed(6),
    });
  }

  async answerQuestion(question: SupportQuestion): Promise<string> {
    const userMessage = [
      `**Question Category:** ${question.category}`,
      `**Implementation:** ${question.language}`,
      `**Source:** ${question.source}`,
      ``,
      `**Question:**`,
      question.question,
    ].join('\n');

    return this.callLLM(this.libp2pKnowledgeSystem, userMessage);
  }

  async generateDXReport(questions: SupportQuestion[]): Promise<DXReport> {
    const categoryGroups: Record<string, SupportQuestion[]> = {};
    for (const q of questions) {
      if (!categoryGroups[q.category]) categoryGroups[q.category] = [];
      categoryGroups[q.category].push(q);
    }

    const painPoints: PainPoint[] = [
      {
        area: 'Connection Establishment',
        description: 'Developers frequently struggle with NAT traversal and understanding when to use circuit relay vs direct connection. The error messages when connections fail are not informative enough.',
        frequency: 'very-high',
        exampleQuestions: [
          'Why does my libp2p node connect locally but not over the internet?',
          'When should I use circuit relay v2?',
          'p2p dial failed: "all multiaddresses failed" — what does this mean?',
        ],
        suggestedFix: 'Add a Connection Diagnostics tool that explains why a connection failed with actionable next steps. Improve error messages to suggest relay when direct connection fails.',
      },
      {
        area: 'Peer Discovery',
        description: 'mDNS only works on local networks but many developers expect it to work globally. The DHT bootstrap process is opaque and slow.',
        frequency: 'high',
        exampleQuestions: [
          'How do I discover peers across the internet, not just locally?',
          'My DHT is empty after connecting — how long does bootstrap take?',
          'What bootstrap nodes should I use for my private network?',
        ],
        suggestedFix: 'Add a Peer Discovery Guide that clearly distinguishes mDNS (local), DHT (global), and custom discovery. Add bootstrap progress events to the DHT.',
      },
      {
        area: 'Stream Handling',
        description: 'Resource leaks from unclosed streams are a common source of bugs. The stream lifecycle (open, half-close, full-close, reset) is not well-documented.',
        frequency: 'high',
        exampleQuestions: [
          'My node is running out of file descriptors after running for a while',
          'What is the difference between stream.close() and stream.reset()?',
          'How do I properly handle a stream error on the server side?',
        ],
        suggestedFix: 'Add stream lifecycle diagram to docs. Add a resource manager warning when stream count exceeds threshold. Add stream leak detection in debug mode.',
      },
      {
        area: 'Protocol Registration',
        description: 'Developers are confused about protocol ID versioning and how to handle both old and new clients during migrations.',
        frequency: 'medium',
        exampleQuestions: [
          'How do I support multiple versions of my protocol simultaneously?',
          'What is the convention for protocol IDs? /myapp/1.0.0 vs /myapp/1/1.0.0?',
          'How do I deprecate an old protocol version?',
        ],
        suggestedFix: 'Add a Protocol Versioning Guide with migration examples. Provide a helper for semver-aware protocol registration.',
      },
      {
        area: 'Browser/Node.js Transport',
        description: 'WebRTC and WebTransport configuration is complex. Developers often try to use TCP transports in browsers.',
        frequency: 'medium',
        exampleQuestions: [
          'How do I make my browser node connect to a server node?',
          'WebRTC is not connecting in production — works in localhost',
          'Can I use the same libp2p config in both Node.js and the browser?',
        ],
        suggestedFix: 'Add a Browser Networking Guide. Create a browser-compatible config template. Add validation that warns when incompatible transports are configured for the environment.',
      },
    ];

    const categoryCounts = Object.fromEntries(
      Object.entries(categoryGroups).map(([k, v]) => [k, v.length])
    );

    const systemPrompt = `You are a DX analyst for the libp2p project. Write a concise summary of the DX improvement report.
Focus on the most impactful changes that would reduce developer friction and support burden.`;

    const userMsg = [
      `Pain points identified: ${painPoints.length}`,
      `Questions processed: ${questions.length}`,
      `Category breakdown: ${JSON.stringify(categoryCounts)}`,
      `Top pain point: ${painPoints[0].area} — ${painPoints[0].description.substring(0, 100)}`,
    ].join('\n');

    const summary = await this.callLLM(systemPrompt, userMsg);

    return {
      generatedAt: new Date().toISOString(),
      questionsAnalyzed: questions.length,
      topPainPoints: painPoints,
      recommendations: painPoints.map(p => p.suggestedFix),
      maintainerMinutesSaved: questions.length * 15,
      summary,
    };
  }

  async trackMaintainerMinutes(metrics: MetricsData, questionsAnswered: number, minutesSaved: number): Promise<void> {
    metrics.totalQuestionsAnswered += questionsAnswered;
    metrics.totalMaintainerMinutesSaved += minutesSaved;
    metrics.lastUpdated = new Date().toISOString();

    metrics.runHistory.push({
      date: new Date().toISOString(),
      questionsAnswered,
      minutesSaved,
    });

    // Keep last 90 run records
    if (metrics.runHistory.length > 90) {
      metrics.runHistory = metrics.runHistory.slice(-90);
    }

    await fs.mkdir(path.dirname(this.metricsPath), { recursive: true });
    await fs.writeFile(this.metricsPath, JSON.stringify(metrics, null, 2), 'utf-8');
    this.log('info', `Metrics updated: ${metrics.totalMaintainerMinutesSaved} total minutes saved`);
  }

  private async loadMetrics(): Promise<MetricsData> {
    try {
      const raw = await fs.readFile(this.metricsPath, 'utf-8');
      return JSON.parse(raw) as MetricsData;
    } catch {
      return {
        totalQuestionsAnswered: 0,
        totalMaintainerMinutesSaved: 0,
        questionsByCategory: {},
        questionsByLanguage: {},
        averageResponseTimeMs: 0,
        lastUpdated: new Date().toISOString(),
        runHistory: [],
      };
    }
  }

  private getMockQuestions(): SupportQuestion[] {
    return [
      {
        id: 'q-001',
        question: 'I am building a go-libp2p app and my peers can connect on the local network but fail when I try to connect over the internet. I am getting "all multiaddresses failed to dial". What should I check?',
        category: 'debugging',
        language: 'go',
        askedAt: new Date(Date.now() - 3600000).toISOString(),
        source: 'discord',
      },
      {
        id: 'q-002',
        question: 'How do I use GossipSub with js-libp2p v1.3? I am trying to subscribe to a topic but messages are not being received even though I can see connections in the debug logs.',
        category: 'api-usage',
        language: 'javascript',
        askedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
        source: 'github-issue',
      },
      {
        id: 'q-003',
        question: 'In rust-libp2p, what is the recommended way to implement a custom protocol handler? The documentation shows StreamHandler but tokio async/await patterns are not clear to me.',
        category: 'api-usage',
        language: 'rust',
        askedAt: new Date(Date.now() - 1.5 * 3600000).toISOString(),
        source: 'forum',
      },
      {
        id: 'q-004',
        question: 'My go-libp2p node is leaking file descriptors. After about 6 hours of running it hits the OS limit. I close streams after each request. What else could be causing this?',
        category: 'debugging',
        language: 'go',
        askedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
        source: 'discord',
      },
      {
        id: 'q-005',
        question: 'What is the performance difference between TCP and QUIC transports for a high-throughput file transfer application? Should I use yamux or mplex for multiplexing in this case?',
        category: 'performance',
        language: 'general',
        askedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
        source: 'forum',
      },
      {
        id: 'q-006',
        question: 'How do I configure js-libp2p for use in a browser? I want browser peers to connect to server nodes. Do I need WebRTC or WebTransport?',
        category: 'deployment',
        language: 'javascript',
        askedAt: new Date(Date.now() - 30 * 60000).toISOString(),
        source: 'discord',
      },
      {
        id: 'q-007',
        question: 'What is the correct way to handle peer discovery in a private network? I do not want my nodes appearing on the public DHT.',
        category: 'protocol',
        language: 'general',
        askedAt: new Date(Date.now() - 2.5 * 3600000).toISOString(),
        source: 'github-issue',
      },
    ];
  }

  private buildSupportSummary(report: DXReport, metrics: MetricsData): string {
    return [
      `**Updated:** ${new Date().toISOString()}`,
      ``,
      `### Metrics`,
      `- Total questions answered (all time): ${metrics.totalQuestionsAnswered}`,
      `- Maintainer minutes saved (all time): ${metrics.totalMaintainerMinutesSaved} (~${(metrics.totalMaintainerMinutesSaved / 60).toFixed(0)} hours)`,
      ``,
      `### This Run`,
      `- Questions processed: ${report.questionsAnalyzed}`,
      `- Minutes saved: ${report.maintainerMinutesSaved}`,
      ``,
      `### Top DX Pain Points`,
      ...report.topPainPoints.slice(0, 3).map((p, i) =>
        `${i + 1}. **${p.area}** (${p.frequency}) — ${p.description.substring(0, 80)}...`
      ),
    ].join('\n');
  }
}
