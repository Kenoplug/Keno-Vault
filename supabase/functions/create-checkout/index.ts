// Create Bachs Checkout Session — Edge Function
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const BACHS_KEY = Deno.env.get("BACHS_SECRET_KEY")!;
const BACHS_BASE = Deno.env.get("BACHS_BASE_URL") || "https://api.bachs.io";
const SITE_URL = Deno.env.get("SITE_URL") || "https://keno-vault.vercel.app";

const PLANS = {
  growth: { amount: 199, currency: "usd", label: "Growth" },
  pro:    { amount: 399, currency: "usd", label: "Pro" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }
  try {
    const { email, plan } = await req.json();
    if (!email || !PLANS[plan]) return new Response(JSON.stringify({ error: "Missing email or invalid plan" }), { status: 400 });
    const p = PLANS[plan];
    const bachsResp = await fetch(BACHS_BASE + "/v1/checkouts", {
      method: "POST",
      headers: { "Authorization": "Bearer " + BACHS_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        pricing: { amount: p.amount, currency: p.currency },
        customer_email: email,
        success_url: SITE_URL + "/pages/dashboard.html?checkout=success",
        cancel_url: SITE_URL + "/pages/dashboard.html?checkout=cancelled",
        metadata: { plan: plan, user_email: email },
      }),
    });
    const data = await bachsResp.json();
    if (!bachsResp.ok) return new Response(JSON.stringify({ error: "Payment service error" }), { status: 502 });
    return new Response(JSON.stringify({ url: data.checkout_url }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
