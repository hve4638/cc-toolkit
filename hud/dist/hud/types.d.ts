/**
 * OMC HUD Type Definitions
 *
 * Type definitions for the HUD configuration and rendering.
 */
export interface StatuslineStdin {
    /** Transcript path (used only as a context-stream identity key, never read) */
    transcript_path?: string;
    /** Current working directory */
    cwd?: string;
    /** Model information from Claude Code statusline stdin */
    model?: {
        id?: string;
        display_name?: string;
    };
    /** Context window metrics from Claude Code statusline stdin */
    context_window?: {
        context_window_size?: number;
        used_percentage?: number;
        current_usage?: {
            input_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
        };
    };
    /** Rate limits from Claude Code statusline stdin */
    rate_limits?: {
        five_hour?: {
            used_percentage?: number;
            resets_at?: number | string;
        };
        seven_day?: {
            used_percentage?: number;
            resets_at?: number | string;
        };
    };
}
export interface RateLimits {
    /** 5-hour rolling window usage percentage (0-100) - all models combined */
    fiveHourPercent: number;
    /** Weekly usage percentage (0-100) - all models combined (undefined if not applicable) */
    weeklyPercent?: number;
    /** When the 5-hour limit resets (null if unavailable) */
    fiveHourResetsAt?: Date | null;
    /** When the weekly limit resets (null if unavailable) */
    weeklyResetsAt?: Date | null;
    /** Sonnet-specific weekly usage percentage (0-100), if available from API */
    sonnetWeeklyPercent?: number;
    /** Sonnet weekly reset time */
    sonnetWeeklyResetsAt?: Date | null;
    /** Opus-specific weekly usage percentage (0-100), if available from API */
    opusWeeklyPercent?: number;
    /** Opus weekly reset time */
    opusWeeklyResetsAt?: Date | null;
    /** Monthly usage percentage (0-100), if available from API */
    monthlyPercent?: number;
    /** When the monthly limit resets (null if unavailable) */
    monthlyResetsAt?: Date | null;
    /** Extra (metered) usage percentage (0-100), derived from spent/limit or API utilization */
    extraUsagePercent?: number;
    /** Extra usage amount spent in USD */
    extraUsageSpentUsd?: number;
    /** Extra usage limit in USD */
    extraUsageLimitUsd?: number;
    /** When the extra usage period resets (null if unavailable) */
    extraUsageResetsAt?: Date | null;
}
/**
 * Categorized error reasons for API usage fetch failures.
 * - 'network': Network error or timeout
 * - 'auth': Authentication failure (token expired, refresh failed)
 * - 'no_credentials': No OAuth credentials available (expected for API key users)
 */
export type UsageErrorReason = 'network' | 'timeout' | 'http' | 'auth' | 'no_credentials' | 'rate_limited';
/**
 * Result of fetching usage data from the API.
 * - rateLimits: The rate limit data (null if no data available)
 * - error: Set when the API call fails (undefined on success or no credentials)
 */
export interface UsageResult {
    rateLimits: RateLimits | null;
    /** Error reason when API call fails (undefined on success or no credentials) */
    error?: UsageErrorReason;
    /** True when serving cached data that may be outdated (429 or lock contention) */
    stale?: boolean;
}
/**
 * Custom rate limit provider configuration.
 * Set hveHud.rateLimitsProvider.type = 'custom' to enable.
 */
export interface RateLimitsProviderConfig {
    type: 'custom';
    /** Shell command string or argv array to execute */
    command: string | string[];
    /** Execution timeout in milliseconds (default: 800) */
    timeoutMs?: number;
    /** Optional bucket IDs to display; shows all buckets when omitted */
    periods?: string[];
    /** Percent usage threshold above which resetsAt is shown (default: 85) */
    resetsAtDisplayThresholdPercent?: number;
}
/** Usage expressed as a 0-100 percent value */
export interface BucketUsagePercent {
    type: 'percent';
    value: number;
}
/** Usage expressed as consumed credits vs. limit */
export interface BucketUsageCredit {
    type: 'credit';
    used: number;
    limit: number;
}
/** Usage expressed as a pre-formatted string (resetsAt always hidden) */
export interface BucketUsageString {
    type: 'string';
    value: string;
}
export type CustomBucketUsage = BucketUsagePercent | BucketUsageCredit | BucketUsageString;
/** A single rate limit bucket returned by the custom provider command */
export interface CustomBucket {
    id: string;
    label: string;
    usage: CustomBucketUsage;
    /** ISO 8601 reset time; only shown when usage crosses resetsAtDisplayThresholdPercent */
    resetsAt?: string;
}
/** The JSON object a custom provider command must print to stdout */
export interface CustomProviderOutput {
    version: 1;
    generatedAt: string;
    buckets: CustomBucket[];
}
/**
 * Result of executing (or loading from cache) the custom rate limit provider.
 * Passed directly to the HUD render context.
 */
export interface CustomProviderResult {
    buckets: CustomBucket[];
    /** True when using the last-known-good cached value after a command failure */
    stale: boolean;
    /** Error message when command failed and no cache is available */
    error?: string;
}
export interface HudRenderContext {
    /** Context window percentage (0-100) */
    contextPercent: number;
    /** Stable display scope for context smoothing (e.g. session/worktree key) */
    contextDisplayScope?: string | null;
    /** Model display name */
    modelName: string;
    /** Working directory */
    cwd: string;
    /** True when the launch base cwd (stdin.cwd) no longer exists on disk */
    cwdMissing?: boolean;
    /** Rate limits result from built-in Anthropic/z.ai providers (includes error state) */
    rateLimitsResult: UsageResult | null;
    /** Custom rate limit buckets from rateLimitsProvider command (null when not configured) */
    customBuckets: CustomProviderResult | null;
}
export type HudPreset = 'default';
/**
 * CWD path format options:
 * - relative: ~/workspace/dotfiles (home-relative)
 * - absolute: /Users/dat/workspace/dotfiles (full path)
 * - folder: dotfiles (folder name only)
 */
export type CwdFormat = 'relative' | 'absolute' | 'folder';
/**
 * Model name format options:
 * - short: 'Opus', 'Sonnet', 'Haiku'
 * - versioned: 'Opus 4.7', 'Sonnet 4.5', 'Haiku 4.5'
 * - full: raw model ID like 'claude-opus-4-7-20260416'
 */
export type ModelFormat = 'short' | 'versioned' | 'full';
export interface HudElementConfig {
    cwd: boolean;
    cwdFormat: CwdFormat;
    useHyperlinks?: boolean;
    gitBranch: boolean;
    model: boolean;
    modelFormat: ModelFormat;
    rateLimits: boolean;
    contextBar: boolean;
    maxOutputLines: number;
    safeMode: boolean;
}
export interface HudThresholds {
    /** Context percentage that triggers warning color (default: 70) */
    contextWarning: number;
    /** Context percentage that triggers compact suggestion (default: 80) */
    contextCompactSuggestion: number;
    /** Context percentage that triggers critical color (default: 85) */
    contextCritical: number;
}
export interface ContextLimitWarningConfig {
    /** Context percentage threshold that triggers the warning banner (default: 80) */
    threshold: number;
    /** Automatically queue /compact when threshold is exceeded (default: false) */
    autoCompact: boolean;
}
/**
 * Layout configuration for HUD element ordering.
 * Each group is an ordered array of element names.
 * Presets control on/off; layout controls order and placement.
 */
export interface LayoutConfig {
    /** Elements on the git/info line (above or below main, per gitInfoPosition) */
    line1?: string[];
    /** Elements on the main statusline */
    main?: string[];
    /** Elements rendered as separate detail lines below the main line */
    detail?: string[];
}
export interface HudConfig {
    preset: HudPreset;
    elements: HudElementConfig;
    thresholds: HudThresholds;
    contextLimitWarning: ContextLimitWarningConfig;
    /** Built-in usage API polling interval / success-cache TTL in milliseconds. */
    usageApiPollIntervalMs: number;
    /** Optional custom rate limit provider; omit to use built-in Anthropic/z.ai */
    rateLimitsProvider?: RateLimitsProviderConfig;
    /** Optional main HUD element ordering convenience setting. */
    elementOrder?: string[];
    /** Optional maximum width (columns) for statusline output. */
    maxWidth?: number;
    /** Controls maxWidth behavior: truncate with ellipsis (default) or wrap at " | " HUD element boundaries. */
    wrapMode?: 'truncate' | 'wrap';
    /** Optional element ordering. Overrides default order when set. Presets still control on/off. */
    layout?: LayoutConfig;
}
export declare const DEFAULT_HUD_USAGE_POLL_INTERVAL_MS: number;
export declare const DEFAULT_HUD_CONFIG: HudConfig;
/**
 * Preset overrides keyed by HudPreset. The default preset intentionally
 * passes an empty override object because `DEFAULT_HUD_CONFIG.elements`
 * already carries the desired defaults.
 */
export declare const PRESET_CONFIGS: Record<HudPreset, Partial<HudElementConfig>>;
