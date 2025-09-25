import axios, { AxiosError } from "axios";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { useAppStore } from "./state/useAppStore";

/** API types */
type Room = { id: string; name: string; createdAt: string };
type Message = {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  roomId?: string | null;
};

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || undefined });

/* =========================
   Root App
   ========================= */
export default function App() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const isDark = theme === "dark";

  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [username, setUsername] = useState<string>(() => localStorage.getItem("username") || "");
  const screenName = useAppStore((s) => s.author);
  const setAuthor = useAppStore((s) => s.setAuthor);

  useEffect(() => {
    if (!screenName) {
      const saved = localStorage.getItem("author");
      if (saved) setAuthor(saved);
    }
  }, [screenName, setAuthor]);

  return (
    <main className={`min-h-screen ${isDark ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-900"}`}>
      <div className="max-w-3xl mx-auto min-h-screen flex flex-col font-sans">
        <header className={`flex items-center justify-between p-4 border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}>
          <h1 className="text-2xl font-bold">Realtime Chat</h1>

          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`px-3 py-1.5 rounded-lg border ${isDark ? "border-gray-600 bg-gray-800 text-gray-100" : "border-gray-300 bg-white text-gray-900"}`}
          >
            Theme: {theme}
          </button>
        </header>

        {!token ? (
          <AuthScreen
            isDark={isDark}
            onLoggedIn={(t, u) => {
              localStorage.setItem("token", t);
              localStorage.setItem("username", u);
              setUsername(u);
              setToken(t);
            }}
          />
        ) : !screenName ? (
          <ScreenNameScreen isDark={isDark} />
        ) : (
          <ChatScreen
            isDark={isDark}
            token={token}
            username={username}
            onLogout={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("username");
              setToken(null);
              useAppStore.getState().setAuthor("");
              localStorage.removeItem("author");
            }}
          />
        )}
      </div>
    </main>
  );
}

/* =========================
   ScreenName Screen
   ========================= */
function ScreenNameScreen({ isDark }: { isDark: boolean }) {
  const [name, setName] = useState("");
  const setAuthor = useAppStore((s) => s.setAuthor);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setAuthor(trimmed);
    localStorage.setItem("author", trimmed);
  };

  return (
    <section className="flex-1 grid place-items-center p-6">
      <div className={`w-full max-w-md rounded-xl p-6 shadow ${isDark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}>
        <h2 className="text-xl font-semibold mb-2">Set your screen name</h2>
        <p className="text-sm opacity-80 mb-4">This will be shown as the author of your messages.</p>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Callie, SkyRider99, etc."
            className={`px-3 py-2 rounded-lg border ${isDark ? "border-gray-600 bg-gray-900 text-gray-100" : "border-gray-300 bg-white text-gray-900"}`}
          />
          <button type="submit" className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
            Save & Continue
          </button>
        </form>
      </div>
    </section>
  );
}

/* =========================
   Auth Screen
   ========================= */
function AuthScreen({ isDark, onLoggedIn }: { isDark: boolean; onLoggedIn: (token: string, username: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const registerUser = useMutation({
    mutationFn: async (form: { username: string; password: string }) =>
      (await api.post("/auth/register", form)).data,
  });

  const loginUser = useMutation({
    mutationFn: async (form: { username: string; password: string }) =>
      (await api.post<{ token: string }>("/auth/login", form)).data,
    onSuccess: (res) => onLoggedIn(res.token, username),
  });

  const submitRegister = (e: FormEvent) => {
    e.preventDefault();
    if (username && password) registerUser.mutate({ username, password });
  };

  const submitLogin = (e: FormEvent) => {
    e.preventDefault();
    if (username && password) loginUser.mutate({ username, password });
  };

  const regErr = (registerUser.error as AxiosError)?.response?.data as any;
  const logErr = (loginUser.error as AxiosError)?.response?.data as any;

  return (
    <section className="flex-1 grid place-items-center p-6">
      <div className={`w-full max-w-md rounded-xl p-6 shadow ${isDark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}>
        <h2 className="text-xl font-semibold mb-2">Welcome</h2>
        <p className="text-sm opacity-80 mb-4">Create an account or log in to start chatting.</p>

        {/* Register */}
        <form onSubmit={submitRegister} className="grid gap-3 mb-6">
          <div className="text-sm font-medium">Register</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoComplete="username"
            className={`px-3 py-2 rounded-lg border ${isDark ? "border-gray-600 bg-gray-900 text-gray-100" : "border-gray-300 bg-white text-gray-900"}`}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            autoComplete="new-password"
            className={`px-3 py-2 rounded-lg border ${isDark ? "border-gray-600 bg-gray-900 text-gray-100" : "border-gray-300 bg-white text-gray-900"}`}
          />
          {registerUser.error && <div className="text-sm text-red-500">{regErr?.error || "Registration failed."}</div>}
          <button type="submit" disabled={registerUser.isPending} className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
            {registerUser.isPending ? "Registering…" : "Register"}
          </button>
        </form>

        {/* Login */}
        <form onSubmit={submitLogin} className="grid gap-3">
          <div className="text-sm font-medium">Login</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoComplete="username"
            className={`px-3 py-2 rounded-lg border ${isDark ? "border-gray-600 bg-gray-900 text-gray-100" : "border-gray-300 bg-white text-gray-900"}`}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            autoComplete="current-password"
            className={`px-3 py-2 rounded-lg border ${isDark ? "border-gray-600 bg-gray-900 text-gray-100" : "border-gray-300 bg-white text-gray-900"}`}
          />
          {loginUser.error && <div className="text-sm text-red-500">{logErr?.error || "Login failed."}</div>}
          <button type="submit" disabled={loginUser.isPending} className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-50">
            {loginUser.isPending ? "Logging in…" : "Login"}
          </button>
        </form>
      </div>
    </section>
  );
}

/* =========================
   Chat Screen
   ========================= */
function ChatScreen({
  isDark,
  token,
  username,
  onLogout,
}: {
  isDark: boolean;
  token: string;
  username: string;
  onLogout: () => void;
}) {
  const qc = useQueryClient();

  const author = useAppStore((s) => s.author);         // screen name
  const setAuthor = useAppStore((s) => s.setAuthor);
  const draftText = useAppStore((s) => s.draftText);
  const setDraftText = useAppStore((s) => s.setDraftText);
  const resetDraft = useAppStore((s) => s.resetDraft);

  useEffect(() => {
    if (!author) {
      const saved = localStorage.getItem("author");
      if (saved) setAuthor(saved);
    }
  }, [author, setAuthor]);

  // --- inline screen name editing ---
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(author || "");

  useEffect(() => {
    if (editingName) setTempName(author || "");
  }, [editingName, author]);

  const saveScreenName = () => {
    const n = tempName.trim();
    if (!n) return;
    setAuthor(n);
    localStorage.setItem("author", n);
    setEditingName(false);
  };

  const cancelEdit = () => {
    setTempName(author || "");
    setEditingName(false);
  };

  const authHeader = { Authorization: `Bearer ${token}` };

  // Rooms
  const roomsQ = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => (await api.get<Room[]>("/rooms")).data,
  });
  const rooms: Room[] = Array.isArray(roomsQ.data) ? roomsQ.data : [];

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(() => {
    return localStorage.getItem("selectedRoomId");
  });
  const [newRoomName, setNewRoomName] = useState("");

  useEffect(() => {
    if (!selectedRoomId && rooms.length > 0) {
      const general = rooms.find((r) => r.name?.toLowerCase() === "general");
      setSelectedRoomId((general ?? rooms[0]).id);
    }
  }, [rooms, selectedRoomId]);

  // persist selected room
  useEffect(() => {
    if (selectedRoomId) localStorage.setItem("selectedRoomId", selectedRoomId);
  }, [selectedRoomId]);

  const createRoom = useMutation({
    mutationFn: async (name: string) => (await api.post<Room>("/rooms", { name })).data,
    onSuccess: (room) => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      setSelectedRoomId(room.id);
      setNewRoomName("");
    },
  });

  // Messages
  const messagesQ = useQuery({
    queryKey: ["messages", { roomId: selectedRoomId ?? null }],
    queryFn: async () =>
      (await api.get<Message[]>("/messages", { params: { roomId: selectedRoomId ?? undefined } })).data,
    enabled: selectedRoomId !== null,
  });
  const messages: Message[] = Array.isArray(messagesQ.data) ? messagesQ.data : [];

  const sendMessage = useMutation({
    mutationFn: async (payload: Pick<Message, "text" | "author"> & { roomId?: string | null }) =>
      (await api.post<Message>("/messages", payload, { headers: authHeader })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      resetDraft();
    },
  });

  // Socket.IO (FIXED cleanup function)
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const socket = io();
    if (selectedRoomId) socket.emit("room:join", selectedRoomId);

    const handler = (msg: Message) => {
      const current = selectedRoomId ?? null;
      if ((msg.roomId ?? null) !== current) return;
      qc.setQueryData<Message[]>(["messages", { roomId: current }], (curr = []) => [msg, ...curr]);
    };

    socket.on("message:new", handler);

    return () => {
      socket.off("message:new", handler);
      socket.disconnect();
    };
  }, [selectedRoomId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isMine = (m: Message) =>
    (author || "").trim().toLowerCase() === (m.author || "").trim().toLowerCase();

  const currentRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  return (
    <>
      {/* Chat header bar: room selector + screen name + logout */}
      <div className={`p-3 flex flex-wrap gap-3 items-center ${isDark ? "bg-gray-900" : "bg-gray-100"} border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-80">Room:</span>
          <select
            value={selectedRoomId ?? ""}
            onChange={(e) => setSelectedRoomId(e.target.value || null)}
            className={`text-sm px-2 py-1 rounded border ${isDark ? "border-gray-600 bg-gray-800 text-gray-100" : "border-gray-300 bg-white text-gray-900"}`}
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="ms-auto flex items-center gap-2">
          {/* Screen name inline edit */}
          {!editingName ? (
            <>
              <span className="text-sm opacity-80">
                Screen name: <strong>{author || "(unset)"}</strong>
              </span>
              <button
                onClick={() => setEditingName(true)}
                className={`px-2 py-1 rounded-md border text-sm ${isDark ? "border-gray-600 bg-gray-800 hover:bg-gray-700" : "border-gray-300 bg-white hover:bg-gray-50"}`}
              >
                Edit
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className={`px-2 py-1 rounded-md border text-sm ${isDark ? "border-gray-600 bg-gray-800 text-gray-100" : "border-gray-300 bg-white text-gray-900"}`}
                placeholder="New screen name"
                autoFocus
              />
              <button onClick={saveScreenName} className="px-2 py-1 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700">
                Save
              </button>
              <button
                onClick={cancelEdit}
                className={`px-2 py-1 rounded-md border text-sm ${isDark ? "border-gray-600 bg-gray-800 hover:bg-gray-700" : "border-gray-300 bg-white hover:bg-gray-50"}`}
              >
                Cancel
              </button>
            </div>
          )}

          <span className="hidden sm:inline text-sm opacity-60 mx-2">|</span>

          <span className="text-sm opacity-80 hidden sm:inline">User: <strong>{username}</strong></span>

          <button
            onClick={onLogout}
            className={`px-3 py-1.5 rounded-lg border ${isDark ? "border-gray-600 bg-gray-800 text-gray-100 hover:bg-gray-700" : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50"}`}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Create room */}
      <div className={`p-3 flex gap-2 items-center ${isDark ? "bg-gray-900" : "bg-gray-100"} border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}>
        <input
          value={newRoomName}
          onChange={(e) => setNewRoomName(e.target.value)}
          placeholder="New room name…"
          className={`px-3 py-2 rounded-lg border flex-1 ${isDark ? "border-gray-600 bg-gray-800 text-gray-100" : "border-gray-300 bg-white text-gray-900"}`}
        />
        <button
          onClick={() => {
            const name = newRoomName.trim();
            if (name) createRoom.mutate(name);
          }}
          disabled={createRoom.isPending}
          className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {createRoom.isPending ? "Creating…" : "Create room"}
        </button>
      </div>

      {/* Messages */}
      <section className="flex-1 overflow-y-auto p-4 space-y-3">
        {!currentRoom && rooms.length === 0 && <div className="text-sm opacity-80">No rooms yet. Create one above.</div>}
        {messages.length === 0 && currentRoom && (
          <div className="text-sm opacity-70">No messages in <strong>{currentRoom.name}</strong> yet. Say hi! 👋</div>
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

      {/* Composer */}
      <section className={`sticky bottom-0 border-t p-4 ${isDark ? "bg-gray-900 border-gray-700" : "bg-gray-100 border-gray-200"}`}>
        <div className="grid gap-3">
          <div className="flex gap-2">
            <input
              name="text"
              placeholder={currentRoom ? `Message #${currentRoom.name}` : "Write a message…"}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className={`flex-1 px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500
                ${isDark ? "border-gray-600 bg-gray-800 text-gray-100 placeholder-gray-400" : "border-gray-300 bg-white text-gray-900 placeholder-gray-400"}`}
            />
            <button
              type="button"
              onClick={() => {
                const text = draftText.trim();
                const name = (author || "Anon").trim();
                if (!text || !selectedRoomId) return;
                void sendMessage.mutate({ text, author: name, roomId: selectedRoomId });
              }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
