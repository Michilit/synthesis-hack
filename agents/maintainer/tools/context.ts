import * as fs from 'fs/promises';
import * as path from 'path';

export class ContextTool {
  private contextPath: string;

  constructor(contextPath?: string) {
    this.contextPath = contextPath ?? path.join(process.cwd(), 'data', 'context.md');
  }

  async read(): Promise<string> {
    try {
      return await fs.readFile(this.contextPath, 'utf-8');
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        const initial = '# DPI Guardians Context\n\n_Initialized: ' + new Date().toISOString() + '_\n\n';
        await this.write(initial);
        return initial;
      }
      throw err;
    }
  }

  async write(content: string): Promise<void> {
    await fs.mkdir(path.dirname(this.contextPath), { recursive: true });
    await fs.writeFile(this.contextPath, content, 'utf-8');
  }

  async appendSection(sectionTitle: string, content: string): Promise<void> {
    const existing = await this.read();
    const sectionHeader = `## ${sectionTitle}`;

    // Check if section already exists and replace it
    const sectionRegex = new RegExp(
      `## ${escapeRegex(sectionTitle)}\\n[\\s\\S]*?(?=\\n## |$)`,
      'g'
    );

    const newSection = `${sectionHeader}\n\n_Updated: ${new Date().toISOString()}_\n\n${content}\n\n`;

    if (sectionRegex.test(existing)) {
      const updated = existing.replace(sectionRegex, newSection);
      await this.write(updated);
    } else {
      // Append new section to end
      const separator = existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
      await this.write(existing + separator + newSection);
    }
  }

  async getSection(sectionTitle: string): Promise<string | null> {
    const content = await this.read();
    const sectionHeader = `## ${sectionTitle}`;
    const startIndex = content.indexOf(sectionHeader);

    if (startIndex === -1) {
      return null;
    }

    const afterHeader = content.indexOf('\n', startIndex) + 1;
    const nextSectionIndex = content.indexOf('\n## ', afterHeader);

    if (nextSectionIndex === -1) {
      return content.slice(afterHeader).trim();
    }

    return content.slice(afterHeader, nextSectionIndex).trim();
  }

  async getAllSections(): Promise<Record<string, string>> {
    const content = await this.read();
    const sections: Record<string, string> = {};

    const lines = content.split('\n');
    let currentSection: string | null = null;
    const currentLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (currentSection !== null) {
          sections[currentSection] = currentLines.join('\n').trim();
          currentLines.length = 0;
        }
        currentSection = line.slice(3).trim();
      } else if (currentSection !== null) {
        currentLines.push(line);
      }
    }

    if (currentSection !== null && currentLines.length > 0) {
      sections[currentSection] = currentLines.join('\n').trim();
    }

    return sections;
  }

  async deleteSection(sectionTitle: string): Promise<boolean> {
    const content = await this.read();
    const sectionRegex = new RegExp(
      `## ${escapeRegex(sectionTitle)}\\n[\\s\\S]*?(?=\\n## |$)`,
      'g'
    );

    if (!sectionRegex.test(content)) {
      return false;
    }

    const updated = content.replace(sectionRegex, '').replace(/\n{3,}/g, '\n\n');
    await this.write(updated);
    return true;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
