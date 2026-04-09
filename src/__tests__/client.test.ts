import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAllFlags, fetchFlag, connectSSE } from "../client";
import type { FlagBridgeConfig } from "../types";

const config: FlagBridgeConfig = {
  apiKey: "fb_sk_eval_test",
  apiUrl: "https://api.flagbridge.io",
  environment: "production",
  project: "test-project",
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchAllFlags", () => {
  it("fetches and flattens batch evaluation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          flags: {
            "dark-mode": { value: true, reason: "default" },
            "hero-text": { value: "Welcome", reason: "rule-match" },
          },
        }),
        { status: 200 },
      ),
    );

    const flags = await fetchAllFlags(config);

    expect(flags).toEqual({
      "dark-mode": true,
      "hero-text": "Welcome",
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.flagbridge.io/v1/evaluate/batch",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer fb_sk_eval_test",
        }),
      }),
    );
  });

  it("throws on non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );

    await expect(fetchAllFlags(config)).rejects.toThrow("batch evaluate failed (500)");
  });

  it("passes context when provided", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ flags: {} }), { status: 200 }),
    );

    await fetchAllFlags({ ...config, context: { userId: "u1" } });

    const body = JSON.parse(
      (vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.context).toEqual({ userId: "u1" });
  });
});

describe("fetchFlag", () => {
  it("fetches a single flag value", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ value: "variant-b", reason: "rule-match" }),
        { status: 200 },
      ),
    );

    const value = await fetchFlag(config, "hero-variant");

    expect(value).toBe("variant-b");

    const body = JSON.parse(
      (vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.flag_key).toBe("hero-variant");
    expect(body.project).toBe("test-project");
    expect(body.environment).toBe("production");
  });

  it("throws on non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );

    await expect(fetchFlag(config, "missing")).rejects.toThrow(
      'evaluate failed for "missing" (404)',
    );
  });

  it("passes override context when provided", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ value: true, reason: "default" }), {
        status: 200,
      }),
    );

    await fetchFlag(config, "flag-1", { plan: "pro" });

    const body = JSON.parse(
      (vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.context).toEqual({ plan: "pro" });
  });
});

describe("connectSSE", () => {
  let disconnect: (() => void) | undefined;

  afterEach(() => {
    disconnect?.();
    disconnect = undefined;
  });

  it("connects to the SSE endpoint with correct URL and auth", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new ReadableStream(), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    disconnect = connectSSE(config, vi.fn(), vi.fn());

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.flagbridge.io/v1/sse/production",
      expect.objectContaining({
        headers: { Authorization: "Bearer fb_sk_eval_test" },
      }),
    );
  });

  it("parses flag.updated events and calls onFlagUpdated", async () => {
    const onFlagUpdated = vi.fn();
    const sseData = [
      'event: flag.updated\n',
      'data: {"flag_key":"dark-mode"}\n',
      '\n',
    ].join("");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseData));
        // Don't close — keep stream alive
      },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    disconnect = connectSSE(config, onFlagUpdated, vi.fn());

    await vi.waitFor(() => {
      expect(onFlagUpdated).toHaveBeenCalledWith("dark-mode");
    });
  });

  it("calls onError when SSE connection fails", async () => {
    const onError = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    disconnect = connectSSE(config, vi.fn(), onError);

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("401"),
        }),
      );
    });
  });

  it("cleans up on disconnect", () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new ReadableStream(), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    disconnect = connectSSE(config, vi.fn(), vi.fn());
    disconnect();
    disconnect = undefined;

    // Should not throw or cause issues after disconnect
  });
});
