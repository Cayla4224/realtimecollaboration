import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { createServer } from "http";
import { Server } from "socket.io";
import { EnvSchema, type Message } from "@your-app/shared";

dotenv.config();

// validate env
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const env = parsed.data;

const app = express();
app.use(cors()); // for Codespaces, allow any origin during dev
app.use(express.json());

// --- Socket.IO setup on the same HTTP server ---
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true } // allow any origin in dev; tighten later
});

// simple in-memory data
let messages: Message[] = [
  { id: "1", text: "Hello world", author: "System", createdAt: new Date().toISOString() }
];

// socket connections
io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);
  socket.on("disconnect", () => console.log("socket disconnected:", socket.id));
});

// routes
app.get("/", (_req, res) => {
  res.send('API is running. Try GET /health or /messages');
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/messages", (_req, res) => res.json(messages));

app.post("/messages", (req, res) => {
  const { text, author } = req.body ?? {};
  if (!text || !author) return res.status(400).json({ error: "text and author required" });

  const msg: Message = { id: randomUUID(), text, author, createdAt: new Date().toISOString() };
  messages.unshift(msg);

  // 🔊 broadcast to all connected clients
  io.emit("message:new", msg);

  res.status(201).json(msg);
});

// start
const port = Number(env.API_PORT) || 4000;
httpServer.listen(port, () => {
  console.log(`API + Socket.IO on http://localhost:${port}`);
});
