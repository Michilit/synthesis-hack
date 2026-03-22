import * as fs from 'fs/promises';
import * as path from 'path';
import { FilecoinStorage } from './FilecoinStorage';

const CONTEXT_FILE = path.join(process.cwd(), 'data', 'context.md');

function buildInitialTemplate(timestamp: string): string {
  return `# DPI Guardians — Project Context

*Last updated: ${timestamp}*
*This file is the source of truth for all agent state. Any agent or human can read this to understand the full project status.*

---

## Project Status

**libp2p Maintenance Health:** 🟢 OPERATIONAL
**Active Agents:** 5/5 running
**Open PRs Under Review:** 12
**Maintainer Hours Saved This Month:** 847h

---

## Open Tasks

| ID | Title | Difficulty | Status |
|----|-------|-----------|--------|
| T-001 | Add QUIC v2 transport tests | Medium | Open |
| T-002 | Sync noise protocol across implementations | Hard | Open |
| T-003 | Update go-libp2p dependencies | Easy | Open |
| T-004 | Write WebTransport spec documentation | Medium | Open |
| T-005 | Investigate DHT performance regression | Expert | Open |

---

## Recent Agent Actions

- [Maintainer] Reviewed 3 PRs across go-libp2p, js-libp2p — 2 approved, 1 flagged as AI-slop
- [Treasury] Daily P&L report generated — treasury at 2.5 ETH, +0.15 ETH yield
- [Community] Weekly newsletter drafted — 3 new ecosystem projects discovered
- [Review] Issued INTEROP_HERO badge to @protocol-dev
- [Support] Answered 12 developer questions about WebTransport integration

---

## Treasury Summary

| Metric | Value |
|--------|-------|
| ETH Balance | 2.5 ETH |
| Yield Balance | 0.15 ETH |
| APY | 5.2% |
| Total Raised (all time) | 12.3 ETH |
| Monthly Burn Rate | 0.3 ETH |
| Runway | 8+ months |

---

## Contributor Directory

| Handle | Score | Badges | Contributions |
|--------|-------|--------|---------------|
| @protocol-dev | 847 | 🏆 Interop Hero, ⭐ Core Contributor | 23 PRs |
| @mesh-builder | 634 | 🔒 Security Expert | 17 PRs |
| @quic-wizard | 521 | 📚 Doc Master | 14 PRs |

---

## Pending Decisions

- [ ] Approve 0.5 ETH spend for Q2 security audit (requires 2/3 trustee signatures)
- [ ] Assign bribe escrow #2 to contributor (@protocol-dev proposed, deadline 7 days)
- [ ] Ratify new SLA parameters for streaming agreement renewal

---

## Agent Activity Log

[Initialized] DPI Guardians context file created
`;
}

export class ContextManager {
  private filePath: string;

  constructor(filePath: string = CONTEXT_FILE) {
    this.filePath = filePath;
  }

  async initialize(): Promise<void> {
    try {
      await fs.access(this.filePath);
      // File already exists — do nothing
    } catch {
      const timestamp = new Date().toISOString();
      const template = buildInitialTemplate(timestamp);
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, template, 'utf-8');
      console.log(`[ContextManager] Initialized context file at ${this.filePath}`);
    }
  }

  async read(): Promise<string> {
    try {
      return await fs.readFile(this.filePath, 'utf-8');
    } catch {
      return '';
    }
  }

  async write(content: string): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, content, 'utf-8');
  }

  async updateSection(sectionName: string, newContent: string): Promise<void> {
    const current = await this.read();

    // Build regex to match ## SectionName block through next ## heading or EOF
    const escapedName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sectionRegex = new RegExp(
      `(## ${escapedName}[\\s\\S]*?)(?=\\n## |$)`,
      'i'
    );

    const replacement = `## ${sectionName}\n\n${newContent.trim()}\n`;

    if (sectionRegex.test(current)) {
      const updated = current.replace(sectionRegex, replacement);
      await this.write(updated);
    } else {
      // Section not found — append it
      const separator = current.endsWith('\n') ? '' : '\n';
      await this.write(`${current}${separator}\n---\n\n${replacement}`);
    }
  }

  async getSection(sectionName: string): Promise<string | null> {
    const content = await this.read();
    const escapedName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sectionRegex = new RegExp(
      `## ${escapedName}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`,
      'i'
    );
    const match = content.match(sectionRegex);
    if (!match) return null;
    return match[1].trim();
  }

  async appendToLog(entry: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${entry}`;

    const content = await this.read();
    const logSectionRegex = /(## Agent Activity Log[\s\S]*?)(?=\n## |$)/i;

    if (logSectionRegex.test(content)) {
      const updated = content.replace(logSectionRegex, (match) => {
        return match.trimEnd() + '\n' + logLine + '\n';
      });
      await this.write(updated);
    } else {
      // No log section — append one
      const separator = content.endsWith('\n') ? '' : '\n';
      await this.write(
        `${content}${separator}\n---\n\n## Agent Activity Log\n\n${logLine}\n`
      );
    }
  }

  async snapshot(storage: FilecoinStorage): Promise<string> {
    const content = await this.read();
    const cid = await storage.store('context-snapshot', content);
    console.log(`[ContextManager] Snapshot saved with CID: ${cid}`);
    return cid;
  }

  async updateLastModified(): Promise<void> {
    const content = await this.read();
    const timestamp = new Date().toISOString();
    const updated = content.replace(
      /\*Last updated: .*?\*/,
      `*Last updated: ${timestamp}*`
    );
    if (updated !== content) {
      await this.write(updated);
    }
  }
}
