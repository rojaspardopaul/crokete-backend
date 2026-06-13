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
  if (!text || !text.trim()) {
    throw new Error("El modelo devolvió una respuesta vacía. Intenta de nuevo.");
  }

  // Strip markdown code fences in case the model wraps JSON in them
  let src = text.trim();
  src = src.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  // First try clean parse
  try {
    return JSON.parse(src);
  } catch (firstErr) {
    // ── Recovery: walk forward tracking JSON nesting with proper escape handling ──
    // Strategy 1: find the position of the last complete root-level object/array
    let depth = 0;
    let inStr = false;
    let esc = false;
    let lastCompletePos = -1;
    const isOpeningChar = { "{": true, "[": true };
    const isClosingChar = { "}": true, "]": true };

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = inStr; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (isOpeningChar[ch]) depth++;
      else if (isClosingChar[ch]) {
        depth--;
        if (depth === 0) lastCompletePos = i;
      }
    }

    if (lastCompletePos > 0) {
      try {
        return JSON.parse(src.slice(0, lastCompletePos + 1));
      } catch { /* fall through to strategy 2 */ }
    }

    // ── Strategy 2: truncate at unclosed string & close open structures ──
    let cleaned = src.trimEnd();

    // Remove trailing unclosed string (handles escape sequences)
    // Walk backwards to find the last unescaped opening quote
    let i = cleaned.length - 1;
    while (i >= 0) {
      if (cleaned[i] === '"') {
        // Count preceding backslashes to see if this quote is escaped
        let backslashes = 0;
        let j = i - 1;
        while (j >= 0 && cleaned[j] === "\\") { backslashes++; j--; }
        if (backslashes % 2 === 0) {
          // Unescaped quote found — check if it's an opener (depth parity)
          // Simpler: just see if everything from here to end is an unterminated string
          const fragment = cleaned.slice(i);
          const hasClosingQuote = /^"(?:[^"\\]|\\.)*"/.test(fragment);
          if (!hasClosingQuote) {
            // This is the start of an unclosed string — strip from preceding comma/colon
            cleaned = cleaned.slice(0, i).replace(/,?\s*(?:"[^"]*"\s*:\s*)?$/, "");
            break;
          }
        }
      }
      i--;
    }

    // Remove trailing comma
    cleaned = cleaned.replace(/,\s*$/, "");

    // Close open braces/brackets in correct order
    const stack = [];
    inStr = false;
    esc = false;
    for (const ch of cleaned) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = inStr; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") stack.push("}");
      else if (ch === "[") stack.push("]");
      else if (ch === "}" || ch === "]") stack.pop();
    }
    for (let k = stack.length - 1; k >= 0; k--) cleaned += stack[k];

    try {
      return JSON.parse(cleaned);
    } catch {
      throw firstErr;
    }
  }
}

// ─── Gemini Provider (Free) — with model fallback & retry ───────────────────

/**
 * Build the Gemini `contents` payload. With images, returns a parts array
 * (text + inlineData) so the model reads the attached photos (OCR/vision);
 * without images, returns the plain prompt string.
 * @param {string} prompt
 * @param {{mimeType:string,data:string}[]} images - base64 (no data: prefix)
 */
function buildGeminiContents(prompt, images = []) {
  if (!images.length) return prompt;
  return [
    { text: prompt },
    ...images.map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.data },
    })),
  ];
}

async function generateWithGemini(prompt, images = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está configurada en las variables de entorno");
  }

  const ai = new GoogleGenAI({ apiKey });
  const contents = buildGeminiContents(prompt, images);

  let lastError;

  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          responseMimeType: "application/json",
          temperature: 0.7,
          maxOutputTokens: 32768,
        },
      });

      const text = response.text;
      if (!text || !text.trim()) {
        const candidate = response.candidates?.[0];
        const finishReason = candidate?.finishReason;
        console.error(`[AI] Gemini empty response — model: ${modelName}, finishReason: ${finishReason}`);
        throw new Error(
          finishReason === "SAFETY"
            ? "Respuesta bloqueada por filtros de seguridad. Intenta con otra descripción."
            : `El modelo devolvió una respuesta vacía (${finishReason || "sin candidatos"}). Intenta de nuevo.`
        );
      }
      return tryParseJSON(text);

    } catch (err) {
      lastError = err;

      if (!isQuotaError(err)) {
        // Non-quota error — try next model for model-specific issues or empty responses
        if (
          err?.message?.includes("404") ||
          err?.message?.includes("not found") ||
          err?.message?.includes("respuesta vacía") ||
          err?.message?.includes("sin candidatos")
        ) {
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
            contents,
            config: {
              responseMimeType: "application/json",
              temperature: 0.7,
              maxOutputTokens: 32768,
            },
          });
          const retryText = response.text;
          if (!retryText || !retryText.trim()) {
            const candidate = response.candidates?.[0];
            const finishReason = candidate?.finishReason;
            console.error(`[AI] Gemini empty response on retry — model: ${modelName}, finishReason: ${finishReason}`);
            throw new Error(
              finishReason === "SAFETY"
                ? "Respuesta bloqueada por filtros de seguridad. Intenta con otra descripción."
                : `El modelo devolvió una respuesta vacía en el reintento (${finishReason || "sin candidatos"}).`
            );
          }
          return tryParseJSON(retryText);
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

async function generateWithOpenAI(prompt, images = []) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no está configurada en las variables de entorno");
  }

  const openai = new OpenAI({ apiKey });

  // GPT-4o vision: user content becomes an array of text + image_url parts.
  const userContent = images.length
    ? [
        { type: "text", text: prompt },
        ...images.map((img) => ({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.data}` },
        })),
      ]
    : prompt;

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
      { role: "user", content: userContent },
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
async function generateProductJSON(provider, prompt, images = []) {
  switch (provider) {
    case "openai":
      return generateWithOpenAI(prompt, images);
    case "gemini":
    default:
      return generateWithGemini(prompt, images);
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
