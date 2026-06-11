"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportSchema, type Report } from "@/lib/schemas";
import type { Answer } from "@/hooks/use-session";

const VERDICT_LABEL: Record<Report["verdict"], string> = {
  strong: "Strong candidate",
  promising: "Promising — keep practicing",
  "needs practice": "Needs practice",
};

interface Props {
  role: string;
  answers: Answer[];
  onRestart: () => void;
}

export default function FinalReport({ role, answers, onRestart }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch("/api/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role,
        answers: answers.map((a) => ({
          question: a.question,
          evaluation: a.evaluation,
        })),
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Report failed (${res.status})`);
        const data = ReportSchema.parse(await res.json());
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed");
      });
    return () => {
      cancelled = true;
    };
  }, [role, answers]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm text-red-500">{error}</p>
            <Button onClick={onRestart}>Start over</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Final report — {role}</CardTitle>
          <div className="flex gap-2">
            {report.mocked && <Badge variant="secondary">Mock data</Badge>}
            <Badge>{VERDICT_LABEL[report.verdict]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              ["Content relevance", report.averagedScores.contentRelevance],
              ["Clarity & structure", report.averagedScores.clarityStructure],
              ["Confidence & delivery", report.averagedScores.confidenceDelivery],
              ["Body language", report.averagedScores.bodyLanguage],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{label}</span>
                <span className="text-muted-foreground">{Math.round(value)}</span>
              </div>
              <Progress value={value} />
            </div>
          ))}
          <div>
            <h4 className="mb-1 text-sm font-semibold">Score per question</h4>
            <div className="flex items-end gap-2">
              {report.trend.map((v, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="w-8 rounded-t bg-primary"
                    style={{ height: `${Math.max(v, 4)}px` }}
                  />
                  <span className="text-xs text-muted-foreground">Q{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="mb-1 text-sm font-semibold text-green-600">
                Top strengths
              </h4>
              <ul className="list-disc pl-4 text-sm text-muted-foreground">
                {report.topStrengths.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
            <div>
              <h4 className="mb-1 text-sm font-semibold text-amber-600">
                Focus areas
              </h4>
              <ul className="list-disc pl-4 text-sm text-muted-foreground">
                {report.topImprovements.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          </div>
          <p className="text-sm">{report.closing}</p>
          <Button onClick={onRestart} className="w-full">
            Practice again
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
