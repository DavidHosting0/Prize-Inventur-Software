export type ApiError = {
  error: string;
  code?: string;
  details?: unknown;
};

export class PrizeApiClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(
    path: string,
    init?: RequestInit
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      credentials: "include",
    });

    if (!res.ok) {
      let body: ApiError = { error: res.statusText };
      try {
        body = (await res.json()) as ApiError;
      } catch {
        /* ignore */
      }
      throw Object.assign(new Error(body.error || "Request failed"), {
        status: res.status,
        code: body.code,
        details: body.details,
      });
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }
}

export function createApiClient(baseUrl = "/api/v1") {
  return new PrizeApiClient(baseUrl);
}
