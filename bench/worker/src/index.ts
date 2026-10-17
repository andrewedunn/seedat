// ABOUTME: Benchmark Worker that renders an address-page payload from D1 and reports server-side timing.
// ABOUTME: Routes: /p/<geopin> (parcel page), /a?q=<address> (address lookup then page), /random (random geopin).

interface Env { DB: D1Database }

async function page(env: Env, geopin: number) {
  const t0 = Date.now();
  const [parcel, permits, cases, strs, blocks] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM parcel WHERE geopin = ?").bind(geopin),
    env.DB.prepare("SELECT permit_num, type, description, status, applied_date, issued_date, est_cost, contractor FROM permit WHERE geopin = ? ORDER BY applied_date DESC LIMIT 100").bind(geopin),
    env.DB.prepare("SELECT case_no, status, filed_date FROM code_case WHERE geopin = ? ORDER BY filed_date DESC LIMIT 100").bind(geopin),
    env.DB.prepare("SELECT address, status, license_type FROM str_license WHERE geopin = ? LIMIT 50").bind(geopin),
    env.DB.prepare("SELECT kind, month, n FROM block_activity WHERE geopin = ? ORDER BY month").bind(geopin),
  ]);
  return {
    d1_ms: Date.now() - t0,
    parcel: parcel.results[0] ?? null,
    permits: permits.results, cases: cases.results, strs: strs.results, blocks: blocks.results,
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const t0 = Date.now();
    let body: unknown;
    if (url.pathname.startsWith("/p/")) {
      body = await page(env, Number(url.pathname.slice(3)));
    } else if (url.pathname === "/a") {
      const key = (url.searchParams.get("q") ?? "").toUpperCase().replace(/\s+/g, " ").trim();
      const hit = await env.DB.prepare("SELECT geopin FROM address WHERE addr_key = ? LIMIT 1").bind(key).first<{ geopin: number }>();
      body = hit ? await page(env, hit.geopin) : { error: "not found" };
    } else if (url.pathname === "/random") {
      const hit = await env.DB.prepare("SELECT geopin FROM parcel WHERE rowid = abs(random()) % (SELECT max(rowid) FROM parcel) + 1").first<{ geopin: number }>();
      body = hit ? await page(env, hit.geopin) : { error: "none" };
    } else {
      return new Response("seedat bench", { status: 200 });
    }
    return Response.json(body, { headers: { "server-timing": `total;dur=${Date.now() - t0}` } });
  },
};
