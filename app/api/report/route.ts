import { z } from "zod";
import { getOpenAI, jsonCompletion } from "@/lib/openai";
import { reportPrompt } from "@/lib/prompts";
import { mockReport } from "@/lib/mocks";
import { EvaluationSchema, ReportLLMSchema } from "@/lib/schemas";

const BodySchema = z.object({
  role: z.string().min(1),
  answers: z
    .array(z.object({ question: z.string(), evaluation: EvaluationSchema }))
    .min(1),
});

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const client = getOpenAI();
  if (!client) {
    return Response.json(mockReport());
  }

  try {
    const report = await jsonCompletion(
      client,
      reportPrompt(body.role, body.answers),
      ReportLLMSchema,
      "gpt-4o report",
    );
    return Response.json({ ...report, mocked: false });
  } catch (err) {
    console.error("report route failed:", err);
    return Response.json({ error: "Report generation failed" }, { status: 502 });
  }
}
