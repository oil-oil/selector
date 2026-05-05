const fs = require('fs');
const type = process.argv[2] || 'patch';
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const [major, minor, patch] = manifest.version.split('.').map(Number);
if (type === 'major') manifest.version = `${major + 1}.0.0`;
else if (type === 'minor') manifest.version = `${major}.${minor + 1}.0`;
else manifest.version = `${major}.${minor}.${patch + 1}`;
fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Version bumped to ${manifest.version}`);
