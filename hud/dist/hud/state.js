/**
 * OMC HUD - Config Reading
 *
 * Reads HUD configuration from ~/.claude/settings.json (hveHud key) and the
 * legacy hud-config.json, merging both with the built-in defaults. This module
 * only reads global config; it does not touch workspace-local state.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getClaudeConfigDir } from "../utils/config-dir.js";
import { DEFAULT_HUD_CONFIG, PRESET_CONFIGS } from "./types.js";
// ============================================================================
// Path Helpers
// ============================================================================
/**
 * Get Claude Code settings.json path
 */
function getSettingsFilePath() {
    return join(getClaudeConfigDir(), "settings.json");
}
/**
 * Get the HUD config file path (legacy)
 */
function getConfigFilePath() {
    return join(getClaudeConfigDir(), ".omc", "hud-config.json");
}
function readJsonFile(filePath) {
    if (!existsSync(filePath)) {
        return null;
    }
    try {
        return JSON.parse(readFileSync(filePath, "utf-8"));
    }
    catch {
        return null;
    }
}
function getLegacyHudConfig() {
    return readJsonFile(getConfigFilePath());
}
function mergeElements(primary, secondary) {
    return {
        ...(primary ?? {}),
        ...(secondary ?? {}),
    };
}
function mergeThresholds(primary, secondary) {
    return {
        ...(primary ?? {}),
        ...(secondary ?? {}),
    };
}
function mergeContextLimitWarning(primary, secondary) {
    return {
        ...(primary ?? {}),
        ...(secondary ?? {}),
    };
}
// ============================================================================
// HUD Config Operations
// ============================================================================
/**
 * Read HUD configuration from disk.
 * Priority: settings.json > hud-config.json (legacy) > defaults
 */
export function readHudConfig() {
    const settingsFile = getSettingsFilePath();
    const legacyConfig = getLegacyHudConfig();
    if (existsSync(settingsFile)) {
        try {
            const content = readFileSync(settingsFile, "utf-8");
            const settings = JSON.parse(content);
            if (settings.hveHud) {
                return mergeWithDefaults({
                    ...legacyConfig,
                    ...settings.hveHud,
                    elements: mergeElements(legacyConfig?.elements, settings.hveHud.elements),
                    thresholds: mergeThresholds(legacyConfig?.thresholds, settings.hveHud.thresholds),
                    contextLimitWarning: mergeContextLimitWarning(legacyConfig?.contextLimitWarning, settings.hveHud.contextLimitWarning),
                });
            }
        }
        catch (error) {
            console.error("[HUD] Failed to read settings.json:", error instanceof Error ? error.message : error);
        }
    }
    if (legacyConfig) {
        return mergeWithDefaults(legacyConfig);
    }
    return DEFAULT_HUD_CONFIG;
}
/**
 * Merge partial config with defaults
 */
function mergeWithDefaults(config) {
    const preset = config.preset ?? DEFAULT_HUD_CONFIG.preset;
    const presetElements = PRESET_CONFIGS[preset] ?? {};
    return {
        preset,
        elements: {
            ...DEFAULT_HUD_CONFIG.elements, // Base defaults
            ...presetElements, // Preset overrides
            ...config.elements, // User overrides
        },
        thresholds: {
            ...DEFAULT_HUD_CONFIG.thresholds,
            ...config.thresholds,
        },
        contextLimitWarning: {
            ...DEFAULT_HUD_CONFIG.contextLimitWarning,
            ...config.contextLimitWarning,
        },
        usageApiPollIntervalMs: config.usageApiPollIntervalMs ??
            DEFAULT_HUD_CONFIG.usageApiPollIntervalMs,
        ...(config.elementOrder !== undefined
            ? { elementOrder: config.elementOrder }
            : {}),
        wrapMode: config.wrapMode ?? DEFAULT_HUD_CONFIG.wrapMode,
        ...(config.rateLimitsProvider
            ? { rateLimitsProvider: config.rateLimitsProvider }
            : {}),
        ...(config.maxWidth != null ? { maxWidth: config.maxWidth } : {}),
        ...(config.layout ? { layout: config.layout } : {}),
    };
}
//# sourceMappingURL=state.js.map