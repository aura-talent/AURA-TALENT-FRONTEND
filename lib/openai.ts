import OpenAI from "openai";
import type { z } from "zod";

/** Returns a client when OPENAI_API_KEY is set, otherwise null (mock mode). */
export function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

// GPT-4o pricing (per token): https://openai.com/pricing
const GPT4O_INPUT_PER_TOKEN = 2.50 / 1_000_000;
const GPT4O_OUTPUT_PER_TOKEN = 10.00 / 1_000_000;

function logGPT4oCost(label: string, usage: { prompt_tokens: number; completion_tokens: number }) {
  const cost =
    usage.prompt_tokens * GPT4O_INPUT_PER_TOKEN +
    usage.completion_tokens * GPT4O_OUTPUT_PER_TOKEN;
  console.log(
    `[OpenAI] ${label} — in: ${usage.prompt_tokens} tokens, out: ${usage.completion_tokens} tokens, cost: $${cost.toFixed(6)}`,
  );
}

/**
 * Chat completion in JSON mode, parsed and schema-validated.
 * Retries once on malformed output, then throws.
 */
export async function jsonCompletion<T>(
  client: OpenAI,
  prompt: { system: string; user: string },
  schema: z.ZodType<T>,
  label = "gpt-4o",
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    });
    if (res.usage) logGPT4oCost(label, res.usage);
    try {
      return schema.parse(JSON.parse(res.choices[0]?.message?.content ?? ""));
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Model returned invalid JSON twice: ${lastError}`);
}
