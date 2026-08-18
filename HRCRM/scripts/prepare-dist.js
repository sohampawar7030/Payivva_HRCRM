import { existsSync, copyFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function copyDir(src, dest) {
  if (!existsSync(src)) {
    console.error(`Source not found: ${src}. Run the frontend build first.`);
    process.exit(1);
  }
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

const envPath = '.env';
if (!existsSync(envPath)) {
  copyFileSync('.env.example', envPath);
  console.log('Created .env from .env.example - please fill in real credentials.');
}

copyDir('frontend/dist', 'dist');
console.log('Vercel dist prepared.');