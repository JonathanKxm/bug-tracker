// functions/lib/audit.ts - 审计日志写入工具

import type { Env } from "../types";

export interface AuditRecord {
  actorId: number;
  action: string;
  targetType: "user" | "project" | "bug";
  targetId: number;
  details?: Record<string, unknown> | null;
}

export async function record(env: Env, rec: AuditRecord): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      rec.actorId,
      rec.action,
      rec.targetType,
      rec.targetId,
      rec.details ? JSON.stringify(rec.details) : null,
      Date.now(),
    )
    .run();
}
