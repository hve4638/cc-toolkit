/**
 * Codex Tools — named GPT conversations via the Codex CLI
 *
 * Wraps `codex exec` to provide Agent/SendMessage-style semantics:
 * - codex_agent: start a new named codex session
 * - codex_send:  continue an existing named session
 *
 * Why a wrapper instead of the upstream codex MCP server:
 * - upstream sandbox modes break inside containers (no disk access), so the
 *   sandbox bypass flags are baked in here
 * - upstream pins the model; here the model is chosen per agent and re-passed
 *   on every resume (codex resume does NOT retain the session's model — it
 *   falls back to the config default otherwise; measured on codex-cli 0.137.0)
 *
 * State: <project>/.agent-memory/codex/<claude-session-id>/<name>.json
 * holding { uuid, model } so `claude --resume` (same session id, fresh MCP
 * process) can re-hydrate the mapping. Codex sessions are always referenced
 * by UUID — never `--last` or thread names, which are global across sessions.
 */

import { z } from "zod";
import { spawn } from "child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { dirname, isAbsolute, join, resolve } from "path";
import type { ToolDefinition } from "./types.js";

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const DEFAULT_TIMEOUT_SEC = 1800;

interface CodexAgentState {
  uuid: string;
  model: string | null;
  createdAt: string;
  lastUsedAt: string;
}

function projectRoot(): string {
  return process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
}

function stateDir(): string {
  const sid = process.env.CLAUDE_CODE_SESSION_ID ?? "no-session";
  return join(projectRoot(), ".agent-memory", "codex", sid);
}

function stateFile(name: string): string {
  return join(stateDir(), `${name}.json`);
}

function readState(name: string): CodexAgentState | null {
  try {
    return JSON.parse(readFileSync(stateFile(name), "utf-8")) as CodexAgentState;
  } catch {
    return null;
  }
}

function writeState(name: string, state: CodexAgentState): void {
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(stateFile(name), JSON.stringify(state, null, 2) + "\n", "utf-8");
}

function textResult(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], isError };
}

/**
 * The server dispatch passes raw args to handlers without running the zod
 * schema, so the name pattern must be re-checked here — it feeds a file path.
 */
function invalidName(name: string) {
  return textResult(
    `invalid name "${name}": must match ${NAME_PATTERN.source}`,
    true,
  );
}

interface CodexExecResult {
  exitCode: number | null;
  timedOut: boolean;
  threadId: string | null;
  /** Concatenated agent_message texts from the JSONL stream (fallback body). */
  agentMessages: string[];
  lastMessage: string;
  stderrTail: string;
}

/**
 * Run `codex exec`, parse the --json event stream for the thread id, and
 * collect the final message via --output-last-message.
 */
function runCodexExec(opts: {
  resumeUuid?: string;
  model: string | null;
  message: string;
  timeoutSec: number;
}): Promise<CodexExecResult> {
  const tmpDir = mkdtempSync(join(tmpdir(), "codex-mcp-"));
  const lastMessageFile = join(tmpDir, "last-message.txt");

  const args = ["exec"];
  if (opts.resumeUuid) args.push("resume", opts.resumeUuid);
  args.push(
    "--json",
    "--output-last-message", lastMessageFile,
    "--dangerously-bypass-approvals-and-sandbox",
    "--skip-git-repo-check",
  );
  if (opts.model) args.push("-m", opts.model);
  // "-" = read the prompt from stdin; avoids argv edge cases (leading "-", size)
  args.push("-");

  return new Promise((resolvePromise) => {
    const child = spawn("codex", args, {
      cwd: projectRoot(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdoutBuf = "";
    let stderrBuf = "";
    let threadId: string | null = null;
    const agentMessages: string[] = [];
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeoutSec * 1000);

    const processLine = (line: string) => {
      if (!line) return;
      try {
        const event = JSON.parse(line);
        if (event.type === "thread.started" && typeof event.thread_id === "string") {
          threadId = event.thread_id;
        } else if (
          event.type === "item.completed" &&
          event.item?.type === "agent_message" &&
          typeof event.item.text === "string"
        ) {
          agentMessages.push(event.item.text);
        }
      } catch {
        // Non-JSON line (warnings etc.) — ignore
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString("utf-8");
      let nl: number;
      while ((nl = stdoutBuf.indexOf("\n")) !== -1) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        processLine(line);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuf = (stderrBuf + chunk.toString("utf-8")).slice(-4000);
    });

    const finish = (exitCode: number | null) => {
      clearTimeout(timer);
      processLine(stdoutBuf.trim());
      let lastMessage = "";
      try {
        lastMessage = readFileSync(lastMessageFile, "utf-8");
      } catch {
        // File absent on failure — fall back to agentMessages
      }
      rmSync(tmpDir, { recursive: true, force: true });
      resolvePromise({
        exitCode,
        timedOut,
        threadId,
        agentMessages,
        lastMessage,
        stderrTail: stderrBuf.trim(),
      });
    };

    child.on("error", (err) => {
      clearTimeout(timer);
      rmSync(tmpDir, { recursive: true, force: true });
      resolvePromise({
        exitCode: null,
        timedOut: false,
        threadId: null,
        agentMessages: [],
        lastMessage: "",
        stderrTail: `failed to spawn codex: ${err.message}`,
      });
    });

    child.on("close", finish);

    // Swallow EPIPE if codex exits before draining stdin — an unhandled
    // stream 'error' would escape the promise and crash the shared server.
    child.stdin.on("error", () => {});
    child.stdin.write(opts.message);
    child.stdin.end();
  });
}

/** Deliver the reply: inline, or written to output_file with only the path returned. */
function deliverReply(
  result: CodexExecResult,
  outputFile: string | undefined,
  meta: { name: string },
) {
  const body = result.lastMessage || result.agentMessages.join("\n\n");
  if (!outputFile) {
    return textResult(body || "(empty reply)");
  }
  const target = isAbsolute(outputFile) ? outputFile : resolve(projectRoot(), outputFile);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body, "utf-8");
  return textResult(
    `Reply from codex agent "${meta.name}" saved to ${target} (${Buffer.byteLength(body, "utf-8")} bytes)`,
  );
}

function execFailure(result: CodexExecResult, timeoutSec: number) {
  if (result.timedOut) {
    return textResult(`codex exec timed out after ${timeoutSec}s`, true);
  }
  return textResult(
    `codex exec failed (exit ${result.exitCode})${result.stderrTail ? `:\n${result.stderrTail}` : ""}`,
    true,
  );
}

const timeoutSchema = z
  .number()
  .int()
  .min(1)
  .optional()
  .describe(`Timeout in seconds (default: ${DEFAULT_TIMEOUT_SEC})`);

const outputFileSchema = z
  .string()
  .optional()
  .describe(
    "If set, write the reply to this file (relative paths resolve against the project root) and return only the path. Omit to return the reply inline.",
  );

export const codexAgentTool: ToolDefinition<{
  name: z.ZodString;
  message: z.ZodString;
  model: z.ZodOptional<z.ZodString>;
  output_file: z.ZodOptional<z.ZodString>;
  timeout: z.ZodOptional<z.ZodNumber>;
}> = {
  name: "codex_agent",
  description: `Start a named GPT conversation via the Codex CLI (Agent-style, but backed by OpenAI models).

Creates a new codex session, remembers name → session mapping (scoped to this Claude session), and returns the reply. Continue the conversation with codex_send using the same name.

Runs with full disk access in the project directory (sandbox bypassed by design — intended for already-isolated environments).`,
  annotations: {
    readOnlyHint: false,
    openWorldHint: true,
  },
  schema: {
    name: z
      .string()
      .regex(NAME_PATTERN, "must match ^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
      .describe("Name for this conversation; address it later via codex_send"),
    message: z.string().min(1).describe("First message (task/prompt) for the GPT agent"),
    model: z
      .string()
      .optional()
      .describe("OpenAI model id (e.g. gpt-5.4). Omit to use the codex config default."),
    output_file: outputFileSchema,
    timeout: timeoutSchema,
  },
  handler: async (args) => {
    if (!NAME_PATTERN.test(args.name)) {
      return invalidName(args.name);
    }
    if (readState(args.name)) {
      return textResult(
        `codex agent "${args.name}" already exists in this session. Use codex_send to continue it, or pick another name.`,
        true,
      );
    }

    const timeoutSec = args.timeout ?? DEFAULT_TIMEOUT_SEC;
    const model = args.model ?? null;
    const result = await runCodexExec({ model, message: args.message, timeoutSec });

    if (result.timedOut || result.exitCode !== 0) {
      return execFailure(result, timeoutSec);
    }
    if (!result.threadId) {
      return textResult(
        "codex exec succeeded but no thread.started event was found in the --json stream; cannot persist the session mapping. Raw reply:\n" +
          (result.lastMessage || result.agentMessages.join("\n\n")),
        true,
      );
    }

    const now = new Date().toISOString();
    writeState(args.name, {
      uuid: result.threadId,
      model,
      createdAt: now,
      lastUsedAt: now,
    });

    return deliverReply(result, args.output_file, { name: args.name });
  },
};

export const codexSendTool: ToolDefinition<{
  name: z.ZodString;
  message: z.ZodString;
  output_file: z.ZodOptional<z.ZodString>;
  timeout: z.ZodOptional<z.ZodNumber>;
}> = {
  name: "codex_send",
  description: `Continue a named GPT conversation created by codex_agent (SendMessage-style).

Resumes the underlying codex session with its original model; prior context is retained.`,
  annotations: {
    readOnlyHint: false,
    openWorldHint: true,
  },
  schema: {
    name: z
      .string()
      .regex(NAME_PATTERN, "must match ^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
      .describe("Name of the conversation to continue (as given to codex_agent)"),
    message: z.string().min(1).describe("Next message for the GPT agent"),
    output_file: outputFileSchema,
    timeout: timeoutSchema,
  },
  handler: async (args) => {
    if (!NAME_PATTERN.test(args.name)) {
      return invalidName(args.name);
    }
    const state = readState(args.name);
    if (!state) {
      return textResult(
        `No codex agent named "${args.name}" in this session. Create it first with codex_agent.`,
        true,
      );
    }

    const timeoutSec = args.timeout ?? DEFAULT_TIMEOUT_SEC;
    // codex resume does not retain the session's model — always re-pass it.
    const result = await runCodexExec({
      resumeUuid: state.uuid,
      model: state.model,
      message: args.message,
      timeoutSec,
    });

    if (result.timedOut || result.exitCode !== 0) {
      return execFailure(result, timeoutSec);
    }

    writeState(args.name, { ...state, lastUsedAt: new Date().toISOString() });

    return deliverReply(result, args.output_file, { name: args.name });
  },
};

export const codexTools = [codexAgentTool, codexSendTool];
