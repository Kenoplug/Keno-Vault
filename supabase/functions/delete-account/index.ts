// Keno Vault — Delete Account Edge Function
// Deletes the Supabase Auth user via the Auth Admin REST API
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const SUPA_URL = Deno.env.get("SB_URL")!;
// SB_SERVICE_KEY might be a restricted key — try the official SUPABASE_ prefixed one too
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
                 || Deno.env.get("SB_SERVICE_KEY")
                 || "";

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: corsHeaders(),
    });
  }

  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ deleted: false, error: "Missing user_id" }), {
        status: 400, headers: corsHeaders(),
      });
    }

    console.log("[Delete] Attempting to delete user:", user_id);

    // Use the Auth Admin REST API directly
    const resp = await fetch(`${SUPA_URL}/auth/v1/admin/users/${user_id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "apikey": SERVICE_KEY,
      },
    });

    const body = await resp.text();
    console.log("[Delete] Response:", resp.status, body);

    if (!resp.ok) {
      return new Response(JSON.stringify({ deleted: false, error: body || `HTTP ${resp.status}` }), {
        status: resp.status, headers: corsHeaders(),
      });
    }

    console.log("[Delete] User deleted successfully:", user_id);
    return new Response(JSON.stringify({ deleted: true }), {
      status: 200, headers: corsHeaders(),
    });

  } catch (e: any) {
    console.error("[Delete] Error:", e.message || e);
    return new Response(JSON.stringify({ deleted: false, error: e.message || "Internal error" }), {
      status: 500, headers: corsHeaders(),
    });
  }
});
