// Bachs Webhook Handler
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPA_URL = Deno.env.get("SB_URL")!;
const SUPA_SERVICE_KEY = Deno.env.get("SB_SERVICE_KEY")!;

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = await req.text();
    const event = JSON.parse(body);
    console.log("[Webhook]", event.type || "unknown");

    // Extract customer email and plan from any nested location
    const meta = event.data?.metadata || event.metadata || {};
    const email = meta.user_email || event.data?.customer?.email || event.data?.customer_email || "";
    const plan  = meta.plan || "";

    if (event.type === "product.purchased" || event.type === "collection.succeeded") {
      if (!email || !plan) {
        console.log("[Webhook] Skipping — no email/plan in payload");
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }
      const sb = createClient(SUPA_URL, SUPA_SERVICE_KEY);
      const { error } = await sb.from("subscriptions").upsert({
        email, plan, status: "active", provider: "bachs",
        updated_at: new Date().toISOString(),
      }, { onConflict: "email" });
      if (error) { console.error("[Webhook] Error:", error.message); return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
      console.log("[Webhook] Activated", plan, "for", email);
      return new Response(JSON.stringify({ received: true, activated: true }), { status: 200 });
    }

    if (event.type === "refund.paid") {
      if (email) {
        const sb = createClient(SUPA_URL, SUPA_SERVICE_KEY);
        await sb.from("subscriptions").update({ plan: "free", status: "inactive", updated_at: new Date().toISOString() }).eq("email", email);
        console.log("[Webhook] Deactivated", email, "due to refund");
      }
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    console.log("[Webhook] Ignored event type:", event.type);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (e) {
    console.error("[Webhook] Error:", e.message || e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
