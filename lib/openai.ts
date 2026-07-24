import OpenAI from "openai";
import type { z } from "zod";

export const GEMINI_MODEL = "gemini-3.5-flash";

/**
 * Returns a client configured for Gemini 3.5 Flash via Google's OpenAI-compatible endpoint.
 * Accepts GEMINI_API_KEY, GOOGLE_API_KEY, or OPENAI_API_KEY as fallback.
 * Returns null when no key is set (mock mode).
 */
export function getOpenAI(): OpenAI | null {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  return new OpenAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
}

/**
 * Chat completion using Gemini 3.5 Flash in JSON mode, parsed and schema-validated.
 * Retries once on malformed output, then throws.
 */
export async function jsonCompletion<T>(
  client: OpenAI,
  prompt: { system: string; user: string },
  schema: z.ZodType<T>,
  label = "gemini-3.5-flash",
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.chat.completions.create({
      model: GEMINI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    });
    try {
      return schema.parse(JSON.parse(res.choices[0]?.message?.content ?? ""));
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Model returned invalid JSON twice: ${lastError}`);
}

