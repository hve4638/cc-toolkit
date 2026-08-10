/**
 * hud — reading the statusline payload.
 *
 * Claude Code hands the statusline a JSON snapshot of the session on stdin.
 * Everything the hud line shows comes from it; nothing here touches the network
 * or the API.
 */

/** Context window usage as a whole percent, 0 when the payload carries none. */
export function contextPercentOf(stdin) {
  const native = stdin?.context_window?.used_percentage;
  if (typeof native === 'number' && !Number.isNaN(native)) {
    return Math.min(100, Math.max(0, Math.round(native)));
  }

  const size = stdin?.context_window?.context_window_size;
  if (!size || size <= 0) return 0;
  const usage = stdin.context_window.current_usage;
  const tokens = (usage?.input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0);
  return Math.min(100, Math.round((tokens / size) * 100));
}

function clampPercent(value) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * Reset times arrive as epoch seconds, epoch milliseconds, or an ISO string.
 * Values under 1e12 are too small to be milliseconds, so they are seconds.
 */
function parseResetDate(value) {
  if (value == null) return null;

  const numeric = typeof value === 'number'
    ? value
    : (typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN);
  if (Number.isFinite(numeric)) {
    const date = new Date(Math.abs(numeric) < 1e12 ? numeric * 1000 : numeric);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * The 5-hour and weekly quota buckets, or null when the payload has neither.
 * Claude Code omits `rate_limits` for sessions the plan quota does not cover
 * (API key, Bedrock, Vertex) and before the session's first response.
 */
export function rateLimitsOf(stdin) {
  const fiveHour = stdin?.rate_limits?.five_hour?.used_percentage;
  const sevenDay = stdin?.rate_limits?.seven_day?.used_percentage;
  if (fiveHour == null && sevenDay == null) return null;

  return {
    fiveHourPercent: clampPercent(fiveHour),
    weeklyPercent: sevenDay == null ? undefined : clampPercent(sevenDay),
    fiveHourResetsAt: parseResetDate(stdin.rate_limits?.five_hour?.resets_at),
    weeklyResetsAt: parseResetDate(stdin.rate_limits?.seven_day?.resets_at),
  };
}

/** The model's display name, falling back to its raw id. */
export function modelNameOf(stdin) {
  return stdin?.model?.display_name ?? stdin?.model?.id ?? null;
}
