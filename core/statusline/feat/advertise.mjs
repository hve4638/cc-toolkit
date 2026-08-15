/**
 * advertise — a rotating one-line skill ad from plugins that opt in with an
 * `.advertisable` marker. Turned on by `feat:advertise` in the agentaddon
 * statusline namespace; `@lang=ko` picks the ad language.
 *
 * The line sits under whatever else is on screen, so the band is low.
 */

import { getNextAd } from '../lib/advertise/queue.mjs';
import { renderAdLine } from '../lib/advertise/render.mjs';

export const priority = 'low';

export function render(context, args) {
  const ad = getNextAd();
  if (!ad) return null;
  return renderAdLine(ad, typeof args.lang === 'string' ? args.lang : 'en');
}
