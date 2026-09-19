// 简单 api fetch 封装,自动附加 JSON

const BASE = "";

async function safeJson(res: Response): Promise<any> {
  return await res.json().catch(() => ({}));
}

export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const url = new URL(BASE + path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, String(item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const res = await fetch(url.toString(), { credentials: "same-origin" });
  if (!res.ok) {
    const data = await safeJson(res);
    const message = data?.error?.message ?? `HTTP ${res.status}`;
    const code = data?.error?.code ?? "ERR";
    throw Object.assign(new Error(message), { code, status: res.status });
  }
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw Object.assign(new Error(data?.error?.message ?? `HTTP ${res.status}`), {
      code: data?.error?.code ?? "ERR",
      status: res.status,
    });
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw Object.assign(new Error(data?.error?.message ?? `HTTP ${res.status}`), {
      code: data?.error?.code ?? "ERR",
      status: res.status,
    });
  }
  return res.json();
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw Object.assign(new Error(data?.error?.message ?? `HTTP ${res.status}`), {
      code: data?.error?.code ?? "ERR",
      status: res.status,
    });
  }
  return res.json();
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { method: "DELETE", credentials: "same-origin" });
  if (!res.ok) {
    const data = await safeJson(res);
    throw Object.assign(new Error(data?.error?.message ?? `HTTP ${res.status}`), {
      code: data?.error?.code ?? "ERR",
      status: res.status,
    });
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export async function uploadFile(path: string, file: File): Promise<unknown> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(BASE + path, { method: "POST", credentials: "same-origin", body: fd });
  if (!res.ok) {
    const data = await safeJson(res);
    throw Object.assign(new Error(data?.error?.message ?? `HTTP ${res.status}`), {
      code: data?.error?.code ?? "ERR",
      status: res.status,
    });
  }
  return res.json();
}
