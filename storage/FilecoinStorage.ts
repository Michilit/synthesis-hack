import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const STORAGE_DIR = path.join(process.cwd(), 'data', 'storage');

function sha256Hash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

function randomHex(length: number): string {
  return crypto.randomBytes(length).toString('hex');
}

export interface StorageResult {
  cid: string;
  size: number;
  mode: 'local' | 'filecoin';
}

export class FilecoinStorage {
  private mode: 'local' | 'filecoin';

  constructor(mode: 'local' | 'filecoin' = 'local') {
    this.mode = mode;
  }

  async store(key: string, content: string): Promise<string> {
    if (this.mode === 'filecoin') {
      const fakeCid = 'bafyrei' + randomHex(20);
      console.log(`[FilecoinStorage] Would upload to Filecoin: key=${key}, size=${content.length} bytes, cid=${fakeCid}`);
      return fakeCid;
    }

    // Local mode: hash the content, write to data/storage/{hash}.json
    const hash = sha256Hash(content);
    await fs.mkdir(STORAGE_DIR, { recursive: true });

    const filePath = path.join(STORAGE_DIR, `${hash}.json`);
    const payload = {
      key,
      hash,
      storedAt: new Date().toISOString(),
      content,
    };

    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return hash;
  }

  async retrieve(cid: string): Promise<string | null> {
    if (this.mode === 'filecoin') {
      console.log(`[FilecoinStorage] Would retrieve from Filecoin: cid=${cid}`);
      return null;
    }

    try {
      const filePath = path.join(STORAGE_DIR, `${cid}.json`);
      const raw = await fs.readFile(filePath, 'utf-8');
      const payload = JSON.parse(raw);
      return payload.content ?? null;
    } catch {
      return null;
    }
  }

  async listSnapshots(prefix: string): Promise<string[]> {
    if (this.mode === 'filecoin') {
      console.log(`[FilecoinStorage] Would list Filecoin snapshots with prefix=${prefix}`);
      return [];
    }

    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
      const files = await fs.readdir(STORAGE_DIR);
      const matching = files
        .filter((f) => f.endsWith('.json') && f.startsWith(prefix))
        .map((f) => f.replace(/\.json$/, ''));
      return matching;
    } catch {
      return [];
    }
  }

  async storeObject(key: string, obj: unknown): Promise<string> {
    return this.store(key, JSON.stringify(obj, null, 2));
  }

  async retrieveObject<T = unknown>(cid: string): Promise<T | null> {
    const raw = await this.retrieve(cid);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async exists(cid: string): Promise<boolean> {
    if (this.mode === 'filecoin') return false;
    try {
      const filePath = path.join(STORAGE_DIR, `${cid}.json`);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getMode(): 'local' | 'filecoin' {
    return this.mode;
  }
}
