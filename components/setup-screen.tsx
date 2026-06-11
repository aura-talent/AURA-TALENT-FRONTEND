"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { QuestionsResponseSchema } from "@/lib/schemas";

interface Props {
  onStart: (role: string, questions: string[], mocked: boolean) => void;
}

export default function SetupScreen({ onStart }: Props) {
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = QuestionsResponseSchema.parse(await res.json());
      onStart(role, data.questions, data.mocked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">InterviewDNA</CardTitle>
          <CardDescription>
            AI mock interviews that analyze what you say — and how you say it.
            Enter the role you&apos;re practicing for.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="e.g. Frontend Engineer"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && role.trim() && !loading) begin();
            }}
            disabled={loading}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            className="w-full"
            onClick={begin}
            disabled={!role.trim() || loading}
          >
            {loading ? "Preparing questions…" : "Start interview"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
