// Create Bachs Checkout Session — Edge Function
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const BACHS_KEY = Deno.env.get("BACHS_SECRET_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://keno-vault.vercel.app";
const isSandbox = BACHS_KEY.startsWith("sk_sandbox_");
const BACHS_BASE = isSandbox ? "https://sandbox-api.bachs.io" : "https://api.bachs.io";

const PRODUCTS = {
  growth: "prod_d79e7052c12148dda083",
  pro:    "prod_69e69d4fb0c7439d88b3",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }
  try {
    const { email, plan } = await req.json();
    const productId = PRODUCTS[plan];
    if (!email || !productId) return new Response(JSON.stringify({ error: "Missing email or invalid plan" }), { status: 400 });
    console.log("[Checkout]", plan, "for", email, "sandbox:", isSandbox);
    const bachsResp = await fetch(BACHS_BASE + "/v1/checkout-sessions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + BACHS_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email: email },
        return_url: SITE_URL + "/pages/dashboard.html?checkout=success",
        cancel_url: SITE_URL + "/pages/dashboard.html?checkout=cancelled",
        metadata: { plan: plan, user_email: email },
      }),
    });
    const data = await bachsResp.json();
    console.log("[Checkout] Status:", bachsResp.status, JSON.stringify(data).slice(0,200));
    if (!bachsResp.ok) {
      return new Response(JSON.stringify({ error: "Payment service error", bachs: data }), { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    return new Response(JSON.stringify({ url: data.checkout_url }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (e) {
    console.error("[Checkout] Exception:", e.message || e);
    return new Response(JSON.stringify({ error: "Internal error", detail: e.message || String(e) }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
});
