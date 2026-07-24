import { z } from "zod";
import { getOpenAI, jsonCompletion } from "@/lib/openai";
import { questionsPrompt } from "@/lib/prompts";
import { mockQuestions } from "@/lib/mocks";
import { QuestionsLLMSchema } from "@/lib/schemas";

const BodySchema = z.object({ role: z.string().min(1).max(200) });

export async function POST(req: Request) {
  let role: string;
  try {
    role = BodySchema.parse(await req.json()).role;
  } catch {
    return Response.json({ error: "role is required" }, { status: 400 });
  }

  const client = getOpenAI();
  if (!client) {
    return Response.json({ questions: mockQuestions(role), mocked: true });
  }

  try {
    const { questions } = await jsonCompletion(
      client,
      questionsPrompt(role),
      QuestionsLLMSchema,
      "gemini-3.5-flash questions",
    );

    return Response.json({ questions, mocked: false });
  } catch (err) {
    console.error("questions route failed:", err);
    return Response.json({ error: "Failed to generate questions" }, { status: 502 });
  }
}
