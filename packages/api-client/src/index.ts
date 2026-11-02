import type { components } from "./schema";
export type User = components["schemas"]["UserOut"];
export type Report = components["schemas"]["ReportOut"];
export type ReportDetail = components["schemas"]["ReportDetail"];
export type ReportPage = components["schemas"]["ReportPage"];
export type UserPage = components["schemas"]["UserPage"];
export type Dashboard = components["schemas"]["DashboardOut"];
export type Prediction = components["schemas"]["PredictionOut"];
export type AuthResult = components["schemas"]["AuthOut"];
export type Category = Report["category"];
export type Status = Report["status"];
export const categories: Record<Category, string> = {
  organic: "Organik",
  plastic: "Plastik",
  paper: "Kertas",
};
export const categoryDescriptions: Record<Category, string> = {
  organic: "Organic Waste",
  plastic: "Plastic Waste",
  paper: "Paper Waste",
};
export const statuses: Record<Status, string> = {
  pending: "Menunggu",
  in_progress: "Diproses",
  completed: "Selesai",
  rejected: "Ditolak",
};
export const transitions: Record<Status, Status[]> = {
  pending: ["in_progress", "rejected"],
  in_progress: ["completed", "rejected"],
  completed: [],
  rejected: [],
};
export type Tokens = { access: string; refresh: string };
type Options = {
  baseUrl: string;
  mobile?: boolean;
  getTokens?: () => Promise<Tokens | null>;
  setTokens?: (tokens: Tokens | null) => Promise<void>;
  onUnauthorized?: () => void;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiClient {
  private refreshing: Promise<boolean> | null = null;
  constructor(private options: Options) {}
  get baseUrl() {
    return this.options.baseUrl.replace(/\/$/, "");
  }
  async headers(json = true): Promise<Record<string, string>> {
    const headers: Record<string, string> = json
      ? { "Content-Type": "application/json" }
      : {};
    if (this.options.mobile) {
      headers["X-Client-Type"] = "mobile";
      const tokens = await this.options.getTokens?.();
      if (tokens) headers.Authorization = `Bearer ${tokens.access}`;
    } else if (typeof document !== "undefined") {
      const csrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("sw_csrf="))
        ?.split("=")[1];
      if (csrf) headers["X-CSRF-Token"] = decodeURIComponent(csrf);
    }
    return headers;
  }
  private async saveAuth(result: AuthResult) {
    if (this.options.mobile && result.access_token && result.refresh_token) {
      await this.options.setTokens?.({
        access: result.access_token,
        refresh: result.refresh_token,
      });
    }
  }
  private async refresh(): Promise<boolean> {
    if (!this.refreshing)
      this.refreshing = (async () => {
        try {
          const tokens = await this.options.getTokens?.();
          const response = await fetch(`${this.baseUrl}/auth/refresh`, {
            method: "POST",
            credentials: this.options.mobile ? "omit" : "include",
            headers: await this.headers(),
            body: JSON.stringify(
              this.options.mobile ? { refresh_token: tokens?.refresh } : {},
            ),
          });
          if (!response.ok) return false;
          await this.saveAuth(await response.json());
          return true;
        } catch {
          return false;
        }
      })().finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }
  async request<T>(
    path: string,
    init: RequestInit = {},
    retry = true,
  ): Promise<T> {
    const headers = new Headers(
      await this.headers(!(init.body instanceof FormData)),
    );
    new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        credentials: this.options.mobile ? "omit" : "include",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new ApiError(
        0,
        "Tidak dapat terhubung ke server. Periksa koneksi dan coba lagi.",
      );
    }
    if (response.status === 401 && retry && !path.startsWith("/auth/")) {
      if (await this.refresh()) return this.request<T>(path, init, false);
      await this.options.setTokens?.(null);
      this.options.onUnauthorized?.();
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const fields = body.errors
        ?.map(
          (e: { field: string; message: string }) =>
            `${e.field.replace("body.", "")}: ${e.message}`,
        )
        .join("; ");
      throw new ApiError(
        response.status,
        fields ||
          (typeof body.detail === "string" ? body.detail : "Permintaan gagal"),
      );
    }
    return response.status === 204 ? (undefined as T) : response.json();
  }
  async me(): Promise<User> {
    try {
      return await this.request<User>("/auth/me", {}, false);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        (await this.refresh())
      )
        return this.request<User>("/auth/me", {}, false);
      if (error instanceof ApiError && error.status === 401) {
        await this.options.setTokens?.(null);
        this.options.onUnauthorized?.();
      }
      throw error;
    }
  }
  async authenticate(
    kind: "login" | "register",
    body: { email: string; password: string; name?: string },
  ) {
    const result = await this.request<AuthResult>(`/auth/${kind}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    await this.saveAuth(result);
    return result.user;
  }
  async logout() {
    const tokens = await this.options.getTokens?.();
    try {
      await this.request(
        "/auth/logout",
        {
          method: "POST",
          body: JSON.stringify(
            this.options.mobile ? { refresh_token: tokens?.refresh } : {},
          ),
        },
        false,
      );
    } finally {
      await this.options.setTokens?.(null);
    }
  }
}

export function mapUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan. Silakan coba lagi.";
}
