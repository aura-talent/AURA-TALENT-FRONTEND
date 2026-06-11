"use client";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { Answer } from "@/hooks/use-session";
import { scoreColor } from "./score-dashboard";

export default function HistorySheet({ answers }: { answers: Answer[] }) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" disabled={answers.length === 0} />
        }
      >
        History ({answers.length})
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Answer history</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-6 px-1">
          {answers.map((a, i) => {
            const color = scoreColor(a.evaluation.overallScore)
            return (
              <div key={i} className="space-y-1 border-b pb-4 last:border-b-0 px-5">
                <div className="flex items-center space-x-3">
                  <p className="text-sm font-semibold">Q{i + 1}: {a.question}</p>
                  <Badge variant="outline" style={{ color, borderColor: color, borderWidth: 1, backgroundColor: `color-mix(in srgb, ${color} ${0.2 * 100}%, transparent)` }}>{a.evaluation.overallScore}</Badge>
                </div>
                <div className="h-1" />
                <p className="text-sm text-muted-foreground">
                  &ldquo;{a.evaluation.transcript}&rdquo;
                </p>
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
