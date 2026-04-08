import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FlagBridgeProvider } from "../provider";
import { useFlag, useFlagBridge } from "../hooks";

const mockFlags = {
  flags: {
    "waitlist-open": { value: true, reason: "rule-match" },
    "hero-variant": { value: "banner-b", reason: "rule-match" },
    "max-items": { value: 42, reason: "default" },
  },
};

beforeEach(() => {
  vi.restoreAllMocks();

  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/evaluate/batch")) {
      return new Response(JSON.stringify(mockFlags), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/sse/")) {
      return new Response(new ReadableStream(), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }

    return new Response("Not found", { status: 404 });
  });
});

const providerProps = {
  apiKey: "fb_sk_eval_test",
  apiUrl: "https://api.flagbridge.io",
  environment: "production",
  project: "test-project",
};

describe("useFlag", () => {
  it("returns default value while loading", () => {
    function TestComponent() {
      const value = useFlag("waitlist-open", false);
      return <div data-testid="flag">{String(value)}</div>;
    }

    render(
      <FlagBridgeProvider {...providerProps}>
        <TestComponent />
      </FlagBridgeProvider>,
    );

    expect(screen.getByTestId("flag").textContent).toBe("false");
  });

  it("returns flag value after loading", async () => {
    function TestComponent() {
      const value = useFlag("waitlist-open", false);
      return <div data-testid="flag">{String(value)}</div>;
    }

    render(
      <FlagBridgeProvider {...providerProps}>
        <TestComponent />
      </FlagBridgeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("flag").textContent).toBe("true");
    });
  });

  it("returns string flag values", async () => {
    function TestComponent() {
      const value = useFlag<string>("hero-variant", "default");
      return <div data-testid="flag">{value}</div>;
    }

    render(
      <FlagBridgeProvider {...providerProps}>
        <TestComponent />
      </FlagBridgeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("flag").textContent).toBe("banner-b");
    });
  });

  it("returns number flag values", async () => {
    function TestComponent() {
      const value = useFlag<number>("max-items", 10);
      return <div data-testid="flag">{value}</div>;
    }

    render(
      <FlagBridgeProvider {...providerProps}>
        <TestComponent />
      </FlagBridgeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("flag").textContent).toBe("42");
    });
  });

  it("returns false as default when no defaultValue provided", () => {
    function TestComponent() {
      const value = useFlag("unknown-flag");
      return <div data-testid="flag">{String(value)}</div>;
    }

    render(
      <FlagBridgeProvider {...providerProps}>
        <TestComponent />
      </FlagBridgeProvider>,
    );

    expect(screen.getByTestId("flag").textContent).toBe("false");
  });
});

describe("useFlagBridge", () => {
  it("throws when used outside provider", () => {
    function TestComponent() {
      useFlagBridge();
      return null;
    }

    expect(() => render(<TestComponent />)).toThrow(
      "useFlagBridge must be used within a <FlagBridgeProvider>",
    );
  });
});
