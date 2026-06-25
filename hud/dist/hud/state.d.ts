/**
 * OMC HUD - Config Reading
 *
 * Reads HUD configuration from ~/.claude/settings.json (hveHud key) and the
 * legacy hud-config.json, merging both with the built-in defaults. This module
 * only reads global config; it does not touch workspace-local state.
 */
import type { HudConfig } from "./types.js";
/**
 * Read HUD configuration from disk.
 * Priority: settings.json > hud-config.json (legacy) > defaults
 */
export declare function readHudConfig(): HudConfig;
