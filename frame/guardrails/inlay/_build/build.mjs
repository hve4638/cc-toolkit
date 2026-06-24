#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { mkdir } from 'node:fs/promises';

const outfile = '../bridge/mcp-server.cjs';
await mkdir('../bridge', { recursive: true });

const watchMode = process.argv.includes('--watch');

const config = {
  entryPoints: ['src/server.mjs'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile,
  mainFields: ['module', 'main'],
  external: [
    'fs', 'path', 'os', 'util', 'stream', 'events',
    'buffer', 'crypto', 'http', 'https', 'url',
    'child_process', 'assert', 'module', 'net', 'tls',
    'dns', 'readline', 'tty', 'worker_threads',
  ],
};

if (watchMode) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log(`Watching ${outfile}...`);
} else {
  await esbuild.build(config);
  console.log(`Built ${outfile}`);
}
