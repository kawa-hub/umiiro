// Public: serve a stored photo. Ids are random and never reused, so they can be cached for a year.
export async function onRequestGet({ params, env }) {
  const id = String(params.id || "");
  if (!/^[a-f0-9]{16}$/.test(id)) return new Response("Not found", { status: 404 });

  const { value, metadata } = await env.UMIIRO.getWithMetadata("img:" + id, { type: "arrayBuffer" });
  if (!value) return new Response("Not found", { status: 404 });

  return new Response(value, {
    headers: {
      "Content-Type": (metadata && metadata.type) || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
