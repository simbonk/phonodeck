// Forwards an invited guest's Gemini calls to Google with Simon's key, and charges what each call cost to the guest's invite.
// The key lives only in the GEMINI_KEY environment variable; nothing here ever sends it back to a browser.
// POST /api/gemini?p=chat|embed|tts  with the header x-invite: <code>, and the same JSON body the game would send to Google.
import { PRICES, cost, getInvite, summary, redis, monthKey, monthSpend, tooManyBad, noteBad, json } from './_lib.js';

const GOOGLE = () => process.env.GEMINI_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const PATHS = { chat: '/openai/chat/completions', embed: '/openai/embeddings', tts: '/interactions' };
const GRACE = 1.1;   // background calls and the voice may run up to 10% over, so the reply in progress can finish

export async function POST(req) {
  const p = new URL(req.url).searchParams.get('p');
  if (!PATHS[p]) return json({ error: 'not_allowed' }, 404);
  if (!process.env.GEMINI_KEY) return json({ error: 'server_not_set_up', message: 'The invite server has no Gemini key yet.' }, 503);
  if (await tooManyBad(req)) return json({ error: 'slow_down' }, 429);
  const inv = await getInvite(req.headers.get('x-invite'));
  if (!inv) { await noteBad(req); return json({ error: 'invite_invalid' }, 403); }
  const { month, ceiling } = await monthSpend();
  const story = req.headers.get('x-holo-kind') === 'gm';   // a new story turn: refused once the allowance is used; anything else gets a little grace
  const reason = inv.status !== 'active' ? 'paused' : month >= ceiling ? 'ceiling' : inv.spent >= inv.allow * (story ? 1 : GRACE) ? 'used' : '';
  if (reason) return json({ error: 'quota', reason, invite: summary(inv) }, 402);

  let body; try { body = await req.json(); } catch (e) { return json({ error: 'bad_json' }, 400); }
  const model = String(body.model || '').replace(/^models\//, '');
  if (!PRICES[model] || PRICES[model].kind !== p) return json({ error: 'model_not_allowed', message: 'Guests can only use the game\'s own models.' }, 400);
  body.model = model;

  const url = GOOGLE() + PATHS[p], key = process.env.GEMINI_KEY;
  const headers = p === 'tts' ? { 'Content-Type': 'application/json', 'x-goog-api-key': key } : { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key };
  const asked = !!(body.stream_options && body.stream_options.include_usage);
  if (p === 'chat' && body.stream && !asked) body.stream_options = { include_usage: true };   // so streamed replies report their tokens too
  let r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (r.status === 400 && p === 'chat' && body.stream && !asked) { delete body.stream_options; r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) }); }
  const out = { 'Cache-Control': 'no-store', 'Content-Type': r.headers.get('content-type') || 'application/json', 'x-invite-left': String(summary(inv).left), 'x-invite-minutes': String(summary(inv).minutesLeft) };
  if (!r.ok) return new Response(await r.text(), { status: r.status, headers: out });   // Google's own error, not charged

  const inChars = JSON.stringify(p === 'tts' ? body.input : p === 'embed' ? body.input : body.messages).length;
  let seen = 0, tail = '', usage = null; const dec = new TextDecoder();
  const meter = new TransformStream({
    transform(chunk, ctl) {
      seen += chunk.byteLength; ctl.enqueue(chunk);
      if (p === 'chat') {   // watch the stream for the usage report (sent last when streaming, or in the JSON body)
        tail += dec.decode(chunk, { stream: true });
        if (body.stream) { const lines = tail.split('\n'); tail = lines.pop(); lines.forEach(l => { const m = /^data:\s*(\{.*\})\s*$/.exec(l); if (m) try { const o = JSON.parse(m[1]); if (o.usage) usage = o.usage; } catch (e) {} }); }
      } else if (p === 'embed') tail += dec.decode(chunk, { stream: true });
    },
    async flush() {
      if (p === 'chat' && !body.stream) try { usage = JSON.parse(tail).usage; } catch (e) {}
      if (p === 'embed') try { usage = JSON.parse(tail).usage; } catch (e) {}
      let u;
      if (p === 'tts') u = { in: Math.ceil(inChars / 4), audioSec: seen * 0.75 / 48000 };   // base64 of 24 kHz 16-bit mono audio
      else if (usage) { const i = usage.prompt_tokens || 0; u = { in: i, cached: (usage.prompt_tokens_details && usage.prompt_tokens_details.cached_tokens) || 0, out: Math.max(usage.completion_tokens || 0, (usage.total_tokens || 0) - i) }; }
      else u = { in: Math.ceil(inChars / 4), out: p === 'chat' ? Math.ceil(seen / 3) : 0 };   // no report: estimate generously from the text size
      await charge(inv.code, cost(model, u), story);
    }
  });
  return new Response(r.body.pipeThrough(meter), { status: r.status, headers: out });
}

async function charge(code, dollars, story) {
  const now = Date.now(), cmds = [['HINCRBYFLOAT', 'inv:' + code, 'spent', dollars.toFixed(6)], ['HSET', 'inv:' + code, 'last', now],
    ['INCRBYFLOAT', monthKey(), dollars.toFixed(6)], ['EXPIRE', monthKey(), 60 * 60 * 24 * 400], ['INCRBYFLOAT', 'spend:total', dollars.toFixed(6)]];
  if (story) {   // play time: the gaps between story turns, ignoring breaks longer than 10 minutes
    const [t] = await redis(['HGET', 'inv:' + code, 'turnAt']), gap = now - (+t || 0);
    if (gap < 10 * 60 * 1000) cmds.push(['HINCRBY', 'inv:' + code, 'play', Math.round(gap / 1000)]);
    cmds.push(['HSET', 'inv:' + code, 'turnAt', now]);
  }
  await redis(...cmds);
}
