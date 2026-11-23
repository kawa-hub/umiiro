import { passwordMatches, makeToken, cookieHeader, json, sameOrigin } from "../_lib/util.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Bad origin" }, 403);
  if (!env.ADMIN_PASSWORD) return json({ error: "ADMIN_PASSWORD is not set on the server." }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!(await passwordMatches(env, String(body.password || "")))) {
    await new Promise((r) => setTimeout(r, 600));
    return json({ error: "Wrong password" }, 401);
  }
  const token = await makeToken(env);
  return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(request, token, 7 * 24 * 3600) });
}

// Log out
export async function onRequestDelete({ request }) {
  if (!sameOrigin(request)) return json({ error: "Bad origin" }, 403);
  return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(request, "", 0) });
}
