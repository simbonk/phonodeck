// POST /api/admin with the header x-admin-password and a JSON body { action, ... }. Every action re-checks the password.
// Actions: list | create { name, allow, player?, gender? } | add { code, amount } | pause { code } | resume { code } | delete { code } | ceiling { amount }
import { redis, getInvite, summary, newCode, normCode, monthSpend, tooManyBad, noteBad, same, json, DEFAULT_PER_MIN } from './_lib.js';

export async function POST(req) {
  if (!process.env.ADMIN_PASSWORD) return json({ error: 'server_not_set_up', message: 'Set ADMIN_PASSWORD in Vercel, then redeploy.' }, 503);
  if (await tooManyBad(req)) return json({ error: 'slow_down', message: 'Too many wrong tries. Wait an hour.' }, 429);
  if (!same(req.headers.get('x-admin-password'), process.env.ADMIN_PASSWORD)) { await noteBad(req); return json({ error: 'wrong_password' }, 401); }
  let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad_json' }, 400); }
  const money = v => Math.round(Math.max(0, Math.min(500, +v || 0)) * 100) / 100;   // dollars, capped at $500 per change as a typo guard
  const code = normCode(b.code); let made;

  if (b.action === 'create') {
    const name = String(b.name || '').trim().slice(0, 40), allow = money(b.allow);
    if (!name || !allow) return json({ error: 'need_name_and_allowance' }, 400);
    const player = String(b.player || '').trim().slice(0, 60), gender = String(b.gender || '').trim().slice(0, 40);   // optional: the guest's name and gender in the story
    const c = made = newCode(name);
    await redis(['HSET', 'inv:' + c, 'name', name, 'allow', allow, 'spent', 0, 'status', 'active', 'created', Date.now(), 'player', player, 'gender', gender], ['SADD', 'invites', c]);
  } else if (['add', 'pause', 'resume', 'delete'].includes(b.action)) {
    if (!await getInvite(code)) return json({ error: 'no_such_invite' }, 404);
    if (b.action === 'add') await redis(['HINCRBYFLOAT', 'inv:' + code, 'allow', money(b.amount)]);
    if (b.action === 'pause' || b.action === 'resume') await redis(['HSET', 'inv:' + code, 'status', b.action === 'pause' ? 'paused' : 'active']);
    if (b.action === 'delete') await redis(['DEL', 'inv:' + code], ['SREM', 'invites', code]);
  } else if (b.action === 'ceiling') {   // 0 goes back to MONTHLY_CAP (or $30)
    const v = money(b.amount); await redis(v ? ['SET', 'ceiling', v] : ['DEL', 'ceiling']);
  } else if (b.action !== 'list') return json({ error: 'unknown_action' }, 400);

  const [[codes, total], { month, ceiling }] = await Promise.all([redis(['SMEMBERS', 'invites'], ['GET', 'spend:total']), monthSpend()]);
  const invites = (await Promise.all((codes || []).map(getInvite))).filter(Boolean).map(summary).sort((a, b) => b.created - a.created);
  return json({ invites, month: +month.toFixed(2), total: +(+total || 0).toFixed(2), ceiling, perMinute: DEFAULT_PER_MIN, created: made });
}
