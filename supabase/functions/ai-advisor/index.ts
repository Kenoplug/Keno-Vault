// Keno Vault — AI Portfolio Advisor
// Provider: Groq (free tier). Swap AI_CONFIG to change provider later.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// Swap this block to change AI provider
const AI_PROVIDER = "groq"; // "groq" | "deepseek" | "gemini"
const AI_CONFIG = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: Deno.env.get("GROQ_API_KEY") || "",
    model: "llama-3.1-8b-instant",
    headers: (key: string) => ({ "Authorization": `Bearer ${key}`, "Content-Type": "application/json" }),
    body: (system: string, question: string) => ({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: system },
        { role: "user", content: question },
      ],
      temperature: 0.7,
      max_tokens: 600,
    }),
    parse: (data: any) => data?.choices?.[0]?.message?.content,
  },
  deepseek: {
    url: "https://api.deepseek.com/v1/chat/completions",
    key: Deno.env.get("DEEPSEEK_API_KEY") || "",
    model: "deepseek-chat",
    headers: (key: string) => ({ "Authorization": `Bearer ${key}`, "Content-Type": "application/json" }),
    body: (system: string, question: string) => ({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content: question },
      ],
      temperature: 0.7,
      max_tokens: 600,
    }),
    parse: (data: any) => data?.choices?.[0]?.message?.content,
  },
};

const config = AI_CONFIG[AI_PROVIDER];
const AI_KEY = config.key;

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

  if (!AI_KEY) {
    return new Response(JSON.stringify({ error: "AI not configured. Set API key for: " + AI_PROVIDER }), {
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

    const systemPrompt = `You are a professional financial advisor AI for Keno Vault.
You have the user's full portfolio. Give concise, actionable advice under 300 words.
Reference their actual numbers. No specific stock/crypto picks.

FORMAT YOUR RESPONSE with:
- **bold** for key numbers and important terms
- ## headings for sections
- - bullet points for lists
- Short paragraphs separated by blank lines

PORTFOLIO: ${JSON.stringify(portfolio)}`;

    const resp = await fetch(config.url, {
      method: "POST",
      headers: config.headers(AI_KEY),
      body: JSON.stringify(config.body(systemPrompt, question)),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error(`[AI] ${AI_PROVIDER} error:`, JSON.stringify(data).slice(0, 300));
      return new Response(JSON.stringify({ error: "AI is temporarily unavailable. Please try again in a few minutes." }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const reply = config.parse(data) || "I couldn't generate a response. Try rephrasing your question.";

    console.log("[AI] Answered:", question.slice(0, 60));
    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (e: any) {
    console.error("[AI] Error:", e.message || e);
    return new Response(JSON.stringify({ error: "Something went wrong. Try again later." }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
