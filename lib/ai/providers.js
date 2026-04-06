/**
 * AI Provider Abstraction for Product Generation
 * Supports: Google Gemini (free) and OpenAI GPT-4o (paid)
 *
 * Both providers receive the same prompt and return structured JSON.
 */

const { GoogleGenAI } = require("@google/genai");
const OpenAI = require("openai");

// Gemini model fallback order — uses @google/genai SDK
// gemini-1.5-x has been removed from the API; only Gemini 2.x+ models are available
const GEMINI_MODELS = [
  "gemini-2.5-flash",      // mejor calidad, free tier generoso
  "gemini-2.0-flash-lite", // más ligero, menor tasa de quota
  "gemini-2.0-flash",      // última opción
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract the retry delay (in ms) from a Gemini 429 error, or return null.
 * The error message contains: "retryDelay":"11s"
 */
function parseRetryDelayMs(err) {
  const match = err?.message?.match(/"retryDelay":"(\d+)s"/);
  if (match) return parseInt(match[1], 10) * 1000;
  return null;
}

function isQuotaError(err) {
  return (
    err?.message?.includes("429") ||
    err?.message?.includes("Too Many Requests") ||
    err?.message?.includes("RESOURCE_EXHAUSTED") ||
    err?.status === 429
  );
}

function isDailyQuotaExhausted(err) {
  return (
    err?.message?.includes("PerDay") ||
    err?.message?.includes("per_day") ||
    err?.message?.includes("DailyQuota")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Try to parse JSON. If truncated, attempt to close open braces/brackets
 * so partial but meaningful data is still returned.
 */
function tryParseJSON(text) {
  // First try clean parse
  try {
    return JSON.parse(text);
  } catch (firstErr) {
    // Attempt recovery: strip trailing incomplete token and close open structures
    let cleaned = text.trimEnd();
    // Remove trailing incomplete string value (unclosed quote)
    cleaned = cleaned.replace(/,?\s*"[^"]*$/, "");
    // Remove trailing incomplete key
    cleaned = cleaned.replace(/,?\s*"[^"]*"\s*:\s*$/, "");
    // Remove trailing comma
    cleaned = cleaned.replace(/,\s*$/, "");

    // Count open braces/brackets and close them
    let opens = 0;
    let inString = false;
    let escape = false;
    for (const ch of cleaned) {
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (!inString) {
        if (ch === "{" || ch === "[") opens++;
        else if (ch === "}" || ch === "]") opens--;
      }
    }
    // Append closing characters
    for (let i = 0; i < opens; i++) cleaned += "}";

    try {
      return JSON.parse(cleaned);
    } catch {
      throw firstErr; // rethrow original error
    }
  }
}

// ─── Gemini Provider (Free) — with model fallback & retry ───────────────────

async function generateWithGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está configurada en las variables de entorno");
  }

  const ai = new GoogleGenAI({ apiKey });

  let lastError;

  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      });

      const text = response.text;
      return tryParseJSON(text);

    } catch (err) {
      lastError = err;

      if (!isQuotaError(err)) {
        // Non-quota error (bad key, network, model not found) — try next model
        // but only if it looks like a model-specific issue
        if (err?.message?.includes("404") || err?.message?.includes("not found")) {
          continue; // try next model
        }
        throw err;
      }

      // Per-minute limit: wait the retry delay and retry the SAME model once
      const retryMs = parseRetryDelayMs(err);
      if (retryMs && !isDailyQuotaExhausted(err)) {
        const waitMs = Math.min(retryMs + 2000, 20000); // cap at 20s
        await sleep(waitMs);
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.7,
              maxOutputTokens: 8192,
            },
          });
          return tryParseJSON(response.text);
        } catch (retryErr) {
          lastError = retryErr;
          if (!isQuotaError(retryErr)) throw retryErr;
          // Quota still hit after retry — try next model
        }
      }
      // Daily quota exhausted for this model — try next
    }
  }

  // All models exhausted — throw a clear user-facing error
  const quotaErr = new Error(
    "Cuota del plan gratuito de Gemini agotada para hoy. " +
    "Opciones: 1) Espera hasta mañana para que se reinicie la cuota, " +
    "2) Agrega OPENAI_API_KEY y usa GPT-4o, " +
    "3) Activa facturación en Google AI Studio (https://aistudio.google.com) para más cuota."
  );
  quotaErr.type = "QUOTA_EXHAUSTED";
  throw quotaErr;
}

// ─── OpenAI Provider (Paid) ──────────────────────────────────────────────────

async function generateWithOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no está configurada en las variables de entorno");
  }

  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 8192,
    messages: [
      {
        role: "system",
        content:
          "Eres un experto en productos para mascotas. Generas datos de producto en JSON estructurado en español. Siempre responde con JSON válido.",
      },
      { role: "user", content: prompt },
    ],
  });

  const text = response.choices[0].message.content;
  return JSON.parse(text);
}

// ─── Provider Router ─────────────────────────────────────────────────────────

/**
 * Generate product data using the specified AI provider.
 * @param {"gemini"|"openai"} provider - Which AI provider to use
 * @param {string} prompt - The structured prompt
 * @returns {Promise<Object>} Parsed JSON product data
 */
async function generateProductJSON(provider, prompt) {
  switch (provider) {
    case "openai":
      return generateWithOpenAI(prompt);
    case "gemini":
    default:
      return generateWithGemini(prompt);
  }
}

/**
 * Check which AI providers are available (have API keys configured).
 * @returns {{ gemini: boolean, openai: boolean }}
 */
function getAvailableProviders() {
  return {
    gemini: !!process.env.GEMINI_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
  };
}

module.exports = { generateProductJSON, getAvailableProviders };
