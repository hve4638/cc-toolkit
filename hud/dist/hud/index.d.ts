#!/usr/bin/env node
/**
 * HUD - Main Entry Point
 *
 * Statusline command that visualizes session state from Claude Code stdin.
 * Receives stdin JSON from Claude Code and outputs a formatted statusline.
 *
 * Renders five elements, all sourced from stdin or git:
 *   cwd | gitBranch | rateLimits | contextBar | model
 */
/**
 * Main HUD entry point
 */
declare function main(): Promise<void>;
export { main };
