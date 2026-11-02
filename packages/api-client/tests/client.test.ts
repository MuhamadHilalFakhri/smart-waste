import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError, mapUrl } from "../src";
afterEach(() => vi.unstubAllGlobals());
describe("API transport", () => {
  it("shares one refresh across concurrent expired requests", async () => {
    let fresh = false;
    let refreshCount = 0;
    let token = { access: "old", refresh: "refresh-old" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/auth/refresh")) {
          refreshCount++;
          await new Promise((r) => setTimeout(r, 10));
          fresh = true;
          return Response.json({
            access_token: "new",
            refresh_token: "refresh-new",
          });
        }
        return fresh
          ? Response.json({ ok: true })
          : Response.json({ detail: "expired" }, { status: 401 });
      }),
    );
    const api = new ApiClient({
      baseUrl: "https://example.test/api/v1",
      mobile: true,
      getTokens: async () => token,
      setTokens: async (t) => {
        if (t) token = t;
      },
    });
    const responses = await Promise.all([
      api.request("/reports"),
      api.request("/dashboard"),
    ]);
    expect(responses).toEqual([{ ok: true }, { ok: true }]);
    expect(refreshCount).toBe(1);
    expect(token.access).toBe("new");
  });
  it("does not refresh a bad login", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        { detail: "Email atau password tidak sesuai" },
        { status: 401 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new ApiClient({ baseUrl: "/api/v1" });
    await expect(
      api.authenticate("login", { email: "x@y.com", password: "bad" }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("handles a bodyless archive response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    expect(
      await new ApiClient({ baseUrl: "/api/v1" }).request("/reports/id", {
        method: "DELETE",
      }),
    ).toBeUndefined();
  });
  it("provides a network error instead of raw fetch details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await expect(
      new ApiClient({ baseUrl: "/api/v1" }).request("/reports"),
    ).rejects.toThrow("Tidak dapat terhubung");
  });
});
it("encodes coordinates in a Maps URL", () => {
  expect(mapUrl(-6.2, 106.8)).toBe(
    "https://www.google.com/maps/search/?api=1&query=-6.2%2C106.8",
  );
});
