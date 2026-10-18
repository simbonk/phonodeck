// GET /api/invite?code=<code>: what a guest has left, for the welcome screen and the minutes-left line.
import { getInvite, summary, monthSpend, tooManyBad, noteBad, json } from './_lib.js';

export async function GET(req) {
  if (await tooManyBad(req)) return json({ error: 'slow_down' }, 429);
  const inv = await getInvite(new URL(req.url).searchParams.get('code'));
  if (!inv) { await noteBad(req); return json({ error: 'invite_invalid' }, 403); }
  const s = summary(inv), { month, ceiling } = await monthSpend();
  return json({ name: s.name, left: s.left, minutesLeft: s.minutesLeft, status: s.status, ceiling: month >= ceiling });   // ceiling: every guest is stopped for the month
}
