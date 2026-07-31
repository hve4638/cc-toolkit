/**
 * OMC HUD - Main Renderer
 *
 * Composes the statusline output as a single line:
 *
 *   📁 {cwd} | 🌿 {repo}({branch}) | ⏳ 5h:... wk:... | 📦 context:{pct}% | 💻 {model}
 */

import type { HudRenderContext, HudConfig } from "./types.js";
import { DEFAULT_HUD_CONFIG } from "./types.js";
import { stringWidth, getCharWidth } from "../utils/string-width.js";
import { renderContext } from "./elements/context.js";
import {
  renderRateLimitsCompactCustom,
  renderRateLimitsError,
} from "./elements/limits.js";
import { renderCwd } from "./elements/cwd.js";
import { renderGitBranch } from "./elements/git.js";
import { renderModel } from "./elements/model.js";
import { red } from "./colors.js";

/**
 * ANSI escape sequence regex (matches SGR and other CSI sequences).
 * Used to skip escape codes when measuring/truncating visible width.
 */
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/;

const PLAIN_SEPARATOR = " | ";

/**
 * Truncate a single line to a maximum visual width, preserving ANSI escape codes.
 */
export function truncateLineToMaxWidth(line: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (stringWidth(line) <= maxWidth) return line;

  const ELLIPSIS = "...";
  const ellipsisWidth = 3;
  const targetWidth = Math.max(0, maxWidth - ellipsisWidth);

  let visibleWidth = 0;
  let result = "";
  let hasAnsi = false;
  let i = 0;

  while (i < line.length) {
    const remaining = line.slice(i);
    const ansiMatch = remaining.match(ANSI_REGEX);

    if (ansiMatch && ansiMatch.index === 0) {
      result += ansiMatch[0];
      hasAnsi = true;
      i += ansiMatch[0].length;
      continue;
    }

    const codePoint = line.codePointAt(i)!;
    const codeUnits = codePoint > 0xffff ? 2 : 1;
    const char = line.slice(i, i + codeUnits);
    const charWidth = getCharWidth(char);

    if (visibleWidth + charWidth > targetWidth) break;

    result += char;
    visibleWidth += charWidth;
    i += codeUnits;
  }

  const reset = hasAnsi ? "\x1b[0m" : "";
  return result + reset + ELLIPSIS;
}

/**
 * Limit output lines to prevent input field shrinkage.
 * Preserves the first line and trims from the end with a count marker.
 */
export function limitOutputLines(lines: string[], maxLines?: number): string[] {
  const limit = Math.max(
    1,
    maxLines ?? DEFAULT_HUD_CONFIG.elements.maxOutputLines,
  );
  if (lines.length <= limit) {
    return lines;
  }
  const truncatedCount = lines.length - limit + 1;
  return [...lines.slice(0, limit - 1), `... (+${truncatedCount} lines)`];
}

/**
 * Join an array of possibly-null element strings with ` | `.
 * Null entries are omitted so two separators don't collapse.
 */
function joinElements(parts: Array<string | null>): string | null {
  const filtered = parts.filter((p): p is string => typeof p === "string" && p.length > 0);
  if (filtered.length === 0) return null;
  return filtered.join(PLAIN_SEPARATOR);
}

/**
 * Render the complete statusline using the fixed default 3-line layout.
 */
export async function render(
  context: HudRenderContext,
  config: HudConfig,
): Promise<string> {
  const { elements: enabledElements } = config;

  // ── Line 1: cwd | git | model ───────────────────────────────────────
  // WHY: when the launch base cwd no longer exists (e.g. its worktree was
  //      destroyed), cwd basename and git branch are meaningless/misleading
  //      (git would resolve a fallback dir). Replace both with a single
  //      "📁 missing" indicator.
  let cwdElement: string | null;
  let gitElement: string | null;
  if (context.cwdMissing) {
    cwdElement = `📁 ${red("missing")}`;
    gitElement = null;
  } else {
    cwdElement = enabledElements.cwd
      ? renderCwd(
          context.cwd,
          enabledElements.cwdFormat || "relative",
          enabledElements.useHyperlinks ?? false,
        )
      : null;

    gitElement = enabledElements.gitBranch
      ? renderGitBranch(context.cwd)
      : null;
  }

  const modelElement =
    enabledElements.model && context.modelName
      ? renderModel(context.modelName, enabledElements.modelFormat)
      : null;

  // ── Rate limits & context ───────────────────────────────────────────
  let limitsElement: string | null = null;
  if (enabledElements.rateLimits && context.rateLimitsResult) {
    if (context.rateLimitsResult.rateLimits) {
      limitsElement = renderRateLimitsCompactCustom(
        context.rateLimitsResult.rateLimits,
        context.rateLimitsResult.stale,
      );
    } else {
      limitsElement = renderRateLimitsError(context.rateLimitsResult);
    }
  }

  const contextElement = enabledElements.contextBar
    ? renderContext(
        context.contextPercent,
        config.thresholds,
        context.contextDisplayScope,
      )
    : null;

  // ── Main line: cwd | git | limits | context | model ────────────────
  const mainLine = joinElements([
    cwdElement,
    gitElement,
    limitsElement,
    contextElement,
    modelElement,
  ]);

  // ── Compose final output ────────────────────────────────────────────
  const outputLines: string[] = [];
  if (mainLine) outputLines.push(mainLine);

  // Respect maxOutputLines to avoid input field shrinkage.
  const limitedLines = limitOutputLines(
    outputLines,
    config.elements.maxOutputLines,
  );

  // Apply maxWidth truncation when configured.
  const finalLines =
    config.maxWidth && config.maxWidth > 0
      ? limitedLines.map((line) =>
          truncateLineToMaxWidth(line, config.maxWidth!),
        )
      : limitedLines;

  return finalLines.join("\n");
}
