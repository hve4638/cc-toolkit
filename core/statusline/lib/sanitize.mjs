/**
 * Output sanitizing for terminals that garble the full escape repertoire.
 *
 * Claude Code redraws the screen while the statusline sits in it, and cursor
 * movement or erase sequences coming from a producer land in the middle of that
 * redraw. Color and style (SGR) survive; everything else that steers the
 * terminal is stripped, and the block characters progress bars are drawn with
 * become ASCII so a terminal that measures them differently cannot shift the
 * line.
 */

// CSI sequences that are not SGR: SGR ends in `m` and is kept, so the class
// below covers every other final byte (cursor moves, erases, `?25l`-style
// private sequences).
const CSI_NON_SGR = /\x1b\[\??[0-9;]*[A-LN-Za-ln-z]/g;
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const SIMPLE_ESC = /\x1b[^[\]]/g;

export function sanitize(text) {
  return text
    .replace(CSI_NON_SGR, '')
    .replace(OSC, '')
    .replace(SIMPLE_ESC, '')
    .replace(/█/g, '#')
    .replace(/▓/g, '=')
    .replace(/[░▒]/g, '-')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}
