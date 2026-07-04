// Keno Vault — Email Notification Dispatcher
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";

const TEMPLATES: Record<string, (data: any) => { subject: string; html: string }> = {

  // ── Welcome (new signup) ──────────────────────────────────────
  welcome: (d) => ({
    subject: "Welcome to Keno Vault — let's build your net worth",
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0a0a0b;color:#e4e4e7;border-radius:12px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#f97316;font-size:28px;margin:0 0 8px;letter-spacing:-0.02em;">⬡ Keno Vault</h1>
          <p style="color:#71717a;font-size:14px;margin:0;">Your personal net worth command centre</p>
        </div>
        <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:24px;margin-bottom:24px;">
          <h2 style="color:#fafafa;font-size:18px;margin:0 0 12px;">Hey ${d.name || 'there'}, welcome aboard 👋</h2>
          <p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 16px;">You just took the first step toward total financial clarity. Keno Vault lets you track every asset, simulate FIRE, optimise your portfolio, and watch your net worth grow — all in one place.</p>
          <p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0;">Start by adding your first asset — cash, investments, property, whatever you've got. The dashboard comes alive once you feed it data.</p>
        </div>
        <div style="text-align:center;">
          <a href="https://keno-vault.vercel.app/pages/dashboard.html" style="display:inline-block;background:#f97316;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">Open Your Vault →</a>
        </div>
        <hr style="border-color:#27272a;margin:32px 0 20px;">
        <p style="color:#52525b;font-size:11px;text-align:center;margin:0;">Keno Vault • <a href="https://keno-vault.vercel.app#privacy" style="color:#71717a;">Privacy</a> • <a href="https://keno-vault.vercel.app#terms" style="color:#71717a;">Terms</a></p>
      </div>`
  }),

  // ── Login alert (new device / IP) ─────────────────────────────
  login_alert: (d) => ({
    subject: "🔐 New sign-in to your Keno Vault",
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0a0a0b;color:#e4e4e7;border-radius:12px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#f97316;font-size:28px;margin:0 0 8px;letter-spacing:-0.02em;">⬡ Keno Vault</h1>
          <p style="color:#71717a;font-size:14px;margin:0;">Security notification</p>
        </div>
        <div style="background:#18181b;border:1px solid #f97316;border-radius:8px;padding:24px;margin-bottom:24px;">
          <h2 style="color:#f97316;font-size:18px;margin:0 0 16px;">⚠️ New sign-in detected</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;color:#a1a1aa;">
            <tr><td style="padding:6px 12px 6px 0;color:#71717a;">Time</td><td style="padding:6px 0;color:#e4e4e7;">${d.timestamp || 'Just now'}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#71717a;">Browser</td><td style="padding:6px 0;color:#e4e4e7;">${d.browser || 'Unknown'}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#71717a;">OS</td><td style="padding:6px 0;color:#e4e4e7;">${d.os || 'Unknown'}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#71717a;">IP</td><td style="padding:6px 0;color:#e4e4e7;">${d.ip || 'Unknown'}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#71717a;">Country</td><td style="padding:6px 0;color:#e4e4e7;">${d.country || 'Unknown'}</td></tr>
          </table>
        </div>
        <p style="color:#a1a1aa;font-size:13px;line-height:1.6;margin:0 0 8px;">If this was you, no action needed — your vault is safe.</p>
        <p style="color:#ef4444;font-size:13px;line-height:1.6;margin:0;">If this wasn't you, <strong>change your password immediately</strong> and contact <a href="mailto:kenovault@gmail.com" style="color:#ef4444;">kenovault@gmail.com</a>.</p>
        <hr style="border-color:#27272a;margin:32px 0 20px;">
        <p style="color:#52525b;font-size:11px;text-align:center;margin:0;">Keno Vault Security • This is an automated alert</p>
      </div>`
  }),

  // ── Security alert (PIN change, password reset, etc.) ─────────
  security_alert: (d) => ({
    subject: "🔒 Security setting changed on your Keno Vault",
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0a0a0b;color:#e4e4e7;border-radius:12px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#f97316;font-size:28px;margin:0 0 8px;letter-spacing:-0.02em;">⬡ Keno Vault</h1>
          <p style="color:#71717a;font-size:14px;margin:0;">Security notification</p>
        </div>
        <div style="background:#18181b;border:1px solid #f97316;border-radius:8px;padding:24px;margin-bottom:24px;">
          <h2 style="color:#f97316;font-size:18px;margin:0 0 16px;">🔐 Security Change</h2>
          <p style="color:#e4e4e7;font-size:15px;margin:0 0 16px;"><strong>${d.change_description || 'A security setting was changed'}</strong></p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;color:#a1a1aa;">
            <tr><td style="padding:6px 12px 6px 0;color:#71717a;">Time</td><td style="padding:6px 0;color:#e4e4e7;">${d.timestamp || 'Just now'}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#71717a;">Browser</td><td style="padding:6px 0;color:#e4e4e7;">${d.browser || 'Unknown'}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#71717a;">IP</td><td style="padding:6px 0;color:#e4e4e7;">${d.ip || 'Unknown'}</td></tr>
          </table>
        </div>
        <p style="color:#ef4444;font-size:13px;line-height:1.6;margin:0;">If you did not make this change, <strong>secure your account immediately</strong> and contact <a href="mailto:kenovault@gmail.com" style="color:#ef4444;">kenovault@gmail.com</a>.</p>
        <hr style="border-color:#27272a;margin:32px 0 20px;">
        <p style="color:#52525b;font-size:11px;text-align:center;margin:0;">Keno Vault Security • This is an automated alert</p>
      </div>`
  }),

  // ── Weekly/Monthly digest ─────────────────────────────────────
  digest: (d) => ({
    subject: `📊 Your Keno Vault ${d.period || 'Weekly'} Digest`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0a0a0b;color:#e4e4e7;border-radius:12px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#f97316;font-size:28px;margin:0 0 8px;letter-spacing:-0.02em;">⬡ Keno Vault</h1>
          <p style="color:#71717a;font-size:14px;margin:0;">${d.period || 'Weekly'} Digest • ${d.date_range || ''}</p>
        </div>
        <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:24px;margin-bottom:16px;">
          <h2 style="color:#fafafa;font-size:16px;margin:0 0 16px;">Net Worth: <span style="color:#22c55e;">${d.net_worth || '—'}</span></h2>
          <p style="color:#a1a1aa;font-size:13px;line-height:1.6;margin:0;">Change: <span style="color:${(d.change || '').startsWith('-') ? '#ef4444' : '#22c55e'};">${d.change || '—'}</span></p>
          <p style="color:#a1a1aa;font-size:13px;line-height:1.6;margin:4px 0 0;">Assets tracked: ${d.asset_count || 0}</p>
        </div>
        ${d.goal_progress ? `
        <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:24px;margin-bottom:16px;">
          <h2 style="color:#fafafa;font-size:16px;margin:0 0 12px;">🎯 Goal Progress</h2>
          <p style="color:#a1a1aa;font-size:13px;line-height:1.6;margin:0;">${d.goal_progress}</p>
        </div>` : ''}
        <div style="text-align:center;margin-top:24px;">
          <a href="https://keno-vault.vercel.app/pages/dashboard.html" style="display:inline-block;background:#f97316;color:#fff;padding:10px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">View Full Dashboard →</a>
        </div>
        <hr style="border-color:#27272a;margin:32px 0 20px;">
        <p style="color:#52525b;font-size:11px;text-align:center;margin:0;">You're receiving this because you enabled ${d.period?.toLowerCase() || 'weekly'} digests in <a href="https://keno-vault.vercel.app/pages/settings.html" style="color:#71717a;">Settings</a>. <a href="https://keno-vault.vercel.app/pages/settings.html" style="color:#71717a;">Unsubscribe</a> anytime.</p>
      </div>`
  }),
};

// ── Main handler ──────────────────────────────────────────────────
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders(),
    });
  }

  try {
    const body = await req.json();
    const { type, email, data } = body;

    if (!type || !email) {
      return new Response(JSON.stringify({ error: "Missing type or email" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const template = TEMPLATES[type];
    if (!template) {
      return new Response(JSON.stringify({ error: `Unknown type: ${type}`, valid: Object.keys(TEMPLATES) }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) {
      console.log("[Notify] No RESEND_API_KEY — skipping");
      return new Response(JSON.stringify({ sent: false, reason: "No API key configured" }), {
        status: 200,
        headers: corsHeaders(),
      });
    }

    const resend = new Resend(key);
    const { subject, html } = template(data || {});

    const result = await resend.emails.send({
      from: "Keno Vault <noreply@kenovault.app>",
      to: [email],
      subject,
      html,
    });

    console.log(`[Notify] Sent "${type}" to ${email} — ${result.id || 'ok'}`);
    return new Response(JSON.stringify({ sent: true, id: result.id }), {
      status: 200,
      headers: corsHeaders(),
    });

  } catch (e: any) {
    console.error("[Notify] Error:", e.message || e);
    return new Response(JSON.stringify({ error: "Internal error", detail: e.message }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
});

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
