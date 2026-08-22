#!/usr/bin/env node
// Cross-platform stand-in for `| tee <file>` — Windows' native shells
// (cmd.exe, PowerShell) have no `tee` command, so `next dev 2>&1 | tee
// dev.log` used to fail outright there (WSL/Git Bash were fine, since
// those do carry a real `tee`). This just re-implements the two things we
// actually need: pipe stdin through to stdout unchanged, and append the
// same bytes to a log file. Node/Bun-only, no dependency on the shell.
import { createWriteStream } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: tee.mjs <file>');
  process.exit(1);
}

const out = createWriteStream(file, { flags: 'a' });

process.stdin.on('data', (chunk) => {
  process.stdout.write(chunk);
  out.write(chunk);
});
process.stdin.on('end', () => out.end());
