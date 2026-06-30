// Bachs Webhook Handler — Auto-activate subscriptions
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("BACHS_WEBHOOK_SECRET") || "";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = await req.text();
    const event = JSON.parse(body);
    console.log("[Webhook] Event:", event.type, event.id);

    // Only handle completed payments
    if (event.type !== "payment.completed") {
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    const email = event.data?.metadata?.user_email || event.data?.customer_email;
    const plan  = event.data?.metadata?.plan;
    if (!email || !plan) {
      console.error("[Webhook] Missing email or plan in event");
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    // Activate subscription in Supabase
    const sb = createClient(SUPA_URL, SUPA_SERVICE_KEY);

    const { error } = await sb.from("subscriptions").upsert({
      email: email,
      plan: plan,
      status: "active",
      provider: "bachs",
      updated_at: new Date().toISOString(),
    }, { onConflict: "email" });

    if (error) {
      console.error("[Webhook] DB upsert failed:", error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    console.log("[Webhook] Activated", plan, "for", email);
    return new Response(JSON.stringify({ received: true, activated: true }), { status: 200 });
  } catch (e) {
    console.error("[Webhook] Error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
