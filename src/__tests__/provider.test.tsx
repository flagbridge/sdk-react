import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FlagBridgeProvider } from "../provider";
import { useFlag, useFlagBridge } from "../hooks";

const mockFlags = {
  flags: {
    "waitlist-open": { value: true, reason: "rule-match" },
    "hero-variant": { value: "default", reason: "default" },
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/evaluate/batch")) {
      return new Response(JSON.stringify(mockFlags), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/sse/")) {
      // Return a never-ending stream to simulate SSE
      return new Response(new ReadableStream(), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }

    return new Response("Not found", { status: 404 });
  });
}

const providerProps = {
  apiKey: "fb_sk_eval_test",
  apiUrl: "https://api.flagbridge.io",
  environment: "production",
  project: "test-project",
};

describe("FlagBridgeProvider", () => {
  it("renders children", async () => {
    mockFetch();

    render(
      <FlagBridgeProvider {...providerProps}>
        <div data-testid="child">Hello</div>
      </FlagBridgeProvider>,
    );

    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("fetches flags on mount and provides them via context", async () => {
    mockFetch();

    function FlagDisplay() {
      const { flags, isLoading } = useFlagBridge();
      if (isLoading) return <div data-testid="loading">Loading</div>;
      return <div data-testid="flags">{JSON.stringify(flags)}</div>;
    }

    render(
      <FlagBridgeProvider {...providerProps}>
        <FlagDisplay />
      </FlagBridgeProvider>,
    );

    expect(screen.getByTestId("loading")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId("flags").textContent).toBe(
        JSON.stringify({ "waitlist-open": true, "hero-variant": "default" }),
      );
    });
  });

  it("calls onError when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/evaluate/batch")) {
        return new Response("Internal Server Error", { status: 500 });
      }

      if (url.includes("/sse/")) {
        return new Response(new ReadableStream(), {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }

      return new Response("Not found", { status: 404 });
    });

    const onError = vi.fn();

    function ErrorDisplay() {
      const { error, isLoading } = useFlagBridge();
      if (isLoading) return <div data-testid="loading">Loading</div>;
      return <div data-testid="error">{error?.message ?? "none"}</div>;
    }

    render(
      <FlagBridgeProvider {...providerProps} onError={onError}>
        <ErrorDisplay />
      </FlagBridgeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toContain("500");
    });

    expect(onError).toHaveBeenCalled();
  });
});
