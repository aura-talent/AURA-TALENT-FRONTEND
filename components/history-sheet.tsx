"use client";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { Answer } from "@/hooks/use-session";

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
          {answers.map((a, i) => (
            <div key={i} className="space-y-1 border-b pb-4 last:border-b-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Q{i + 1}: {a.question}</p>
                <Badge variant="outline">{a.evaluation.overallScore}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                &ldquo;{a.evaluation.transcript}&rdquo;
              </p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
