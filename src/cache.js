import fs from 'fs';
import path from 'path';
import os from 'os';

const CACHE_DIR = path.join(os.homedir(), '.repolore', 'cache');

function ensureCacheDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheFilePath(repoKey) {
  const safe = repoKey.replace(/\//g, '__');
  return path.join(CACHE_DIR, `${safe}.json`);
}

export function getCached(repoKey) {
  const file = cacheFilePath(repoKey);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveCache(repoKey, data) {
  ensureCacheDir();
  const file = cacheFilePath(repoKey);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

export function deleteCache(repoKey) {
  const file = cacheFilePath(repoKey);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function listCached() {
  ensureCacheDir();
  const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const key = f.replace('.json', '').replace(/__/g, '/');
    const filePath = path.join(CACHE_DIR, f);
    const stat = fs.statSync(filePath);
    let fetchedAt = stat.mtime.toISOString();
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      fetchedAt = data.fetchedAt || fetchedAt;
    } catch {
      // ignore
    }
    return { key, fetchedAt };
  });
}
