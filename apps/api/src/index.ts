import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
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
app.use(cors());
app.use(express.json());

// simple in-memory data
let messages: Message[] = [
  { id: "1", text: "Hello world", author: "System", createdAt: new Date().toISOString() }
];

// friendly root
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
  res.status(201).json(msg);
});

const port = Number(env.API_PORT) || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
