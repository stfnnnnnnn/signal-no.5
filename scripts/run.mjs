// Runs a command with ELECTRON_RUN_AS_NODE cleared (VS Code's extension host sets it, which makes
// electron.exe behave as plain Node). Usage: node scripts/run.mjs <command> [...args]
import { spawn } from 'node:child_process';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const [cmd, ...args] = process.argv.slice(2);
const child = spawn(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
child.on('exit', (code) => process.exit(code ?? 1));
