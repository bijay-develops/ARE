import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function readFileSafe(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
}

export async function writeFile(file: string, contents: string): Promise<void> {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, contents, 'utf8');
}
