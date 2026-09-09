const fs = require('node:fs');
const { spawn } = require('node:child_process');

const [logFile, command, ...args] = process.argv.slice(2);

if (!logFile || !command) {
  process.stderr.write(
    'Usage: node scripts/spawn-detached.cjs <log-file> <command> [...args]\n',
  );
  process.exit(1);
}

const logFd = fs.openSync(logFile, 'a');
const child = spawn(command, args, {
  cwd: process.cwd(),
  detached: process.platform !== 'win32',
  env: process.env,
  stdio: ['ignore', logFd, logFd],
});

fs.closeSync(logFd);
child.unref();

if (!child.pid) {
  process.stderr.write('Failed to start detached process.\n');
  process.exit(1);
}

process.stdout.write(String(child.pid));
