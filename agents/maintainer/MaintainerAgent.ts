import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentBase, AgentConfig } from '../base/AgentBase';
import { GitHubTool, PR } from './tools/github';
import { TestingTool, InteropTestSuite, DependencyReport } from './tools/testing';
import { ContextTool } from './tools/context';

export interface PRReview {
  prNumber: number;
  repo: string;
  score: number;
  aiSlop: boolean;
  approved: boolean;
  comment: string;
  flags: string[];
}

export interface CuratedTask {
  id: string;
  title: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  area: string;
  description: string;
  estimatedHours: number;
  labels: string[];
  goodFirstIssue: boolean;
}

export class MaintainerAgent extends AgentBase {
  private github: GitHubTool;
  private testing: TestingTool;
  private context: ContextTool;
  private prReviewPrompt: string = '';
  private readonly repos = ['go-libp2p', 'js-libp2p', 'rust-libp2p'];

  constructor(config: AgentConfig) {
    super('maintainer-agent', 'MaintainerAgent', config);
    this.github = new GitHubTool(
      process.env.GITHUB_TOKEN ?? 'mock-token',
      'libp2p',
      config.demoMode || config.mockLLM
    );
    this.testing = new TestingTool(config.demoMode || config.mockLLM);
    this.context = new ContextTool();
  }

  private async loadPrompt(filename: string): Promise<string> {
    try {
      const promptPath = path.join(__dirname, 'prompts', filename);
      return await fs.readFile(promptPath, 'utf-8');
    } catch {
      return `You are an expert libp2p maintainer. Respond with valid JSON when reviewing PRs.`;
    }
  }

  async run(): Promise<void> {
    this.log('info', 'MaintainerAgent starting run cycle');
    const startTime = Date.now();

    this.prReviewPrompt = await this.loadPrompt('pr-review.md');
    let context = await this.loadContext();

    const allReviews: PRReview[] = [];
    const allDependencyReports: DependencyReport[] = [];
    let totalPRsProcessed = 0;
    let totalAiSlopFlagged = 0;

    // Step 1: Review open PRs across all repos
    for (const repo of this.repos) {
      this.log('info', `Fetching open PRs for ${repo}`);
      let prs: PR[] = [];
      try {
        prs = await this.github.getOpenPRs(repo);
        this.log('info', `Found ${prs.length} open PRs in ${repo}`);
      } catch (err) {
        this.log('error', `Failed to fetch PRs for ${repo}`, err);
        continue;
      }

      for (const pr of prs) {
        try {
          const review = await this.reviewPR(pr);
          allReviews.push(review);
          totalPRsProcessed++;

          if (review.aiSlop) {
            totalAiSlopFlagged++;
            this.log('warn', `AI slop detected in ${repo}#${pr.number}: ${pr.title}`);
          }

          const commentBody = this.formatReviewComment(review);
          await this.github.postComment(repo, pr.number, commentBody);
          this.log('info', `Reviewed ${repo}#${pr.number} — score: ${review.score}, approved: ${review.approved}`);
        } catch (err) {
          this.log('error', `Failed to review PR ${repo}#${pr.number}`, err);
        }
      }
    }

    // Step 2: Dependency checks for all implementations
    for (const impl of this.repos as Array<'go-libp2p' | 'js-libp2p' | 'rust-libp2p'>) {
      try {
        this.log('info', `Checking dependencies for ${impl}`);
        const report = await this.testing.checkDependencies(impl);
        allDependencyReports.push(report);
        this.log('info', `${impl}: ${report.outdatedCount} outdated deps, ${report.securityIssues} security issues`);

        // Create GitHub issues for critical security issues
        const criticalDeps = report.dependencies.filter(d => d.severity === 'critical');
        for (const dep of criticalDeps) {
          const issueTitle = `security: critical vulnerability in ${dep.name} — update to ${dep.latestVersion}`;
          const issueBody = [
            `## Critical Dependency Vulnerability`,
            ``,
            `**Dependency:** ${dep.name}`,
            `**Current version:** ${dep.currentVersion}`,
            `**Latest version:** ${dep.latestVersion}`,
            `**Advisory:** ${dep.securityAdvisory ?? 'See dependency notes'}`,
            ``,
            `### Notes`,
            dep.notes,
            ``,
            `_Auto-detected by MaintainerAgent on ${new Date().toISOString()}_`,
          ].join('\n');
          await this.github.createIssue(impl, issueTitle, issueBody, ['security', 'critical', 'dependencies']);
        }
      } catch (err) {
        this.log('error', `Dependency check failed for ${impl}`, err);
      }
    }

    // Step 3: Interop tests for implementation pairs
    const interopPairs: Array<'go-js' | 'go-rust'> = ['go-js', 'go-rust'];
    const interopResults: InteropTestSuite[] = [];

    for (const pair of interopPairs) {
      try {
        this.log('info', `Running interop tests for ${pair}`);
        const suite = await this.testing.runInteropTests(pair);
        interopResults.push(suite);
        this.log('info', `${pair} interop: ${suite.passed}/${suite.totalTests} passed`);

        if (suite.failed > 0) {
          const failedTests = suite.results.filter(r => !r.passed);
          const issueTitle = `interop: ${suite.failed} interop test failure(s) in ${pair} pair`;
          const issueBody = [
            `## Interop Test Failures — ${pair}`,
            ``,
            `**Failed:** ${suite.failed}/${suite.totalTests}`,
            `**Run date:** ${new Date().toISOString()}`,
            ``,
            `### Failing Tests`,
            ...failedTests.map(t => `- **${t.name}** (${t.protocol})\n  Error: ${t.error}`),
            ``,
            `_Auto-detected by MaintainerAgent_`,
          ].join('\n');
          const repoForIssue = pair === 'go-js' ? 'go-libp2p' : 'go-libp2p';
          await this.github.createIssue(repoForIssue, issueTitle, issueBody, ['interop', 'bug', 'needs-investigation']);
        }
      } catch (err) {
        this.log('error', `Interop tests failed for pair ${pair}`, err);
      }
    }

    // Step 4: Curate tasks and add to context
    const tasks = await this.curateTasks(context, allReviews);
    this.log('info', `Curated ${tasks.length} tasks for contributors`);

    // Step 5: Build updated context
    const reviewSummary = this.buildReviewSummary(allReviews, allDependencyReports, interopResults);
    const taskSection = this.buildTaskSection(tasks);

    await this.context.appendSection('Last Maintainer Run', [
      `- Date: ${new Date().toISOString()}`,
      `- PRs reviewed: ${totalPRsProcessed}`,
      `- AI slop flagged: ${totalAiSlopFlagged}`,
      `- Approved: ${allReviews.filter(r => r.approved).length}`,
      `- Inference cost: $${this.getInferenceCost().toFixed(6)}`,
    ].join('\n'));

    await this.context.appendSection('PR Review Summary', reviewSummary);
    await this.context.appendSection('Curated Tasks', taskSection);

    const elapsedMs = Date.now() - startTime;
    this.log('info', `MaintainerAgent run complete`, {
      elapsedMs,
      prsReviewed: totalPRsProcessed,
      aiSlopFlagged: totalAiSlopFlagged,
      approved: allReviews.filter(r => r.approved).length,
      inferenceCostUsd: this.getInferenceCost().toFixed(6),
    });
  }

  async reviewPR(pr: PR): Promise<PRReview> {
    const prSummary = [
      `Repository: ${pr.repo}`,
      `PR #${pr.number}: ${pr.title}`,
      `Author: ${pr.author}`,
      `Labels: ${pr.labels.join(', ') || 'none'}`,
      `Created: ${pr.createdAt}`,
      `Stats: +${pr.additions} -${pr.deletions} lines, ${pr.reviewComments} existing review comments`,
      ``,
      `Description:`,
      pr.body || '(no description provided)',
      ``,
      `Changed files:`,
      ...pr.files.map(f => `- ${f.filename} (+${f.additions}/-${f.deletions}) [${f.status}]`),
      ``,
      `Patches:`,
      ...pr.files.map(f => `### ${f.filename}\n\`\`\`diff\n${f.patch}\n\`\`\``),
    ].join('\n');

    const rawResponse = await this.callLLM(this.prReviewPrompt, prSummary);

    try {
      // Strip markdown code fences if present
      const cleaned = rawResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const parsed = JSON.parse(cleaned) as {
        score: number;
        aiSlop: boolean;
        approved: boolean;
        comment: string;
        flags: string[];
      };

      return {
        prNumber: pr.number,
        repo: pr.repo,
        score: typeof parsed.score === 'number' ? Math.min(10, Math.max(0, parsed.score)) : 5,
        aiSlop: Boolean(parsed.aiSlop),
        approved: Boolean(parsed.approved),
        comment: typeof parsed.comment === 'string' ? parsed.comment : rawResponse,
        flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      };
    } catch {
      // If JSON parsing fails, apply heuristic scoring
      this.log('warn', `Failed to parse LLM response as JSON for PR #${pr.number}, using heuristics`);
      return this.heuristicReview(pr);
    }
  }

  private heuristicReview(pr: PR): PRReview {
    let score = 5;
    const flags: string[] = [];

    if (pr.title.length < 20) flags.push('short-title');
    if ((pr.body ?? '').length < 50) { score -= 1; flags.push('missing-description'); }
    if (pr.additions < 5 && pr.deletions < 5) { score -= 2; flags.push('trivial-change'); }

    const hasTests = pr.files.some(f =>
      f.filename.includes('_test.') || f.filename.includes('.test.') ||
      f.filename.includes('/test/') || f.filename.includes('spec.')
    );
    if (!hasTests && pr.additions > 20) { score -= 1; flags.push('no-tests'); }

    const hasGoodDescription = pr.body && (
      pr.body.includes('Why') || pr.body.includes('Fixes') ||
      pr.body.includes('Closes') || pr.body.includes('RFC') ||
      pr.body.length > 200
    );
    if (hasGoodDescription) score += 1;

    if (pr.labels.includes('enhancement') || pr.labels.includes('performance')) score += 1;
    if (pr.reviewComments > 0) score += 1; // engagement suggests real developer

    score = Math.min(10, Math.max(0, score));
    const aiSlop = flags.includes('trivial-change') && flags.includes('missing-description');
    const approved = score >= 7 && !aiSlop;

    return {
      prNumber: pr.number,
      repo: pr.repo,
      score,
      aiSlop,
      approved,
      comment: `**DPI Guardians Automated Review** (heuristic mode)\n\nScore: ${score}/10\n\n${
        flags.length > 0 ? `**Flags:** ${flags.join(', ')}\n\n` : ''
      }${approved ? 'This PR meets minimum quality standards.' : 'This PR requires improvements before merging.'}`,
      flags,
    };
  }

  private formatReviewComment(review: PRReview): string {
    const statusEmoji = review.approved ? '✅' : review.aiSlop ? '🚩' : '🔄';
    return [
      `${statusEmoji} **DPI Guardians Automated Review** — Score: ${review.score}/10`,
      ``,
      review.comment,
      ``,
      review.flags.length > 0 ? `**Flags:** \`${review.flags.join('` `')}\`` : '',
      ``,
      `_Reviewed by MaintainerAgent at ${new Date().toISOString()}_`,
    ].filter(Boolean).join('\n');
  }

  async curateTasks(_context: string, reviews: PRReview[]): Promise<CuratedTask[]> {
    const approvedAreas = reviews
      .filter(r => r.approved)
      .flatMap(r => r.flags.length === 0 ? ['protocol-stability'] : r.flags);

    const tasks: CuratedTask[] = [
      {
        id: 'task-001',
        title: 'Add missing godoc comments to go-libp2p transport package',
        difficulty: 'beginner',
        area: 'documentation',
        description: 'The transport package (p2p/transport/) is missing godoc comments on exported types and functions. Add documentation following the patterns in p2p/host/basic/basic_host.go. No code changes required.',
        estimatedHours: 2,
        labels: ['documentation', 'good-first-issue'],
        goodFirstIssue: true,
      },
      {
        id: 'task-002',
        title: 'Fix mDNS peer discovery flakiness in CI on darwin',
        difficulty: 'intermediate',
        area: 'discovery',
        description: 'The mDNS integration tests occasionally fail on macOS CI runners due to timing issues in the multicast announcement interval. Investigate and add a configurable jitter or retry mechanism. See test/mdns_test.go.',
        estimatedHours: 8,
        labels: ['bug', 'discovery', 'testing'],
        goodFirstIssue: false,
      },
      {
        id: 'task-003',
        title: 'Implement QUIC connection migration support in go-libp2p',
        difficulty: 'advanced',
        area: 'transport',
        description: 'QUIC RFC 9000 specifies connection migration for NAT rebinding scenarios. The current go-libp2p QUIC transport does not implement migration. This requires changes to the quic-go integration and updating the multiaddr handling for migrated connections.',
        estimatedHours: 40,
        labels: ['enhancement', 'transport', 'quic'],
        goodFirstIssue: false,
      },
      {
        id: 'task-004',
        title: 'Add WebTransport browser-to-server interop tests',
        difficulty: 'advanced',
        area: 'testing',
        description: 'The WebTransport implementation lacks browser-side interop tests. Create a Playwright-based test harness that connects a browser WebTransport client to a go-libp2p server and validates the full handshake including certificate hash pinning.',
        estimatedHours: 24,
        labels: ['testing', 'webtransport', 'interop'],
        goodFirstIssue: false,
      },
      {
        id: 'task-005',
        title: 'Research and propose libp2p protocol versioning strategy',
        difficulty: 'expert',
        area: 'protocol',
        description: 'The current protocol ID scheme (/libp2p/1.0.0) lacks a formal versioning strategy for backward compatibility. Research semver approaches used in similar projects (IPFS, Matrix), draft a spec proposal, and prototype the negotiation logic in go-libp2p.',
        estimatedHours: 80,
        labels: ['spec', 'protocol', 'rfc', 'needs-discussion'],
        goodFirstIssue: false,
      },
    ];

    // If we have recent AI slop flags, add a task about improving contribution guidelines
    const hasSlopIssues = reviews.some(r => r.aiSlop);
    if (hasSlopIssues) {
      tasks.push({
        id: 'task-006',
        title: 'Improve CONTRIBUTING.md with clear PR quality expectations',
        difficulty: 'beginner',
        area: 'community',
        description: 'Recent PRs have been flagged for missing tests and descriptions. Update CONTRIBUTING.md to explicitly state requirements: minimum description length, test requirements, and commit message conventions.',
        estimatedHours: 3,
        labels: ['documentation', 'community', 'good-first-issue'],
        goodFirstIssue: true,
      });
    }

    return tasks;
  }

  private buildReviewSummary(
    reviews: PRReview[],
    depReports: DependencyReport[],
    interopSuites: InteropTestSuite[]
  ): string {
    const lines: string[] = [
      `### PR Reviews`,
      `- Total reviewed: ${reviews.length}`,
      `- Approved: ${reviews.filter(r => r.approved).length}`,
      `- Changes requested: ${reviews.filter(r => !r.approved && !r.aiSlop).length}`,
      `- AI slop flagged: ${reviews.filter(r => r.aiSlop).length}`,
      `- Average score: ${reviews.length > 0 ? (reviews.reduce((s, r) => s + r.score, 0) / reviews.length).toFixed(1) : 'N/A'}`,
      ``,
      `### Dependency Health`,
    ];

    for (const report of depReports) {
      lines.push(`**${report.implementation}:** ${report.outdatedCount} outdated, ${report.securityIssues} security issues`);
    }

    lines.push('', '### Interop Test Results');
    for (const suite of interopSuites) {
      const status = suite.failed === 0 ? '✅' : '❌';
      lines.push(`${status} **${suite.pair}:** ${suite.passed}/${suite.totalTests} passed`);
    }

    return lines.join('\n');
  }

  private buildTaskSection(tasks: CuratedTask[]): string {
    return tasks.map(t => [
      `### [${t.difficulty.toUpperCase()}] ${t.title}`,
      `**Area:** ${t.area} | **Estimated:** ${t.estimatedHours}h${t.goodFirstIssue ? ' | 🌱 Good First Issue' : ''}`,
      `**Labels:** ${t.labels.join(', ')}`,
      ``,
      t.description,
    ].join('\n')).join('\n\n');
  }
}
