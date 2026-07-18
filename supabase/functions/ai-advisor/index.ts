// Keno Vault — AI Portfolio Advisor (Gemini 2.0 Flash)
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const MODEL = "gemini-1.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

serve(async (req: Request) => {
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
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  if (!GEMINI_KEY) {
    return new Response(JSON.stringify({ error: "AI not configured — set GEMINI_API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const { portfolio, question } = await req.json();
    if (!question?.trim()) {
      return new Response(JSON.stringify({ error: "No question provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const systemPrompt = `You are a professional financial advisor AI for Keno Vault, a personal net worth tracker app.
You have access to the user's full portfolio data below. Give concise, actionable advice.
Keep responses under 300 words. Be specific — reference their actual numbers.
Never recommend specific stocks or crypto tokens. Use the currency data provided.
If you don't know something, say so honestly. Format currency values nicely.

USER PORTFOLIO:
${JSON.stringify(portfolio, null, 2)}

The user asks: ${question}`;

    const resp = await fetch(`${API_URL}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("[AI] Gemini error:", JSON.stringify(data));
      var errMsg = data?.error?.message || "";
      // Sanitize — don't leak API details to the user
      if (errMsg.includes("quota") || errMsg.includes("rate") || errMsg.includes("limit")) {
        return new Response(JSON.stringify({ error: "AI is temporarily unavailable. Please try again in a few minutes." }), {
          status: 503,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
      return new Response(JSON.stringify({ error: "AI couldn't process that request. Try rephrasing your question." }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response. Try rephrasing your question.";

    console.log("[AI] Question answered:", question.slice(0, 60));
    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (e: any) {
    console.error("[AI] Error:", e.message || e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
