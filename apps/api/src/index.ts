import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { EnvSchema } from "@your-app/shared";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

// ---- Env (API_PORT is validated by shared schema) ----
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const env = parsed.data;

// For demo only — replace in production / move to proper config
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

const prisma = new PrismaClient();

const app = express();
app.use(cors()); // in Codespaces, any origin during dev is fine
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });

/* --------------------------------------
   Boot: ensure a default "General" room
---------------------------------------*/
async function ensureDefaultRoom() {
  const name = "General";
  const exists = await prisma.room.findFirst({ where: { name } });
  if (!exists) {
    await prisma.room.create({ data: { name } });
    console.log(`Seeded default room: ${name}`);
  }
}
ensureDefaultRoom().catch(console.error);

/* --------------------------------------
   Socket.IO (room membership + events)
---------------------------------------*/
io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  // Client selects a room to receive room-scoped events
  socket.on("room:join", (roomId: string) => {
    try {
      if (typeof roomId === "string" && roomId.length > 0) {
        // leave previous rooms (except its own room)
        for (const r of socket.rooms) if (r !== socket.id) socket.leave(r);
        socket.join(roomId);
        console.log(`socket ${socket.id} joined room ${roomId}`);
      }
    } catch (e) {
      console.error("room:join error", e);
    }
  });

  socket.on("disconnect", () => console.log("socket disconnected:", socket.id));
});

/* --------------------------------------
   Helpers: demo auth middleware
---------------------------------------*/
function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
    if (!token) return res.status(401).json({ error: "missing bearer token" });
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; username: string };
    // attach minimal user info to request (no TS augmentation needed)
    (req as any).user = { id: payload.sub, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

/* --------------------------------------
   REST: basic
---------------------------------------*/
app.get("/", (_req, res) => {
  res.send("API is running. Try GET /health, /rooms, or /messages?roomId=...");
});

app.get("/health", (_req, res) => res.json({ ok: true }));

/* --------------------------------------
   AUTH (demo): register + login
---------------------------------------*/
// Register: { username, password }
app.post("/auth/register", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return res.status(400).json({ error: "username taken" });

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { username, passwordHash: hash } });

  res.status(201).json({ id: user.id, username: user.username });
});

// Login: { username, password } -> { token }
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(401).json({ error: "invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });

  const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
});

/* --------------------------------------
   Rooms
---------------------------------------*/
// List rooms
app.get("/rooms", async (_req, res) => {
  const rooms = await prisma.room.findMany({ orderBy: { createdAt: "asc" } });
  res.json(rooms);
});

// Create (or return existing by unique name)
app.post("/rooms", async (req, res) => {
  const nameRaw = (req.body?.name ?? "") as string;
  const name = nameRaw.trim();
  if (!name) return res.status(400).json({ error: "name required" });

  const room = await prisma.room.upsert({
    where: { name },
    update: {},
    create: { name }
  });
  res.status(201).json(room);
});

/* --------------------------------------
   Messages (room-scoped)
---------------------------------------*/
// GET /messages?roomId=<id>
// If roomId omitted -> legacy messages with no room (null)
app.get("/messages", async (req, res) => {
  const roomId = (req.query.roomId as string | undefined)?.trim();
  const msgs = await prisma.message.findMany({
    where: roomId ? { roomId } : { roomId: null },
    orderBy: { createdAt: "desc" }
  });
  res.json(msgs);
});

// POST /messages  { text, author, roomId? }  (auth required)
app.post("/messages", authMiddleware, async (req, res) => {
  const { text, author, roomId } = req.body ?? {};
  if (!text || !author) return res.status(400).json({ error: "text and author required" });

  // optional roomId, if present ensure it exists
  let data: { text: string; author: string; roomId?: string | null } = { text, author };
  if (typeof roomId === "string" && roomId.trim().length > 0) {
    const room = await prisma.room.findUnique({ where: { id: roomId.trim() } });
    if (!room) return res.status(400).json({ error: "invalid roomId" });
    data.roomId = room.id;
  } else {
    data.roomId = null;
  }

  const msg = await prisma.message.create({ data });

  // realtime: to room only (if set) otherwise broadcast
  if (msg.roomId) io.to(msg.roomId).emit("message:new", msg);
  else io.emit("message:new", msg);

  res.status(201).json(msg);
});

/* --------------------------------------
   Start
---------------------------------------*/
const port = Number(env.API_PORT) || 4000;
httpServer.listen(port, () => {
  console.log(`API + Socket.IO + Prisma (rooms + auth) on http://localhost:${port}`);
});
