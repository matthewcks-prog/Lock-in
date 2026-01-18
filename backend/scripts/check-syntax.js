const { execFileSync } = require('child_process');
const fs = require('fs');

const files = fs.readdirSync(process.cwd()).filter((name) => name.endsWith('.js'));

if (files.length === 0) {
  process.exit(0);
}

execFileSync(process.execPath, ['--check', ...files], { stdio: 'inherit' });
