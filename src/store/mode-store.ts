import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** "live" = the owner's real accounts and live prices; "demo" = the agent simulation with fictional capital. */
export type Mode = "live" | "demo";

interface ModeState {
  mode: Mode;
  setMode(mode: Mode): void;
}

/**
 * Which side of the platform is showing. Remembered per browser; defaults to live.
 * Hydration is manual (see ModeHydrator) so the first client render matches the server.
 */
export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      mode: "live",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "dwp.mode",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

export const useMode = () => useModeStore((s) => s.mode);
