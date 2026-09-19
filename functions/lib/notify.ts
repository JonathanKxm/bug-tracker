// functions/lib/notify.ts - 通知触发器 (站内 + Email)

import type { Env } from "../types";

interface NotifyInput {
  type:
    | "bug_assigned"
    | "bug_status_changed"
    | "bug_commented"
    | "bug_reopened";
  bugId: number;
  actorId: number;
  recipientIds: number[];
  title: string;
  body?: string;
}

export async function notify(env: Env, input: NotifyInput): Promise<void> {
  const now = Date.now();
  const recipients = input.recipientIds.filter((id) => id !== input.actorId);
  if (!recipients.length) return;

  const insert = env.DB.prepare(
    `INSERT INTO notifications (user_id, type, bug_id, actor_id, title, body, read_at, email_sent_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
  );

  const statements = recipients.map((uid) =>
    insert.bind(uid, input.type, input.bugId, input.actorId, input.title, input.body ?? null, now),
  );
  await env.DB.batch(statements);

  // 邮件: 异步 fire-and-forget,失败不影响主流程
  const envAny = env as unknown as { EMAIL?: { send: (m: { from: string; to: string; subject: string; text: string }) => Promise<void> }; waitUntil?: (p: Promise<unknown>) => void };
  if (envAny.EMAIL && typeof envAny.EMAIL.send === "function") {
    envAny.waitUntil?.(sendEmails(env, input));
  }
}

async function sendEmails(env: Env, input: NotifyInput): Promise<void> {
  const users = await env.DB.prepare(
    `SELECT u.id, u.email, u.email_notify_enabled
     FROM users u
     WHERE u.id IN (${input.recipientIds.filter((id) => id !== input.actorId).map(() => "?").join(",") || "NULL"})
       AND u.email_notify_enabled = 1`,
  )
    .bind(...input.recipientIds.filter((id) => id !== input.actorId))
    .all<{ id: number; email: string }>();

  for (const u of users.results ?? []) {
    try {
      await env.EMAIL!.send({
        from: "Bug Tracker <noreply@bug-tracker.example.com>",
        to: u.email,
        subject: input.title,
        text: `${input.body ?? ""}\n\n查看: https://bug-tracker.example.com/bugs/${input.bugId}`,
      });
      await env.DB.prepare(
        "UPDATE notifications SET email_sent_at = ? WHERE user_id = ? AND bug_id = ? AND email_sent_at IS NULL",
      )
        .bind(Date.now(), u.id, input.bugId)
        .run();
    } catch (e) {
      console.error(`email send failed for ${u.email}`, e);
    }
  }
}

/**
 * 计算状态变更需要通知的用户集合:
 *   - reporter (提单人)
 *   - assignee (当前被指派人,新指派人或原指派人)
 *   - 订阅者 (bug_subscriptions)
 */
export async function getStatusChangeRecipients(
  env: Env,
  bugId: number,
  newAssigneeId: number | null,
): Promise<number[]> {
  const ids = new Set<number>();

  const bug = await env.DB.prepare(
    "SELECT reporter_id, assignee_id FROM bugs WHERE id = ?",
  )
    .bind(bugId)
    .first<{ reporter_id: number; assignee_id: number | null }>();
  if (!bug) return [];

  // 验证现有用户才加入收件人
  const candidateIds: number[] = [bug.reporter_id];
  if (bug.assignee_id) candidateIds.push(bug.assignee_id);
  if (newAssigneeId) candidateIds.push(newAssigneeId);
  if (candidateIds.length) {
    const existing = await env.DB.prepare(
      `SELECT id FROM users WHERE id IN (${candidateIds.map(() => "?").join(",")})`,
    ).bind(...candidateIds).all<{ id: number }>();
    for (const e of existing.results ?? []) ids.add(e.id);
  }

  const subs = await env.DB.prepare(
    "SELECT user_id FROM bug_subscriptions WHERE bug_id = ?",
  )
    .bind(bugId)
    .all<{ user_id: number }>();
  for (const s of subs.results ?? []) ids.add(s.user_id);

  return Array.from(ids);
}
