
import { API_BASE_URL } from "./config";

const BASE_URL = API_BASE_URL;

export function normalizeDateParam(s: string): string {
  return s.replace("T", " ").split(".")[0];
}

async function handle(res: Response) {
  if (res.ok) {
    return res.json();
  }

  let message: string | null = null;

  try {
    const data = await res.clone().json() as any;

    if (data && typeof data === "object") {
      if (typeof data.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data.detail) && data.detail[0]?.msg) {
        message = String(data.detail[0].msg);
      }
    }
  } catch {
  }

  if (!message) {
    try {
      const txt = await res.text();
      if (txt) {
        message = txt.slice(0, 400);
      }
    } catch {
    }
  }

  if (!message) {
    message = "Request failed";
  }

  throw new Error(message);
}


async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  return handle(res);
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handle(res);
}

async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { method: "DELETE" });
  return handle(res);
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle(res);
}


export { apiGet, apiPost, apiDelete, apiPut };
