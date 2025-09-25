import { z } from "zod";

export const EnvSchema = z.object({
  VITE_API_URL: z.string().url().optional(),
  API_PORT: z.string().default("4000")
});

export type Message = {
  id: string;
  text: string;
  author: string;
  createdAt: string; // ISO date string
};
