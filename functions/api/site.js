import { DEFAULT_SITE, sanitizeSite, isAdmin, json, sameOrigin } from "../_lib/util.js";

// Public: the site content (settings + spots).
export async function onRequestGet({ env }) {
  const data = await env.UMIIRO.get("site", "json");
  return json(data || DEFAULT_SITE, 200, { "Cache-Control": "public, max-age=30" });
}

// Admin only: replace the site content.
export async function onRequestPut({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Bad origin" }, 403);
  if (!(await isAdmin(request, env))) return json({ error: "Not signed in" }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const next = sanitizeSite(body);
  const prev = (await env.UMIIRO.get("site", "json")) || DEFAULT_SITE;
  await env.UMIIRO.put("site", JSON.stringify(next));

  // Remove photos that no spot uses any more.
  const keep = new Set(next.spots.flatMap((s) => s.images));
  const gone = prev.spots.flatMap((s) => s.images || []).filter((id) => !keep.has(id));
  await Promise.all(gone.map((id) => env.UMIIRO.delete("img:" + id)));

  return json({ ok: true, site: next });
}
