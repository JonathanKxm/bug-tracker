// functions/lib/handler.ts - 统一 handler 助手

import type { Env } from "../types";

export interface Ctx {
  request: Request;
  env: Env;
  user: { id: number; role: string; email: string };
  params: Record<string, string>;
}

export function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(headers ?? {}),
    },
  });
}

export function err(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

export function getUser(env: Env): { id: number; role: string; email: string } {
  const u = (env as unknown as { _user?: { id: number; role: string; email: string } })._user;
  if (!u) throw new Error("auth middleware missing");
  return u;
}
