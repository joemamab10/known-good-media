// Known Good Media: Stripe → Supabase webhook.
// When a parent finishes paying on a Stripe Payment Link, Stripe calls this function.
// It checks the call really came from Stripe, finds the order by its client_reference_id
// (the portal puts the order id there), and marks the order paid.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   STRIPE_WEBHOOK_SECRET  the "whsec_..." signing secret from the Stripe webhook endpoint
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
// Deploy with "Verify JWT" turned OFF (Stripe can't send a Supabase login token).

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function verify(body: string, header: string | null) {
  if (!header || !WEBHOOK_SECRET) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=", 2)).filter((p) => p.length === 2)
    .map(([k, v]) => [k, v])) as Record<string, string>;
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const t = parts["t"];
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // older than 5 minutes: reject replays
  const expected = await hmacHex(WEBHOOK_SECRET, `${t}.${body}`);
  return sigs.some((s) => safeEqual(s, expected));
}

async function db(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const body = await req.text();
  if (!(await verify(body, req.headers.get("stripe-signature")))) return new Response("bad signature", { status: 400 });

  const event = JSON.parse(body);
  const type = event.type as string;
  if (type !== "checkout.session.completed" && type !== "checkout.session.async_payment_succeeded") {
    return new Response("ignored");
  }
  const s = event.data.object;
  if (s.payment_status !== "paid") return new Response("not paid yet"); // bank payments finish later (async_payment_succeeded)
  const orderId = s.client_reference_id;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return new Response("no order id"); // e.g. a link paid outside the portal

  try {
    const rows = await db(`orders?id=eq.${orderId}&select=id,status,paid,price`);
    if (!rows.length) return new Response("order not found");
    const o = rows[0];
    const amount = (s.amount_total ?? 0) / 100;
    await db(`orders?id=eq.${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({
        paid: true,
        status: o.status === "submitted" ? "paid" : o.status,
        paid_amount: amount,
        stripe_session: s.id,
      }),
    });
    return new Response("marked paid");
  } catch (e) {
    console.error(e);
    return new Response("db error", { status: 500 }); // Stripe retries on 5xx
  }
});
