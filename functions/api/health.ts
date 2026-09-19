// functions/api/health.ts
export const onRequestGet: PagesFunction = async ({ env }) => {
  // 探活: hit D1
  let dbOk = false;
  try {
    const r = await (env as unknown as { DB: D1Database }).DB.prepare("SELECT 1 AS x").first<{ x: number }>();
    dbOk = r?.x === 1;
  } catch (e) {
    dbOk = false;
  }
  return new Response(JSON.stringify({ ok: dbOk, ts: Date.now() }), {
    status: dbOk ? 200 : 503,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
