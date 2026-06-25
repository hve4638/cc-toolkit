/**
 * OMC HUD Type Definitions
 *
 * Type definitions for the HUD configuration and rendering.
 */
export const DEFAULT_HUD_USAGE_POLL_INTERVAL_MS = 90 * 1000;
export const DEFAULT_HUD_CONFIG = {
    preset: 'default',
    elements: {
        cwd: true,
        cwdFormat: 'relative',
        useHyperlinks: false,
        gitBranch: true,
        model: true,
        modelFormat: 'short',
        rateLimits: true,
        contextBar: true,
        maxOutputLines: 10,
        safeMode: true,
    },
    thresholds: {
        contextWarning: 70,
        contextCompactSuggestion: 80,
        contextCritical: 85,
    },
    contextLimitWarning: {
        threshold: 80,
        autoCompact: false,
    },
    usageApiPollIntervalMs: DEFAULT_HUD_USAGE_POLL_INTERVAL_MS,
    wrapMode: 'truncate',
};
/**
 * Preset overrides keyed by HudPreset. The default preset intentionally
 * passes an empty override object because `DEFAULT_HUD_CONFIG.elements`
 * already carries the desired defaults.
 */
export const PRESET_CONFIGS = {
    default: {},
};
//# sourceMappingURL=types.js.map