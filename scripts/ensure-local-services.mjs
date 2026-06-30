import { spawn } from 'node:child_process';
import net from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

config({ path: resolve(root, '.env.local') });
config({ path: resolve(root, '.env') });

function isLocalServiceUrl(value, defaultPort) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1'].includes(url.hostname) && Number(url.port || defaultPort) === defaultPort;
  } catch {
    return false;
  }
}

function run(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', rejectPromise);
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}

function waitForPort(port, name, timeoutMs = 60_000) {
  const startedAt = Date.now();

  return new Promise((resolvePromise, rejectPromise) => {
    const tryConnect = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port });

      const fail = () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          rejectPromise(new Error(`${name} did not become ready on localhost:${port} within ${timeoutMs / 1000}s`));
          return;
        }
        setTimeout(tryConnect, 1000);
      };

      socket.setTimeout(1000);
      socket.once('connect', () => {
        socket.end();
        resolvePromise();
      });
      socket.once('timeout', fail);
      socket.once('error', fail);
    };

    tryConnect();
  });
}

const needsPostgres = isLocalServiceUrl(process.env.DATABASE_URL, 5432);
const needsValkey = isLocalServiceUrl(process.env.VALKEY_URL, 6379);

if (!needsPostgres && !needsValkey) {
  process.exit(0);
}

const services = [
  ...(needsPostgres ? ['postgres'] : []),
  ...(needsValkey ? ['valkey'] : []),
];

console.log(`Ensuring local services: ${services.join(', ')}`);

try {
  await run('docker', ['compose', 'up', '-d', ...services]);
  await Promise.all([
    needsPostgres ? waitForPort(5432, 'Postgres') : Promise.resolve(),
    needsValkey ? waitForPort(6379, 'Valkey') : Promise.resolve(),
  ]);
  console.log('Local services are ready.');
} catch (error) {
  console.error('Failed to prepare local dev services.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
