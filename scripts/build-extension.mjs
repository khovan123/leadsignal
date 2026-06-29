import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const browser = process.argv[2];
if (!['chrome', 'firefox'].includes(browser)) {
  console.error('Usage: node scripts/build-extension.mjs <chrome|firefox>');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'apps/extension');
const output = resolve(root, `dist/extension-${browser}`);
const files = [
  'api.js',
  'background.js',
  'content-leadsignal.js',
  'content-reddit.js',
  'crypto.js',
  'options.css',
  'options.html',
  'options.js',
  'popup.css',
  'popup.html',
  'popup.js',
];

if (browser === 'firefox') {
  files.push('icon-firefox.svg');
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(files.map((file) => cp(resolve(source, file), resolve(output, file))));

const manifestName = browser === 'firefox' ? 'manifest.firefox.json' : 'manifest.json';
const manifest = await readFile(resolve(source, manifestName), 'utf8');
await writeFile(resolve(output, 'manifest.json'), manifest);

console.log(`Built ${browser} extension at ${output}`);
