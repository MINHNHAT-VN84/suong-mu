// Supabase Edge Function: admin gửi thông báo đẩy tới tất cả hoặc theo khu vực.
// Deploy: supabase functions deploy send-push
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:ban@example.com
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * r / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Chưa đăng nhập' }, 401);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: prof } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!prof?.is_admin) return json({ error: 'Không có quyền quản trị' }, 403);

  const { title, body, url: link, target } = await req.json();
  if (!title || !body) return json({ error: 'Thiếu tiêu đề hoặc nội dung' }, 400);

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  );

  let subs: any[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await admin.from('push_subscriptions').select('*').range(i, i + 999);
    if (error) return json({ error: error.message }, 500);
    subs.push(...data);
    if (data.length < 1000) break;
  }
  if (target?.type === 'area') {
    subs = subs.filter((s) => s.last_lat != null &&
      km({ lat: s.last_lat, lng: s.last_lng }, { lat: target.lat, lng: target.lng }) <= Number(target.radius_km));
  }

  const payload = JSON.stringify({ title, body, url: link || './' });
  let sent = 0, failed = 0;
  const dead: string[] = [];
  for (let i = 0; i < subs.length; i += 50) {
    await Promise.all(subs.slice(i, i + 50).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (e: any) {
        failed++;
        if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.endpoint);
      }
    }));
  }
  if (dead.length) await admin.from('push_subscriptions').delete().in('endpoint', dead);
  await admin.from('broadcasts').insert({ title, body, url: link, target, sent_by: user.id, sent_count: sent, failed_count: failed });
  return json({ sent, failed });
});
