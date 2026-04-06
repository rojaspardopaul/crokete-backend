/**
 * AI Review Moderator
 *
 * Analyzes review text and metadata to pre-classify content before admin
 * moderation. Uses Gemini (free) with OpenAI as fallback — same provider
 * pattern as product generation.
 *
 * Returns: { confidence, suggestedAction, reason, tags[] }
 *
 * NEVER blocks review creation — if AI fails, defaults to "needs_review".
 */

const { GoogleGenAI } = require("@google/genai");
const OpenAI = require("openai");

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
];

const DEFAULT_RESULT = {
  confidence: 0,
  suggestedAction: "needs_review",
  reason: "AI analysis unavailable",
  tags: [],
};

// Confidence threshold above which the AI suggestion auto-approves
const AUTO_APPROVE_THRESHOLD = 0.9;

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildModerationPrompt({ title, comment, rating, productName }) {
  return `Eres un moderador de reseñas para una tienda online de mascotas (perros y gatos).
Analiza la siguiente reseña y clasifícala.

PRODUCTO: "${productName || "Producto desconocido"}"
RATING: ${rating}/5
TÍTULO: "${title || "(sin título)"}"
COMENTARIO: "${comment}"

Clasifica la reseña en UNA de estas categorías:
- "approved_suggestion" → reseña legítima, útil, sin problemas
- "needs_review" → dudosa, requiere revisión humana
- "spam" → publicidad, links externos, contenido irrelevante
- "offensive" → insultos, lenguaje ofensivo, odio
- "fake_review" → parece falsa, genérica, o no relacionada al producto

Evalúa estos aspectos del texto:
1. ¿Contiene spam o publicidad?
2. ¿Hay lenguaje ofensivo o insultos?
3. ¿Es una reseña genérica que podría aplicar a cualquier producto?
4. ¿El comentario es relevante al tipo de producto (mascotas)?
5. ¿Contiene links externos?
6. ¿El rating y el texto son coherentes entre sí?

Responde SOLO con un JSON válido:
{
  "confidence": <numero entre 0 y 1>,
  "suggestedAction": "<una de las 5 categorías>",
  "reason": "<explicación breve en español>",
  "tags": ["<tag1>", "<tag2>"]
}

Tags posibles: "legitimate", "helpful", "detailed", "possible_spam", "external_link",
"offensive_language", "generic_text", "irrelevant_content", "rating_mismatch",
"very_short", "advertising", "fake_pattern"`;
}

// ─── Gemini ──────────────────────────────────────────────────────────────────

async function moderateWithGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });

  for (const model of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.3, // low temp for consistent classification
          maxOutputTokens: 512,
        },
      });
      return JSON.parse(response.text);
    } catch (err) {
      // Model unavailable or quota — try next
      if (err?.message?.includes("404") || err?.message?.includes("not found")) {
        continue;
      }
      if (err?.status === 429 || err?.message?.includes("429")) {
        continue;
      }
      // Non-retriable error
      console.error(`⚠️ Gemini moderation error (${model}):`, err.message);
      return null;
    }
  }
  return null;
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function moderateWithOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // cheaper model for moderation
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content:
            "Eres un moderador de reseñas para una tienda de mascotas. " +
            "Clasificas reseñas de clientes. Siempre responde con JSON válido.",
        },
        { role: "user", content: prompt },
      ],
    });
    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    console.error("⚠️ OpenAI moderation error:", err.message);
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Analyze a review with AI. Never throws — returns DEFAULT_RESULT on failure.
 *
 * @param {{ title: string, comment: string, rating: number, productName: string }} review
 * @returns {Promise<{ confidence: number, suggestedAction: string, reason: string, tags: string[] }>}
 */
async function moderateReview({ title, comment, rating, productName }) {
  try {
    const prompt = buildModerationPrompt({ title, comment, rating, productName });

    // Try Gemini first (free), then OpenAI
    let result = await moderateWithGemini(prompt);
    if (!result) {
      result = await moderateWithOpenAI(prompt);
    }
    if (!result) {
      return DEFAULT_RESULT;
    }

    // Validate shape
    return {
      confidence: typeof result.confidence === "number"
        ? Math.max(0, Math.min(1, result.confidence))
        : 0,
      suggestedAction: [
        "approved_suggestion",
        "needs_review",
        "spam",
        "offensive",
        "fake_review",
      ].includes(result.suggestedAction)
        ? result.suggestedAction
        : "needs_review",
      reason: String(result.reason || ""),
      tags: Array.isArray(result.tags)
        ? result.tags.map(String).slice(0, 10)
        : [],
    };
  } catch (err) {
    console.error("⚠️ Review moderation failed:", err.message);
    return DEFAULT_RESULT;
  }
}

module.exports = {
  moderateReview,
  AUTO_APPROVE_THRESHOLD,
};
