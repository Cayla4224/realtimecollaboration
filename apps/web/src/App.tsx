import axios from "axios";
import { useEffect, useRef } from "react";
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

  const isDark = theme === "dark";
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement | null>(null);

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

  // Realtime
  useEffect(() => {
    const socket = io();
    socket.on("message:new", (msg: Message) => {
      qc.setQueryData<Message[]>(["messages"], (curr = []) => [msg, ...(curr || [])]);
    });
    return () => {
      socket.disconnect();
    };
  }, [qc]);

  const messages: Message[] = Array.isArray(data) ? data : [];

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // helper: case-insensitive self check
  const isMine = (m: Message) => {
    const a = (author ?? "").trim().toLowerCase();
    const b = (m.author ?? "").trim().toLowerCase();
    return a.length > 0 && a === b;
  };

  return (
    <main className={`min-h-screen ${isDark ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-900"}`}>
      <div className="max-w-2xl mx-auto h-screen flex flex-col font-sans">
        {/* Header */}
        <header className={`flex items-center justify-between p-4 border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}>
          <h1 className="text-2xl font-bold">Realtime Chat</h1>
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`px-3 py-1.5 rounded-lg border ${isDark ? "border-gray-600 bg-gray-800 text-gray-100" : "border-gray-300 bg-white text-gray-900"}`}
            type="button"
          >
            Theme: {theme}
          </button>
        </header>

        {/* Messages */}
        <section className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && <div>Loading messages…</div>}

          {error && (
            <div className={`p-3 rounded-lg border ${isDark ? "border-red-400 bg-red-900/30 text-red-200" : "border-red-300 bg-red-50 text-red-800"}`}>
              Couldn’t reach API. Check that the API is running.
            </div>
          )}

          {!isLoading && !error && !Array.isArray(data) && (
            <div className={`p-3 rounded-lg border ${isDark ? "border-yellow-400 bg-yellow-900/30 text-yellow-200" : "border-yellow-300 bg-yellow-50 text-yellow-800"}`}>
              <strong>Unexpected response from /messages</strong>
              <pre className="whitespace-pre-wrap text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}

          <ul className="space-y-3">
            {messages.map((m) => {
              const mine = isMine(m);
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-xs rounded-lg px-3 py-2 ${
                      mine
                        ? "bg-indigo-600 text-white rounded-br-none"
                        : `${isDark ? "bg-gray-800 text-gray-100" : "bg-gray-200 text-gray-900"} rounded-bl-none`
                    }`}
                  >
                    <p className="text-sm font-semibold">{m.author}</p>
                    <p>{m.text}</p>
                    <div className="text-[10px] opacity-75 mt-1">
                      {new Date(m.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div ref={bottomRef} />
        </section>

        {/* Input Form (sticky footer) */}
        <section className={`sticky bottom-0 border-t p-4 ${isDark ? "bg-gray-900 border-gray-700" : "bg-gray-100 border-gray-200"}`}>
          <div className="grid gap-3">
            <input
              name="author"
              placeholder="Your name"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className={`px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500
                ${isDark ? "border-gray-600 bg-gray-800 text-gray-100 placeholder-gray-400" : "border-gray-300 bg-white text-gray-900 placeholder-gray-400"}`}
            />
            <input
              name="text"
              placeholder="Write a message…"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className={`px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500
                ${isDark ? "border-gray-600 bg-gray-800 text-gray-100 placeholder-gray-400" : "border-gray-300 bg-white text-gray-900 placeholder-gray-400"}`}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const text = draftText.trim();
                  const name = (author || "Anon").trim();
                  if (!text) return;
                  sendMessage.mutate({ text, author: name });
                }}
                disabled={sendMessage.isPending}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sendMessage.isPending ? "Sending…" : "Send"}
              </button>
              <button
                type="button"
                onClick={resetDraft}
                disabled={sendMessage.isPending}
                className={`inline-flex items-center justify-center px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed
                  ${isDark ? "border-gray-600 bg-gray-800 text-gray-100 hover:bg-gray-700" : "border-gray-300 bg-white text-gray-900"}`}
              >
                Clear
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
