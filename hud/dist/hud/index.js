#!/usr/bin/env node
/**
 * OMC HUD - Main Entry Point
 *
 * Statusline command that visualizes session state from Claude Code stdin.
 * Receives stdin JSON from Claude Code and outputs a formatted statusline.
 *
 * Renders five elements, all sourced from stdin or git:
 *   cwd | gitBranch | rateLimits | contextBar | model
 */
import { readStdin, getContextPercent, getModelName, getRateLimitsFromStdin, stabilizeContextPercent, } from "./stdin.js";
import { readHudConfig } from "./state.js";
import { getUsage } from "./usage-api.js";
import { executeCustomProvider } from "./custom-rate-provider.js";
import { render } from "./render.js";
import { sanitizeOutput } from "./sanitize.js";
import { resolveToWorktreeRoot } from "../lib/worktree-paths.js";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getClaudeConfigDir } from "../utils/config-dir.js";
/**
 * Read the HUD plugin version from plugin.json.
 */
function getHudPluginVersion() {
    try {
        const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".claude-plugin", "plugin.json");
        return JSON.parse(readFileSync(pkgPath, "utf8")).version ?? "0.0.0";
    }
    catch {
        return "0.0.0";
    }
}
/**
 * Show installation diagnostic when called from CLI without stdin.
 * Helps users verify HUD setup after setup.
 */
function showDiagnostic() {
    const version = getHudPluginVersion();
    const configDir = getClaudeConfigDir();
    const hudScript = join(configDir, "hud", "omc-hud.mjs");
    const settingsFile = join(configDir, "settings.json");
    const hudExists = existsSync(hudScript);
    let statusLineOk = false;
    try {
        const settings = JSON.parse(readFileSync(settingsFile, "utf-8"));
        const sl = settings.statusLine;
        if (sl && typeof sl === "object" && typeof sl.command === "string") {
            statusLineOk = sl.command.includes("omc-hud");
        }
        else if (typeof sl === "string") {
            statusLineOk = sl.includes("omc-hud");
        }
    }
    catch {
        /* settings.json missing or invalid */
    }
    const config = readHudConfig();
    const preset = config.preset ?? "default";
    console.log(`[OMC] HUD v${version} | preset: ${preset}`);
    console.log(`  HUD script:  ${hudExists ? "installed" : "MISSING"}`);
    console.log(`  statusLine:  ${statusLineOk ? "configured" : "NOT configured"}`);
    if (!hudExists || !statusLineOk) {
        console.log("  Run /oh-my-claudecode:hud setup to fix.");
    }
    else {
        console.log("  HUD renders automatically inside Claude Code sessions.");
    }
}
/**
 * Main HUD entry point
 */
async function main() {
    try {
        // Read stdin from Claude Code
        const stdin = await readStdin();
        if (!stdin) {
            // CLI invocation (TTY, no stdin) — show installation diagnostic
            showDiagnostic();
            return;
        }
        const stableStdin = stabilizeContextPercent(stdin, null);
        const cwd = resolveToWorktreeRoot(stableStdin.cwd || undefined);
        // WHY: resolveToWorktreeRoot falls back to process.cwd() when the launch
        //      base cwd is gone, which would mask a deleted workspace. Check the
        //      raw stdin.cwd so we can surface a "missing" indicator instead.
        const cwdMissing = !!stableStdin.cwd && !existsSync(stableStdin.cwd);
        // Clone to avoid mutating shared DEFAULT_HUD_CONFIG when applying runtime width detection
        const config = { ...readHudConfig() };
        // Auto-detect terminal width if not explicitly configured (#1726)
        // Prefer live TTY columns (responds to resize) over static COLUMNS env var
        if (config.maxWidth === undefined) {
            const cols = process.stderr.columns ||
                process.stdout.columns ||
                parseInt(process.env.COLUMNS ?? "0", 10) ||
                0;
            if (cols > 0) {
                config.maxWidth = cols;
                if (config.wrapMode === "truncate")
                    config.wrapMode = "wrap";
            }
        }
        // Prefer Claude Code stdin rate limits when available to avoid cold-start API fetches.
        const stdinRateLimits = getRateLimitsFromStdin(stableStdin);
        const rateLimitsResult = config.elements.rateLimits === false
            ? null
            : stdinRateLimits
                ? { rateLimits: stdinRateLimits }
                : await getUsage();
        // Fetch custom rate limit buckets (if configured)
        const customBuckets = config.rateLimitsProvider?.type === "custom"
            ? await executeCustomProvider(config.rateLimitsProvider)
            : null;
        const contextPercent = getContextPercent(stableStdin);
        // Build render context (stdin/git sourced only)
        const context = {
            contextPercent,
            contextDisplayScope: cwd,
            modelName: getModelName(stableStdin),
            cwd,
            cwdMissing,
            rateLimitsResult,
            customBuckets,
        };
        // Render and output
        let output = await render(context, config);
        // Apply safe mode sanitization if enabled (Issue #346)
        // This strips ANSI codes and uses ASCII-only output to prevent
        // terminal rendering corruption during concurrent updates.
        // On Windows, default to safe mode unless the user explicitly sets safeMode: false
        // (e.g. Windows Terminal and modern terminals support ANSI natively).
        // explicit false overrides platform detection: process.platform === 'win32'
        const useSafeMode = config.elements.safeMode !== false &&
            (config.elements.safeMode || process.platform === "win32");
        if (useSafeMode) {
            output = sanitizeOutput(output);
            // In safe mode, use regular spaces (don't convert to non-breaking)
            console.log(output);
        }
        else {
            // Replace spaces with non-breaking spaces for terminal alignment
            const formattedOutput = output.replace(/ /g, " ");
            console.log(formattedOutput);
        }
    }
    catch (error) {
        // Distinguish installation errors from runtime errors
        const isInstallError = error instanceof Error &&
            (error.message.includes("ENOENT") ||
                error.message.includes("MODULE_NOT_FOUND") ||
                error.message.includes("Cannot find module"));
        if (isInstallError) {
            console.log("[OMC] run /omc-setup to install properly");
        }
        else {
            // Output fallback message to stdout for status line visibility
            console.log("[OMC] HUD error - check stderr");
            // Log actual runtime errors to stderr for debugging
            console.error("[OMC HUD Error]", error instanceof Error ? error.message : error);
        }
    }
}
// Export for programmatic use
export { main };
// Auto-run (unconditional so dynamic import() via omc-hud.mjs wrapper works correctly)
main();
//# sourceMappingURL=index.js.map