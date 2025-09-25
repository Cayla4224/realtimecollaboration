import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { EnvSchema, type Message } from "@your-app/shared";

dotenv.config();

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const env = parsed.data;

const prisma = new PrismaClient();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true }
});

// socket connections
io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);
  socket.on("disconnect", () => console.log("socket disconnected:", socket.id));
});

// routes
app.get("/", (_req, res) => {
  res.send("API is running. Try GET /health or /messages");
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// get all messages (latest first)
app.get("/messages", async (_req, res) => {
  const msgs = await prisma.message.findMany({
    orderBy: { createdAt: "desc" }
  });
  res.json(msgs);
});

// create a new message
app.post("/messages", async (req, res) => {
  const { text, author } = req.body ?? {};
  if (!text || !author) return res.status(400).json({ error: "text and author required" });

  const msg = await prisma.message.create({
    data: { text, author }
  });

  io.emit("message:new", msg);
  res.status(201).json(msg);
});

const port = Number(env.API_PORT) || 4000;
httpServer.listen(port, () => {
  console.log(`API + Socket.IO + Prisma on http://localhost:${port}`);
});
