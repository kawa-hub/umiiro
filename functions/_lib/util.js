// Shared helpers for the Umiiro API. This file exports no onRequest handlers, so it is not a route.

export const DEFAULT_SITE = {
  settings: { instagramUrl: "", lineUrl: "", credit: "Shot on Insta360" },
  spots: [
    { id: "kerama", name: "Kerama Islands", short: "Kerama", region: "Okinawa",
      desc: "An island group known for its clear \"Kerama Blue\" water. Sea turtles and coral reefs are a short boat ride from Naha.",
      season: "Year-round (whale watching, Jan–Mar)", lat: 26.19, lon: 127.35, dir: "l", images: [] },
    { id: "miyako", name: "Miyako Island", short: "Miyako", region: "Okinawa",
      desc: "Famous for dramatic terrain such as caves and arches. Tsuriike on Shimoji Island is a well-known site.",
      season: "Year-round (calmer seas in summer)", lat: 24.80, lon: 125.28, dir: "r", images: [] },
    { id: "yonaguni", name: "Yonaguni Island", short: "Yonaguni", region: "Okinawa",
      desc: "Japan's westernmost island, known for winter schools of hammerhead sharks and a vast stepped seafloor formation.",
      season: "Winter (hammerheads around Dec–Apr)", lat: 24.45, lon: 123.00, dir: "b", images: [] },
    { id: "ishigaki", name: "Ishigaki Island", short: "Ishigaki", region: "Okinawa",
      desc: "Best known for manta ray sites such as Kabira Ishizaki, with broad coral reefs and rich marine life.",
      season: "Mainly summer to autumn (a rough guide)", lat: 24.34, lon: 124.16, dir: "b", images: [] },
    { id: "ogasawara", name: "Ogasawara Islands", short: "Ogasawara", region: "Tokyo",
      desc: "A UNESCO World Natural Heritage site about 24 hours by ferry from Tokyo, with dolphins, whales and a unique ecosystem.",
      season: "Humpback whales mainly in winter–spring", lat: 27.09, lon: 142.19, dir: "l", images: [] },
    { id: "izu", name: "Osezaki, Izu", short: "Osezaki", region: "Shizuoka",
      desc: "A classic site on the northwest of the Izu Peninsula. Suruga Bay is rich in life and easy to reach from the Tokyo area.",
      season: "Year-round", lat: 35.03, lon: 138.79, dir: "r", images: [] },
    { id: "kushimoto", name: "Kushimoto", short: "Kushimoto", region: "Wakayama",
      desc: "The southernmost town on Honshu. The Kuroshio supports table coral colonies near the northern limit of reef-building corals.",
      season: "Year-round (warmer from summer to autumn)", lat: 33.47, lon: 135.78, dir: "l", images: [] },
    { id: "kashiwajima", name: "Kashiwajima", short: "Kashiwajima", region: "Kochi",
      desc: "A small island off Shikoku's southwest tip, known for its variety of fish, from tiny critters to big schools.",
      season: "Year-round", lat: 32.77, lon: 132.63, dir: "b", images: [] },
    { id: "shiretoko", name: "Rausu, Shiretoko", short: "Rausu", region: "Hokkaido",
      desc: "A northern sea where clione, the \"sea angel\", appear in the drift-ice season. A cold, clear world far from the southern reefs.",
      season: "Winter (around Jan–Mar)", lat: 44.02, lon: 145.19, dir: "l", images: [] }
  ]
};

/* ---------- Input cleaning ---------- */
const str = (v, max) =>
  String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);

const httpsUrl = (v) => {
  const s = str(v, 300);
  if (!s) return "";
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
};

const clamp = (n, lo, hi, fallback) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback);

export function sanitizeSite(input) {
  const s = (input && input.settings) || {};
  const settings = {
    instagramUrl: httpsUrl(s.instagramUrl),
    lineUrl: httpsUrl(s.lineUrl),
    credit: str(s.credit, 80)
  };
  const seen = new Set();
  const spots = [];
  const list = Array.isArray(input && input.spots) ? input.spots.slice(0, 60) : [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    let base = str(raw.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, "-") || "spot";
    let id = base, n = 2;
    while (seen.has(id)) id = `${base}-${n++}`;
    seen.add(id);
    const imgSeen = new Set();
    const images = (Array.isArray(raw.images) ? raw.images : [])
      .filter((x) => typeof x === "string" && /^[a-f0-9]{16}$/.test(x) && !imgSeen.has(x) && imgSeen.add(x))
      .slice(0, 40);
    spots.push({
      id,
      name: str(raw.name, 80) || "Untitled spot",
      short: str(raw.short, 30) || str(raw.name, 30) || "Spot",
      region: str(raw.region, 60),
      desc: str(raw.desc, 800),
      season: str(raw.season, 120),
      lat: clamp(Number(raw.lat), 24, 46, 36),
      lon: clamp(Number(raw.lon), 122, 146, 138),
      dir: ["l", "r", "b"].includes(raw.dir) ? raw.dir : "r",
      images
    });
  }
  return { settings, spots };
}

/* ---------- Admin session (signed cookie) ---------- */
const enc = new TextEncoder();
const b64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function passwordMatches(env, input) {
  if (!env.ADMIN_PASSWORD) return false;
  return safeEqual(await hmac("umiiro-compare", input), await hmac("umiiro-compare", env.ADMIN_PASSWORD));
}

export async function makeToken(env) {
  const body = String(Date.now() + 7 * 24 * 3600 * 1000);
  return `${body}.${await hmac(env.ADMIN_PASSWORD, "umiiro-session:" + body)}`;
}

async function checkToken(env, token) {
  if (!token || !env.ADMIN_PASSWORD) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig || !(Number(body) > Date.now())) return false;
  return safeEqual(sig, await hmac(env.ADMIN_PASSWORD, "umiiro-session:" + body));
}

function getCookie(request, name) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}

export const isAdmin = (request, env) => checkToken(env, getCookie(request, "umiiro_admin"));

/* Browsers always send Origin on POST/PUT/DELETE. Require it to match this site. */
export function sameOrigin(request) {
  const o = request.headers.get("Origin");
  if (!o) return false;
  try {
    return new URL(o).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}

export function cookieHeader(request, value, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `umiiro_admin=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure}`;
}
