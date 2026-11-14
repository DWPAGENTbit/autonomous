import { create } from "zustand";

export type ContextSheet =
  | { kind: "why"; decisionId: string }
  | { kind: "event"; eventId: string }
  | null;

interface UiState {
  sheet: ContextSheet;
  /** Decision shown in the Command Center's decision chain. null = latest. */
  focusedDecisionId: string | null;
  openWhy(decisionId: string): void;
  openEvent(eventId: string): void;
  closeSheet(): void;
  focusDecision(id: string | null): void;
}

/** View-only state. Domain state lives in the app store. */
export const useUiStore = create<UiState>()((set) => ({
  sheet: null,
  focusedDecisionId: null,
  openWhy: (decisionId) => set({ sheet: { kind: "why", decisionId } }),
  openEvent: (eventId) => set({ sheet: { kind: "event", eventId } }),
  closeSheet: () => set({ sheet: null }),
  focusDecision: (id) => set({ focusedDecisionId: id }),
}));
