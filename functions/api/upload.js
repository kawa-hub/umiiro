import { isAdmin, json, sameOrigin } from "../_lib/util.js";

const TYPES = { "image/jpeg": true, "image/png": true, "image/webp": true };
const MAX_BYTES = 5 * 1024 * 1024;

// Admin only: store one image (raw bytes in the body) and return its id.
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Bad origin" }, 403);
  if (!(await isAdmin(request, env))) return json({ error: "Not signed in" }, 401);

  const type = (request.headers.get("Content-Type") || "").split(";")[0].trim();
  if (!TYPES[type]) return json({ error: "Use JPEG, PNG or WebP." }, 415);

  const buf = await request.arrayBuffer();
  if (buf.byteLength === 0) return json({ error: "Empty file" }, 400);
  if (buf.byteLength > MAX_BYTES) return json({ error: "Image is larger than 5 MB." }, 413);

  const id = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await env.UMIIRO.put("img:" + id, buf, { metadata: { type } });
  return json({ ok: true, id });
}
