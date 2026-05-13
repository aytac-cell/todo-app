import { readFileSync, writeFileSync } from 'fs';

const file = new URL('./version.json', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const v    = JSON.parse(readFileSync(file, 'utf8'));

// Increment patch version
const [major, minor, patch] = v.version.split('.').map(Number);
v.version   = `${major}.${minor}.${patch + 1}`;
v.updatedAt = new Date().toISOString();

writeFileSync(file, JSON.stringify(v, null, 2) + '\n');
console.log(`Version bumped to ${v.version} at ${v.updatedAt}`);
