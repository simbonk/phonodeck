// Shared code for the invite server: Redis storage, Google's prices, invite lookups.
// Files starting with "_" are not routes on Vercel.

// Google's paid-tier prices, USD per 1M tokens (ai.google.dev/gemini-api/docs/pricing, checked Oct 8, 2026).
// These models are also the only ones guests can use. "from2027" prices apply from Jan 1, 2027.
export const PRICES = {
  'gemini-3.1-pro-preview': { kind: 'chat', in: 2, out: 12, inLong: 4, outLong: 18 },   // "Long" = prompts over 200k tokens
  'gemini-3.8-flash': { kind: 'chat', in: 0.75, out: 3.75, from2027: { in: 1.5, out: 7.5 } },
  'gemini-3.1-flash-lite': { kind: 'chat', in: 0.25, out: 1.5 },
  'gemini-3.8-flash-lite-tts': { kind: 'tts', in: 0.5, audio: 6, from2027: { in: 1, audio: 12 } },
  'gemini-3.8-flash-tts': { kind: 'tts', in: 0.5, audio: 9, from2027: { in: 1, audio: 18 } },
  'gemini-embedding-2-preview': { kind: 'embed', in: 0.2 },   // not confirmed on Google's page; embeddings are a tiny share of the cost
};
const CACHED = 0.1;            // input served from Google's cache costs a tenth of the input price
const AUDIO_TOK_PER_SEC = 25;
export const DEFAULT_PER_MIN = 0.10;   // dollars per minute of play, until a guest has played long enough to measure their own

export function price(model, now = Date.now()) {
  const p = PRICES[model]; if (!p) return null;
  return now >= Date.UTC(2027, 0, 1) && p.from2027 ? Object.assign({}, p, p.from2027) : p;
}
// Dollars for one call. u: { in, cached, out, audioSec }
export function cost(model, u) {
  const p = price(model); if (!p) return 0;
  const long = p.inLong && u.in > 200000, pin = long ? p.inLong : p.in, pout = long ? p.outLong : (p.out || 0);
  const cached = Math.min(u.cached || 0, u.in || 0);
  return (((u.in || 0) - cached) * pin + cached * pin * CACHED + (u.out || 0) * pout + (u.audioSec || 0) * AUDIO_TOK_PER_SEC * (p.audio || 0)) / 1e6;
}

// ---------------- Redis (Upstash REST API, added from Vercel's storage marketplace) ----------------
// Vercel names the variables KV_REST_API_URL and KV_REST_API_TOKEN, with any custom prefix chosen when the database was connected.
const envEnding = (...ends) => { const k = Object.keys(process.env).sort((a, b) => a.length - b.length).find(n => ends.some(e => n.endsWith(e))); return k && process.env[k]; };
const RURL = () => envEnding('KV_REST_API_URL', 'REDIS_REST_URL');
const RTOK = () => envEnding('KV_REST_API_TOKEN', 'REDIS_REST_TOKEN');   // never the READ_ONLY token
export async function redis(...cmds) {   // one or more commands, as arrays; returns their results in order
  if (!RURL() || !RTOK()) throw new Error('storage is not set up');
  const r = await fetch(RURL() + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + RTOK(), 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
  if (!r.ok) throw new Error('storage HTTP ' + r.status);
  return (await r.json()).map(x => { if (x.error) throw new Error('storage: ' + x.error); return x.result; });
}
const hash = arr => { const o = {}; for (let i = 0; arr && i < arr.length; i += 2) o[arr[i]] = arr[i + 1]; return o; };

export const monthKey = () => 'spend:' + new Date().toISOString().slice(0, 7);
// The monthly ceiling: set from the admin page (stored as "ceiling"), else MONTHLY_CAP, else $30.
export async function monthSpend() {
  const [m, c] = await redis(['GET', monthKey()], ['GET', 'ceiling']);
  return { month: +m || 0, ceiling: +c || +process.env.MONTHLY_CAP || 30 };
}
export const normCode = c => String(c || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);

export async function getInvite(code) {
  code = normCode(code); if (!code) return null;
  const [h] = await redis(['HGETALL', 'inv:' + code]); const o = hash(h);
  if (!o.name) return null;
  return { code, name: o.name, allow: +o.allow || 0, spent: +o.spent || 0, status: o.status || 'active', created: +o.created || 0, last: +o.last || 0, play: +o.play || 0, turnAt: +o.turnAt || 0 };
}
export function summary(inv) {   // what a guest (or the admin page) sees
  const left = Math.max(0, inv.allow - inv.spent), perMin = inv.play >= 300 && inv.spent > 0 ? inv.spent / (inv.play / 60) : DEFAULT_PER_MIN;
  return { name: inv.name, code: inv.code, allow: inv.allow, spent: +inv.spent.toFixed(4), left: +left.toFixed(4), minutesLeft: Math.floor(left / perMin), minutesPlayed: Math.round(inv.play / 60), status: inv.status, created: inv.created, last: inv.last };
}

// Slows down anyone guessing codes or the admin password: 30 wrong tries an hour per address.
const ipOf = req => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
export async function tooManyBad(req) { const [n] = await redis(['GET', 'bad:' + ipOf(req)]); return +n >= 30; }
export async function noteBad(req) { await redis(['INCR', 'bad:' + ipOf(req)], ['EXPIRE', 'bad:' + ipOf(req), 3600]); }

export const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers) });

// Constant-time comparison for the admin password.
export function same(a, b) {
  a = String(a || ''); b = String(b || ''); let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0 && a.length > 0;
}

// Random, unguessable codes: up to 4 letters of the name, then 10 characters (about 49 bits).
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newCode(name) {
  const pre = String(name || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'GUEST', r = crypto.getRandomValues(new Uint8Array(10));
  return pre + '-' + [...r].map(x => ALPHA[x % ALPHA.length]).join('');
}
