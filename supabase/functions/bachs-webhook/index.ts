// Bachs Webhook + Email Notifications
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3.2.0";

const SUPA_URL = Deno.env.get("SB_URL")!;
const SUPA_SERVICE_KEY = Deno.env.get("SB_SERVICE_KEY")!;

function planLabel(p) { return p === "elite" ? "Elite ($19.99/mo)" : p === "pro" ? "Pro ($9.99/mo)" : p === "growth" ? "Growth ($4.99/mo)" : p; }

async function sendEmail(email, plan, subject) {
  var key = Deno.env.get("RESEND_API_KEY");
  if (!key) { console.log("[Email] No RESEND_API_KEY — skipping"); return; }
  var resend = new Resend(key);
  var label = planLabel(plan);
  await resend.emails.send({
    from: "Keno Vault <noreply@kenovault.app>",
    to: [email],
    subject: subject || ("Your Keno Vault " + label + " Plan is Active "),
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
      <h2 style="color:#f97316;">⬡ Keno Vault</h2>
      <p>Your <strong>${label}</strong> plan is now active.</p>
      <p>All features are unlocked instantly. <a href="https://keno-vault.vercel.app/pages/dashboard.html">Open your vault</a> to get started.</p>
      <hr style="border-color:#e5e7eb;margin:24px 0;">
      <p style="color:#888;font-size:12px;">Questions? Reply or contact kenovault@gmail.com</p></div>`,
  });
  console.log("[Email] Sent to", email);
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    var body = await req.text();
    var event = JSON.parse(body);
    console.log("[Webhook]", event.type || "unknown");

    // Extract email and plan
    var meta = event.data?.metadata || event.metadata || {};
    var email = meta.user_email || event.data?.customer?.email || event.email || "";
    var plan  = meta.plan || event.plan || "";

    // ── Payment completed → activate + email ──
    if (event.type === "product.purchased" || event.type === "collection.succeeded" || event.type === "admin_activate") {
      if (!email || !plan) { console.log("[Webhook] Skipping — no email/plan"); return new Response(JSON.stringify({ received: true }), { status: 200 }); }
      var sb = createClient(SUPA_URL, SUPA_SERVICE_KEY);
      var { error } = await sb.from("subscriptions").upsert({ email, plan, status: "active", provider: "bachs", updated_at: new Date().toISOString() }, { onConflict: "email" });
      if (error) { console.error("[Webhook] DB error:", error.message); return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
      console.log("[Webhook] Activated", plan, "for", email);
      await sendEmail(email, plan);
      return new Response(JSON.stringify({ received: true, activated: true }), { status: 200 });
    }

    // ── Refund → deactivate ──
    if (event.type === "refund.paid") {
      if (email) {
        var sb2 = createClient(SUPA_URL, SUPA_SERVICE_KEY);
        await sb2.from("subscriptions").update({ plan: "free", status: "inactive", updated_at: new Date().toISOString() }).eq("email", email);
        console.log("[Webhook] Deactivated", email, "due to refund");
      }
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    // ── Admin downgrade → notify ──
    if (event.type === "admin_downgrade") {
      if (email) {
        var sb3 = createClient(SUPA_URL, SUPA_SERVICE_KEY);
        await sb3.from("subscriptions").update({ plan: "free", status: "inactive", updated_at: new Date().toISOString() }).eq("email", email);
        await sendEmail(email, "free", "Your Keno Vault plan has been changed");
        console.log("[Webhook] Downgraded", email);
      }
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    console.log("[Webhook] Ignored:", event.type);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (e) {
    console.error("[Webhook] Error:", e.message || e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
