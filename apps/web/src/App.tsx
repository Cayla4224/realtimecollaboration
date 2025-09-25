import axios from "axios";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { type Message } from "@your-app/shared";
import { useAppStore } from "./state/useAppStore";

const apiBase = import.meta.env.VITE_API_URL ?? "";
const api = axios.create({ baseURL: apiBase || undefined }); // proxy → relative

export default function App() {
  // Zustand state
  const author       = useAppStore((s) => s.author);
  const draftText    = useAppStore((s) => s.draftText);
  const theme        = useAppStore((s) => s.theme);
  const setAuthor    = useAppStore((s) => s.setAuthor);
  const setDraftText = useAppStore((s) => s.setDraftText);
  const resetDraft   = useAppStore((s) => s.resetDraft);
  const setTheme     = useAppStore((s) => s.setTheme);

  const qc = useQueryClient();

  // Fetch messages
  const { data, error, isLoading } = useQuery({
    queryKey: ["messages"],
    queryFn: async () => (await api.get<Message[]>("/messages")).data
  });

  // POST /messages
  const sendMessage = useMutation({
    mutationFn: async (payload: Pick<Message, "text" | "author">) =>
      (await api.post<Message>("/messages", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      resetDraft();
    }
  });

  // ✅ Realtime: listen for new messages from Socket.IO
  useEffect(() => {
    const socket = io(); // no URL → same-origin /socket.io (Vite proxy to API)
    socket.on("message:new", (msg: Message) => {
      qc.setQueryData<Message[]>(["messages"], (curr = []) => [msg, ...(curr || [])]);
    });
    return () => 
      socket.disconnect();
  }, [qc]);

  // Guard against non-array responses
  const messages: Message[] = Array.isArray(data) ? data : [];

  const pageStyle: React.CSSProperties =
    theme === "dark"
      ? { background: "#111", color: "#eee", minHeight: "100vh" }
      : { background: "#fff", color: "#111", minHeight: "100vh" };

  return (
    <main style={{ ...pageStyle, paddingBottom: 48 }}>
      <div style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ margin: 0 }}>Realtime Chat</h1>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc" }}
            type="button"
          >
            Theme: {theme}
          </button>
        </header>

        <section style={{ marginTop: 12 }}>
          <p style={{ opacity: 0.8 }}>
            Your name and theme are stored in <strong>Zustand</strong> (persist across refreshes).
            Messages are fetched with <strong>React Query</strong> and updated live via <strong>Socket.IO</strong>.
          </p>

          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            <input
              name="author"
              placeholder="Your name"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <input
              name="text"
              placeholder="Write a message…"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const text = draftText.trim();
                  const name = (author || "Anon").trim();
                  if (!text) return;
                  sendMessage.mutate({ text, author: name });
                }}
                disabled={sendMessage.isPending}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc" }}
              >
                {sendMessage.isPending ? "Sending…" : "Send"}
              </button>
              <button
                type="button"
                onClick={resetDraft}
                disabled={sendMessage.isPending}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc" }}
              >
                Clear Draft
              </button>
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gap: 8 }}>
          <h2 style={{ margin: "8px 0" }}>Messages (from API)</h2>

          {isLoading && <div>Loading messages…</div>}

          {error && (
            <div style={{ color: "crimson", padding: 12, border: "1px solid #faa", borderRadius: 8 }}>
              Couldn’t reach API. Check VITE_API_URL in apps/web/.env and that the API is running.
            </div>
          )}

          {!isLoading && !error && !Array.isArray(data) && (
            <div style={{ color: "#333", padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
              <strong>Unexpected response from /messages</strong>
              <pre style={{ whiteSpace: "pre-wrap" }}>
{JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}

          <ul style={{ display: "grid", gap: 8, padding: 0, listStyle: "none" }}>
            {messages.map((m) => (
              <li key={m.id} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <strong>{m.author}:</strong> {m.text}
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {new Date(m.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <footer style={{ marginTop: 24, fontSize: 12, opacity: 0.7 }}>
          API base: <code>{apiBase || "(relative via proxy)"}</code>
        </footer>
      </div>
    </main>
  );
}
