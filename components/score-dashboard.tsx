"use client";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { Evaluation } from "@/lib/schemas";

const DIMENSIONS: { key: keyof Evaluation["scores"]; label: string }[] = [
  { key: "contentRelevance", label: "Content relevance" },
  { key: "clarityStructure", label: "Clarity & structure" },
  { key: "confidenceDelivery", label: "Confidence & delivery" },
  { key: "bodyLanguage", label: "Body language" },
];

export default function ScoreDashboard({ evaluation }: { evaluation: Evaluation }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">
          Feedback — overall {evaluation.overallScore}/100
        </CardTitle>
        {evaluation.mocked && <Badge variant="secondary">Mock data</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {DIMENSIONS.map(({ key, label }) => (
            <div key={key}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{label}</span>
                <span className="text-muted-foreground">
                  {evaluation.scores[key]}
                </span>
              </div>
              <Progress value={evaluation.scores[key]} />
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="mb-1 text-sm font-semibold text-green-600">Strengths</h4>
            <ul className="list-disc pl-4 text-sm text-muted-foreground">
              {evaluation.strengths.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
          <div>
            <h4 className="mb-1 text-sm font-semibold text-amber-600">Improve</h4>
            <ul className="list-disc pl-4 text-sm text-muted-foreground">
              {evaluation.improvements.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        </div>
        <p className="text-sm">{evaluation.summary}</p>
      </CardContent>
    </Card>
  );
}
