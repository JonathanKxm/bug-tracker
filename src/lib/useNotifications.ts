import { useEffect, useState, useCallback } from "react";
import { apiGet } from "@/lib/api";

interface NotificationState {
  items: any[];
  unread: number;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications(): NotificationState {
  const [state, setState] = useState<NotificationState>({
    items: [],
    unread: 0,
    refresh: async () => undefined,
    markAllRead: async () => undefined,
  });

  useEffect(() => {
    // 触发首次刷新
    apiGet("/api/notifications").then((data: any) => {
      setState((s) => ({ ...s, items: data.items, unread: data.unread }));
    }).catch(() => undefined);

    // 轮询 30s
    const t = setInterval(async () => {
      try {
        const data = await apiGet<{ items: any[]; unread: number }>("/api/notifications");
        setState((s) => ({ ...s, items: data.items, unread: data.unread }));
      } catch {
        /* ignore */
      }
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet<{ items: any[]; unread: number }>("/api/notifications");
      setState((s) => ({ ...s, items: data.items, unread: data.unread }));
    } catch {
      /* ignore */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    await refresh();
  }, [refresh]);

  return { ...state, refresh, markAllRead };
}
