import * as fs from 'fs/promises';
import * as path from 'path';

export interface PRFile {
  filename: string;
  patch: string;
  additions: number;
  deletions: number;
  status: string;
}

export interface PR {
  id: number;
  number: number;
  title: string;
  author: string;
  body: string;
  files: PRFile[];
  additions: number;
  deletions: number;
  reviewComments: number;
  state: string;
  createdAt: string;
  labels: string[];
  repo: string;
}

export class GitHubTool {
  private token: string;
  private org: string;
  private mockMode: boolean;

  constructor(token: string, org: string, mockMode = true) {
    this.token = token;
    this.org = org;
    this.mockMode = mockMode;
  }

  async getOpenPRs(repo: string): Promise<PR[]> {
    if (this.mockMode) {
      return this.getMockPRs(repo);
    }
    const response = await fetch(`https://api.github.com/repos/${this.org}/${repo}/pulls?state=open`, {
      headers: { Authorization: `token ${this.token}`, Accept: 'application/vnd.github.v3+json' },
    });
    return response.json();
  }

  private async getMockPRs(repo: string): Promise<PR[]> {
    try {
      const data = await fs.readFile(path.join(process.cwd(), 'data', 'mock-prs.json'), 'utf-8');
      const allPRs: PR[] = JSON.parse(data);
      return allPRs.filter(pr => pr.repo === repo);
    } catch {
      return this.getHardcodedMockPRs(repo);
    }
  }

  private getHardcodedMockPRs(repo: string): PR[] {
    return [
      {
        id: 1001, number: 847, title: 'feat: add QUIC v2 support with connection multiplexing',
        author: 'protocol-dev', body: 'This PR adds QUIC v2 support as specified in RFC 9369. Includes:\n- Updated transport layer\n- Connection multiplexing improvements\n- 47 new test cases\n- Benchmark results showing 23% throughput improvement',
        files: [{ filename: 'p2p/transport/quic/transport.go', patch: '@@ -1,5 +1,8 @@\n+// QUIC v2 transport implementation', additions: 234, deletions: 12, status: 'modified' }],
        additions: 234, deletions: 12, reviewComments: 3, state: 'open',
        createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), labels: ['enhancement', 'transport'], repo,
      },
      {
        id: 1002, number: 848, title: 'fix typo in readme',
        author: 'random-user-99', body: 'Fixed a typo.',
        files: [{ filename: 'README.md', patch: '@@ -1,1 +1,1 @@\n-libp2perr\n+libp2p', additions: 1, deletions: 1, status: 'modified' }],
        additions: 1, deletions: 1, reviewComments: 0, state: 'open',
        createdAt: new Date(Date.now() - 1 * 3600000).toISOString(), labels: [], repo,
      },
      {
        id: 1003, number: 849, title: 'refactor: improve peer discovery performance',
        author: 'mesh-builder', body: 'Refactors the peer discovery module to reduce latency by caching DHT results. Added integration tests and updated docs.',
        files: [{ filename: 'p2p/discovery/mdns/mdns.go', patch: '@@ -45,6 +45,28 @@\n+// Cache DHT results for faster peer discovery', additions: 89, deletions: 34, status: 'modified' }],
        additions: 89, deletions: 34, reviewComments: 1, state: 'open',
        createdAt: new Date(Date.now() - 5 * 3600000).toISOString(), labels: ['performance', 'discovery'], repo,
      },
    ];
  }

  async postComment(repo: string, prNumber: number, comment: string): Promise<void> {
    if (this.mockMode) {
      console.log(`[MOCK GitHub] Posted comment on ${repo}#${prNumber}: ${comment.substring(0, 80)}...`);
      return;
    }
    await fetch(`https://api.github.com/repos/${this.org}/${repo}/issues/${prNumber}/comments`, {
      method: 'POST',
      headers: { Authorization: `token ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: comment }),
    });
  }

  async getIssues(repo: string, state: 'open' | 'closed' = 'open'): Promise<unknown[]> {
    if (this.mockMode) return [];
    const response = await fetch(`https://api.github.com/repos/${this.org}/${repo}/issues?state=${state}`, {
      headers: { Authorization: `token ${this.token}` },
    });
    return response.json();
  }

  async createIssue(repo: string, title: string, body: string, labels: string[]): Promise<void> {
    if (this.mockMode) {
      console.log(`[MOCK GitHub] Created issue in ${repo}: ${title}`);
      return;
    }
    await fetch(`https://api.github.com/repos/${this.org}/${repo}/issues`, {
      method: 'POST',
      headers: { Authorization: `token ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, labels }),
    });
  }

  async checkRateLimit(): Promise<{ remaining: number; reset: Date }> {
    if (this.mockMode) return { remaining: 5000, reset: new Date(Date.now() + 3600000) };
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: { Authorization: `token ${this.token}` },
    });
    const data = await response.json() as { rate: { remaining: number; reset: number } };
    return { remaining: data.rate.remaining, reset: new Date(data.rate.reset * 1000) };
  }
}
