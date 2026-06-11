import { getOpenAI, jsonCompletion } from "@/lib/openai";
import { evaluatePrompt } from "@/lib/prompts";
import { mockEvaluation } from "@/lib/mocks";
import {
  EvaluationLLMSchema,
  TelemetrySchema,
  type Telemetry,
} from "@/lib/schemas";

export async function POST(req: Request) {
  let audio: File, telemetry: Telemetry | null, question: string, role: string;
  try {
    const fd = await req.formData();
    const audioEntry = fd.get("audio");
    if (!(audioEntry instanceof File) || audioEntry.size === 0) {
      throw new Error("audio file missing");
    }
    audio = audioEntry;
    telemetry = TelemetrySchema.nullable().parse(
      JSON.parse(String(fd.get("telemetry") ?? "null")),
    );
    question = String(fd.get("question") ?? "");
    role = String(fd.get("role") ?? "");
    if (!question || !role) throw new Error("question and role required");
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const client = getOpenAI();
  if (!client) {
    return Response.json(mockEvaluation(question));
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transcription: any = await client.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      response_format: "verbose_json",

      // No prompt — a language-specific prompt biases Whisper's language
      // detection and causes it to translate non-English audio into English.
    });
    const transcript: string = transcription.text;
    // Whisper pricing: $0.006 per minute
    const durationSec: number = transcription.duration ?? 0;
    const whisperCost = (durationSec / 60) * 0.006;
    console.log("testing 123123123123");
    console.log(
      `[OpenAI] whisper-1 — duration: ${durationSec.toFixed(1)}s, cost: $${whisperCost.toFixed(6)}`,
    );

    const evaluation = await jsonCompletion(
      client,
      evaluatePrompt(role, question, transcript, telemetry),
      EvaluationLLMSchema,
      "gpt-4o evaluate",
    );
    return Response.json({ ...evaluation, transcript, mocked: false });
  } catch (err) {
    console.error("evaluate route failed:", err);
    return Response.json({ error: "Evaluation failed" }, { status: 502 });
  }
}
