#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
// WHY: 훅과 같은 천장-aware read-context 를 공유한다 (Part 1 의 lib).
//      esbuild 가 번들에 인라인하므로 런타임 .cjs 는 자기완결.
import { readContextChain, formatForMcp } from '../../lib/read-context.mjs';
import { findMarkerDir } from '../../../../scripts/lib/markers.mjs';

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) return null;
  const end = content.indexOf('\n---', 4);
  if (end < 0) return null;
  const body = content.slice(4, end);
  const result = {};
  for (const line of body.split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (m) result[m[1]] = m[2].trim();
  }
  return result;
}

function readContext(dir) {
  const file = join(dir, 'INLAY.md');
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const fm = parseFrontmatter(content);
  if (!fm) return null;
  return {
    name: fm.name ?? '',
    purpose: fm.purpose ?? '',
    path: file,
  };
}

function search(startPath) {
  const root = resolve(startPath);
  const results = [];
  const here = readContext(root);
  if (here) results.push(here);

  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    if (!e.isDirectory()) continue;
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const child = readContext(join(root, e.name));
    if (child) results.push(child);
  }
  return results;
}

// WHY: MCP 호출은 LLM 의 명시 행위, 훅은 자동 주입 — 두 trigger 가 다르므로
//      dedup 단위를 공유하지 않는다. MCP 서버는 자기 프로세스 수명 동안의
//      인메모리 cache 만 본다. 훅은 별도로 파일 cache 사용.
const mcpCache = { hashes: {} };

function normalizeMcpPath(input) {
  if (!input) return process.cwd();
  const resolved = resolve(input);
  try {
    return statSync(resolved).isDirectory() ? resolved : dirname(resolved);
  } catch {
    // WHY: 신규 파일처럼 아직 디스크에 없는 path 도 부모 dir 에서 chain 을
    //      시작할 수 있어야 한다. ENOENT 는 정상 입력의 한 형태.
    return dirname(resolved);
  }
}

const server = new Server(
  { name: 'inlay', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search',
      description:
        'Find INLAY.md at the given path and its immediate children (depth ≤ 1). Deeper nesting is ignored. Returns name, purpose, path for each match.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Start directory. Defaults to current working directory.',
          },
        },
        required: [],
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    {
      name: 'read_context',
      description:
        'Read the INLAY.md ancestor chain from the given path up to the nearest .inlay ancestor directory (the chain stops at, and includes, that .inlay directory; it never looks above it). If no .inlay directory exists above the path, the path is outside any inlay scope and the result is empty. Output is top-down (root first): a string of <inlay-context path="...">...</inlay-context> blocks. Stateful: an INLAY.md whose content is unchanged since it was last served in this MCP server process is rendered with body "(already read)".',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Start path (file or directory). Defaults to current working directory.',
          },
        },
        required: [],
      },
      annotations: {
        readOnlyHint: true,
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (name === 'search') {
      const results = search(args?.path ?? process.cwd());
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
    if (name === 'read_context') {
      const startDir = normalizeMcpPath(args?.path);
      // WHY: 천장은 시작 경로에서 올라가며 찾은 .inlay 디렉터리. 훅 게이트와
      //      일치 — .inlay 가 없으면 그 경로는 어떤 inlay 스코프에도 안 속하므로
      //      빈 결과를 돌려준다 (INLAY.md 를 아예 보지 않음).
      const ceiling = findMarkerDir(startDir, '.inlay');
      if (!ceiling) return { content: [{ type: 'text', text: '' }] };
      const entries = readContextChain(startDir, { cache: mcpCache, ceiling });
      return { content: [{ type: 'text', text: formatForMcp(entries) }] };
    }
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: 'text', text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('inlay MCP server running on stdio');
}

main().catch((e) => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
