import { AgentBase, AgentConfig } from '../base/AgentBase';
import { GitHubTool, PR } from '../maintainer/tools/github';
import { ReputationTool, ContributorReputation } from './tools/reputation';
import { ContextTool } from '../maintainer/tools/context';

export interface PRScore {
  prNumber: number;
  repo: string;
  author: string;
  score: number;
  aiSlop: boolean;
  flags: string[];
  reasoning: string;
  approved: boolean;
}

export interface ReviewSummary {
  totalReviewed: number;
  approved: number;
  rejected: number;
  aiSlopFlagged: number;
  highScorers: Array<{ handle: string; score: number; prTitle: string }>;
  newBadgesIssued: number;
  averageScore: number;
}

const GENERIC_TITLE_WORDS = new Set([
  'fix', 'update', 'improve', 'change', 'modify', 'edit', 'refactor',
  'cleanup', 'misc', 'minor', 'various', 'tweak', 'patch',
]);

export class ReviewAgent extends AgentBase {
  private github: GitHubTool;
  private reputation: ReputationTool;
  private context: ContextTool;
  private readonly repos = ['go-libp2p', 'js-libp2p', 'rust-libp2p'];

  constructor(config: AgentConfig) {
    super('review-agent', 'ReviewAgent', config);
    this.github = new GitHubTool(
      process.env.GITHUB_TOKEN ?? 'mock-token',
      'libp2p',
      config.demoMode || config.mockLLM
    );
    this.reputation = new ReputationTool();
    this.context = new ContextTool();
  }

  async run(): Promise<void> {
    this.log('info', 'ReviewAgent starting run cycle');
    const startTime = Date.now();

    const allPRScores: PRScore[] = [];
    let totalBadgesIssued = 0;

    // Step 1: Get PRs from all repos and score them
    for (const repo of this.repos) {
      this.log('info', `Fetching PRs for ${repo}`);
      let prs: PR[] = [];
      try {
        prs = await this.github.getOpenPRs(repo);
      } catch (err) {
        this.log('error', `Failed to fetch PRs for ${repo}`, err);
        continue;
      }

      for (const pr of prs) {
        try {
          const score = await this.scorePR(pr);
          allPRScores.push(score);
          this.log('info', `Scored ${repo}#${pr.number}: ${score.score}/10, aiSlop: ${score.aiSlop}`);

          // Step 2: Issue badges to high scorers
          if (score.score >= 8 && !score.aiSlop) {
            const newBadges = await this.reputation.checkAndAwardBadges(pr.author);
            if (newBadges.length > 0) {
              totalBadgesIssued += newBadges.length;
              this.log('info', `Issued ${newBadges.length} new badge(s) to @${pr.author}: ${newBadges.map(b => b.emoji + b.name).join(', ')}`);
            }
          }

          // Step 3: Update reputation scores
          await this.updateReputationForPR(pr, score);

          // Step 4: Flag AI-slop PRs
          if (score.aiSlop) {
            this.log('warn', `AI slop flagged: ${repo}#${pr.number} by @${pr.author}. Flags: ${score.flags.join(', ')}`);
            const slopComment = this.buildSlopComment(score);
            await this.github.postComment(repo, pr.number, slopComment);
          }
        } catch (err) {
          this.log('error', `Failed to score PR ${repo}#${pr.number}`, err);
        }
      }
    }

    // Step 5: Update context with review summary
    const summary = this.buildSummary(allPRScores, totalBadgesIssued);
    const leaderboard = await this.reputation.getLeaderboard(5);
    const reviewContextSection = this.buildContextSection(summary, leaderboard);
    await this.context.appendSection('Review Agent Summary', reviewContextSection);

    const elapsedMs = Date.now() - startTime;
    this.log('info', 'ReviewAgent run complete', {
      elapsedMs,
      totalReviewed: summary.totalReviewed,
      approved: summary.approved,
      aiSlopFlagged: summary.aiSlopFlagged,
      badgesIssued: totalBadgesIssued,
      inferenceCostUsd: this.getInferenceCost().toFixed(6),
    });
  }

  async scorePR(pr: PR): Promise<PRScore> {
    if (!this.config.mockLLM && this.anthropic) {
      return this.scorePRWithLLM(pr);
    }
    return this.scorePRWithHeuristics(pr);
  }

  private async scorePRWithLLM(pr: PR): Promise<PRScore> {
    const systemPrompt = `You are a code review quality assessor for the libp2p project.
Score the given PR from 0-10 based on code quality, description quality, test coverage, and overall contribution value.
Detect potential AI-generated low-quality contributions.

Respond with JSON only:
{
  "score": <0-10>,
  "aiSlop": <boolean>,
  "flags": ["flag1", "flag2"],
  "reasoning": "<brief explanation>",
  "approved": <boolean>
}`;

    const prSummary = `PR #${pr.number}: ${pr.title}
Author: ${pr.author}
Description: ${pr.body || '(none)'}
Files changed: ${pr.files.map(f => f.filename).join(', ')}
+${pr.additions} -${pr.deletions}`;

    const raw = await this.callLLM(systemPrompt, prSummary);

    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const parsed = JSON.parse(cleaned) as {
        score: number;
        aiSlop: boolean;
        flags: string[];
        reasoning: string;
        approved: boolean;
      };
      return {
        prNumber: pr.number,
        repo: pr.repo,
        author: pr.author,
        score: Math.min(10, Math.max(0, parsed.score)),
        aiSlop: Boolean(parsed.aiSlop),
        flags: Array.isArray(parsed.flags) ? parsed.flags : [],
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
        approved: Boolean(parsed.approved),
      };
    } catch {
      return this.scorePRWithHeuristics(pr);
    }
  }

  private scorePRWithHeuristics(pr: PR): PRScore {
    let score = 5;
    const flags: string[] = [];

    // Title quality checks
    if (pr.title.length < 20) {
      flags.push('short-title');
      score -= 1;
    }

    // Detect generic title words with no specifics
    const titleWords = pr.title.toLowerCase().split(/\s+/);
    const hasOnlyGenericWords = titleWords.every(w => GENERIC_TITLE_WORDS.has(w) || w.length <= 2);
    const firstMeaningfulWord = titleWords.find(w => w.length > 2);
    const isGenericTitle = firstMeaningfulWord !== undefined &&
      GENERIC_TITLE_WORDS.has(firstMeaningfulWord) &&
      pr.title.length < 40;

    if (isGenericTitle || hasOnlyGenericWords) {
      flags.push('generic-title');
      score -= 1;
    }

    // Body quality checks
    const bodyLength = (pr.body ?? '').length;
    if (bodyLength < 50) {
      flags.push('missing-description');
      score -= 2;
    } else if (bodyLength > 300) {
      score += 1; // Reward detailed descriptions
    }

    // Size checks
    if (pr.additions < 5 && pr.deletions < 5) {
      flags.push('trivial-change');
      score -= 2;
    } else if (pr.additions > 50) {
      score += 1; // Reward substantial contributions
    }

    // Test file detection
    const hasTests = pr.files.some(f =>
      f.filename.includes('_test.') ||
      f.filename.includes('.test.') ||
      f.filename.includes('/test/') ||
      f.filename.includes('spec.') ||
      f.filename.includes('__tests__') ||
      f.filename.endsWith('_spec.rs') ||
      f.filename.endsWith('_spec.go')
    );
    if (!hasTests && pr.additions > 20) {
      flags.push('no-tests');
      score -= 1;
    }

    // Protocol/library file checks
    const hasProtocolChanges = pr.files.some(f =>
      f.filename.includes('transport') ||
      f.filename.includes('protocol') ||
      f.filename.includes('mux') ||
      f.filename.includes('discovery')
    );
    if (hasProtocolChanges && !hasTests) {
      flags.push('protocol-change-no-tests');
      score -= 1;
    }

    // Good signal: has labels, has review comments (engagement)
    if (pr.labels.length > 0) score += 1;
    if (pr.reviewComments > 0) score += 1;

    // Check for body keywords that indicate thoughtful contribution
    const body = (pr.body ?? '').toLowerCase();
    const hasContext = body.includes('why') || body.includes('because') ||
      body.includes('fixes') || body.includes('closes') ||
      body.includes('resolves') || body.includes('rfc') ||
      body.includes('spec') || body.includes('benchmark');
    if (hasContext) score += 1;

    score = Math.min(10, Math.max(0, score));

    // AI slop determination: multiple quality flags present
    const qualityFlagCount = flags.filter(f =>
      ['missing-description', 'trivial-change', 'generic-title', 'short-title', 'no-tests'].includes(f)
    ).length;
    const aiSlop = qualityFlagCount >= 3 || (qualityFlagCount >= 2 && score <= 3);

    const approved = score >= 7 && !aiSlop;

    const reasoningParts: string[] = [];
    if (flags.length > 0) reasoningParts.push(`Issues: ${flags.join(', ')}`);
    if (hasTests) reasoningParts.push('includes tests');
    if (hasContext) reasoningParts.push('well-described motivation');
    if (pr.labels.length > 0) reasoningParts.push(`labeled: ${pr.labels.join(', ')}`);

    return {
      prNumber: pr.number,
      repo: pr.repo,
      author: pr.author,
      score,
      aiSlop,
      flags,
      reasoning: reasoningParts.join('; ') || 'Standard heuristic evaluation',
      approved,
    };
  }

  private async updateReputationForPR(pr: PR, score: PRScore): Promise<void> {
    const handle = pr.author;

    // Ensure contributor exists
    let contributor: ContributorReputation | null = await this.reputation.getReputation(handle);
    if (!contributor) {
      contributor = await this.reputation.createOrUpdateContributor(handle, '0x0000000000000000000000000000000000000000');
    }

    if (score.aiSlop) {
      // Penalize for submitting AI slop
      await this.reputation.updateScore(handle, -20, 'AI slop PR submission penalty');
      await this.reputation.createOrUpdateContributor(handle, contributor.address, {
        prsRejected: contributor.prsRejected + 1,
        prsReviewed: contributor.prsReviewed + 1,
      });
    } else if (score.approved) {
      // Reward for approved PR
      const pointsForScore = Math.floor((score.score - 6) * 30); // 30 pts per point above 6
      await this.reputation.updateScore(handle, Math.max(10, pointsForScore), `PR #${pr.number} approved (score: ${score.score})`);
      await this.reputation.createOrUpdateContributor(handle, contributor.address, {
        prsApproved: contributor.prsApproved + 1,
        prsReviewed: contributor.prsReviewed + 1,
      });
    } else {
      // Neutral: reviewed but not approved
      await this.reputation.updateScore(handle, 5, `PR #${pr.number} reviewed (score: ${score.score})`);
      await this.reputation.createOrUpdateContributor(handle, contributor.address, {
        prsRejected: contributor.prsRejected + 1,
        prsReviewed: contributor.prsReviewed + 1,
      });
    }
  }

  private buildSlopComment(score: PRScore): string {
    return [
      `🚩 **DPI Guardians Automated Quality Check — Action Required**`,
      ``,
      `This PR has been flagged by our automated review system for the following quality concerns:`,
      ``,
      ...score.flags.map(f => `- \`${f}\``),
      ``,
      `**Score:** ${score.score}/10`,
      ``,
      `To improve this PR:`,
      `- Add a detailed description explaining **what** you changed and **why**`,
      `- Include tests for any new logic`,
      `- Use a descriptive commit message (e.g. "feat: add QUIC v2 connection migration support" not "fix: update code")`,
      `- Reference any related issues with "Fixes #NNN"`,
      ``,
      `If this looks like an error, please reply with more context about your change. We are happy to help!`,
      ``,
      `_DPI Guardians ReviewAgent — ${new Date().toISOString()}_`,
    ].join('\n');
  }

  private buildSummary(scores: PRScore[], badgesIssued: number): ReviewSummary {
    const approved = scores.filter(s => s.approved).length;
    const aiSlopFlagged = scores.filter(s => s.aiSlop).length;
    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);

    const highScorers = scores
      .filter(s => s.score >= 8 && !s.aiSlop)
      .map(s => ({ handle: s.author, score: s.score, prTitle: `PR #${s.prNumber}` }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      totalReviewed: scores.length,
      approved,
      rejected: scores.length - approved,
      aiSlopFlagged,
      highScorers,
      newBadgesIssued: badgesIssued,
      averageScore: scores.length > 0 ? parseFloat((totalScore / scores.length).toFixed(1)) : 0,
    };
  }

  private buildContextSection(
    summary: ReviewSummary,
    leaderboard: Array<ContributorReputation & { rank: number }>
  ): string {
    return [
      `**Updated:** ${new Date().toISOString()}`,
      ``,
      `### Review Summary`,
      `- Total reviewed: ${summary.totalReviewed}`,
      `- Approved: ${summary.approved}`,
      `- AI slop flagged: ${summary.aiSlopFlagged}`,
      `- Average score: ${summary.averageScore}/10`,
      `- Badges issued: ${summary.newBadgesIssued}`,
      ``,
      summary.highScorers.length > 0 ? [
        `### High-Quality PRs This Run`,
        ...summary.highScorers.map(h => `- @${h.handle} — ${h.prTitle} (${h.score}/10)`),
      ].join('\n') : '',
      ``,
      `### Current Leaderboard`,
      `| Rank | Handle | Score | Badges |`,
      `|---|---|---|---|`,
      ...leaderboard.map(c => `| ${c.rank} | @${c.handle} | ${c.score} | ${c.badges.join('')} |`),
    ].filter(Boolean).join('\n');
  }
}
