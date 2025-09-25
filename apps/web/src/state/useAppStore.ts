import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

type Theme = "light" | "dark";

type AppState = {
  author: string;
  draftText: string;
  theme: Theme;
  isBusy: boolean;
  setAuthor: (name: string) => void;
  setDraftText: (val: string) => void;
  setTheme: (t: Theme) => void;
  setBusy: (busy: boolean) => void;
  resetDraft: () => void;
};

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        author: "",
        draftText: "",
        theme: "light",
        isBusy: false,
        setAuthor: (name) => set({ author: name }),
        setDraftText: (val) => set({ draftText: val }),
        setTheme: (t) => set({ theme: t }),
        setBusy: (busy) => set({ isBusy: busy }),
        resetDraft: () => set({ draftText: "" })
      }),
      {
        name: "app-store",
        // Persist only what we want to keep across refreshes
        partialize: (s) => ({ author: s.author, theme: s.theme })
      }
    ),
    { name: "AppStore" }
  )
);
