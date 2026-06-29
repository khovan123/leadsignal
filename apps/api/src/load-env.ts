import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const rootEnvironmentPath = resolve(currentDirectory, '../../../.env');

config({ path: rootEnvironmentPath });
