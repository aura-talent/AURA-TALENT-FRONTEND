"use client";
import { useReducer } from "react";
import type { Evaluation, Telemetry } from "@/lib/schemas";

export type Phase = "setup" | "check" | "interview" | "report";

export interface Answer {
  question: string;
  evaluation: Evaluation;
  telemetry: Telemetry | null;
}

export interface SessionState {
  phase: Phase;
  role: string;
  questions: string[];
  answers: Answer[];
  currentIndex: number;
  mocked: boolean;
}

export type SessionAction =
  | { type: "START_SESSION"; role: string; questions: string[]; mocked: boolean }
  | { type: "DEVICES_READY" }
  | { type: "ANSWER_EVALUATED"; answer: Answer }
  | { type: "NEXT_QUESTION" }
  | { type: "SESSION_COMPLETE" }
  | { type: "RESET" };

export const initialSession: SessionState = {
  phase: "setup",
  role: "",
  questions: [],
  answers: [],
  currentIndex: 0,
  mocked: false,
};

export function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case "START_SESSION":
      return {
        ...initialSession,
        phase: "check",
        role: action.role,
        questions: action.questions,
        mocked: action.mocked,
      };
    case "DEVICES_READY":
      return { ...state, phase: "interview" };
    case "ANSWER_EVALUATED":
      return { ...state, answers: [...state.answers, action.answer] };
    case "NEXT_QUESTION":
      return { ...state, currentIndex: state.currentIndex + 1 };
    case "SESSION_COMPLETE":
      return { ...state, phase: "report" };
    case "RESET":
      return initialSession;
  }
}

export function useSession() {
  return useReducer(sessionReducer, initialSession);
}
