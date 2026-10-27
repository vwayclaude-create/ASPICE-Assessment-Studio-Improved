// Vercel Serverless Function — QA Audit AI criteria draft.
import { jwtVerify } from "jose";
import { handleQaDraft } from "./_qaDraftService.js";

const jwtSecret = process.env.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
  : null;

async function verify(req) {
  if (!jwtSecret) return { ok: true, skipped: true };
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || !header.startsWith("Bearer ")) return { ok: false };
  try {
    await jwtVerify(header.slice(7).trim(), jwtSecret);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await verify(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized. Sign in required." });

  try {
    const out = await handleQaDraft(req.body || {}, process.env);
    return res.status(200).json(out);
  } catch (e) {
    if (e?.code === "BAD_REQUEST") return res.status(400).json({ error: "Bad request", detail: e.message });
    return res.status(502).json({ error: "QA draft generation failed", detail: String(e?.message || e) });
  }
}
