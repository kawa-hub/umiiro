import { isAdmin, json } from "../_lib/util.js";

export async function onRequestGet({ request, env }) {
  return json({ admin: await isAdmin(request, env) });
}
