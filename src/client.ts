import type { FlagBridgeConfig, EvalContext } from "./types";

interface BatchEvalResponse {
  flags: Record<string, { value: unknown; reason: string; ruleId?: string }>;
}

interface SingleEvalResponse {
  value: unknown;
  reason: string;
  ruleId?: string;
}

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export async function fetchAllFlags(
  config: FlagBridgeConfig,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${config.apiUrl}/v1/evaluate/batch`, {
    method: "POST",
    headers: headers(config.apiKey),
    body: JSON.stringify({
      project: config.project,
      environment: config.environment,
      flag_keys: [],
      context: config.context ?? {},
    }),
  });

  if (!res.ok) {
    throw new Error(`FlagBridge: batch evaluate failed (${res.status})`);
  }

  const data = (await res.json()) as BatchEvalResponse;
  const flags: Record<string, unknown> = {};
  for (const [key, result] of Object.entries(data.flags)) {
    flags[key] = result.value;
  }
  return flags;
}

export async function fetchFlag(
  config: FlagBridgeConfig,
  flagKey: string,
  context?: EvalContext,
): Promise<unknown> {
  const res = await fetch(`${config.apiUrl}/v1/evaluate`, {
    method: "POST",
    headers: headers(config.apiKey),
    body: JSON.stringify({
      project: config.project,
      environment: config.environment,
      flag_key: flagKey,
      context: context ?? config.context ?? {},
    }),
  });

  if (!res.ok) {
    throw new Error(`FlagBridge: evaluate failed for "${flagKey}" (${res.status})`);
  }

  const data = (await res.json()) as SingleEvalResponse;
  return data.value;
}

const MAX_BACKOFF_MS = 30_000;

export function connectSSE(
  config: FlagBridgeConfig,
  onFlagUpdated: (flagKey: string) => void,
  onError: (error: Error) => void,
): () => void {
  let attempt = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let aborted = false;
  let controller: AbortController | null = null;

  function connect() {
    if (aborted) return;

    controller = new AbortController();
    const url = `${config.apiUrl}/v1/sse/${config.environment}`;

    fetch(url, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`FlagBridge SSE: connection failed (${res.status})`);
        }
        if (!res.body) {
          throw new Error("FlagBridge SSE: no response body");
        }

        attempt = 0;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        function read(): void {
          if (aborted) return;
          reader
            .read()
            .then(({ done, value }) => {
              if (done || aborted) {
                if (!aborted) reconnect();
                return;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";

              let currentEvent = "";
              for (const line of lines) {
                if (line.startsWith("event:")) {
                  currentEvent = line.slice(6).trim();
                } else if (line.startsWith("data:") && currentEvent === "flag.updated") {
                  try {
                    const data = JSON.parse(line.slice(5).trim()) as {
                      flag_key: string;
                    };
                    onFlagUpdated(data.flag_key);
                  } catch {
                    // skip malformed data
                  }
                  currentEvent = "";
                } else if (line === "") {
                  currentEvent = "";
                }
              }

              read();
            })
            .catch((err: unknown) => {
              if (!aborted) {
                onError(err instanceof Error ? err : new Error(String(err)));
                reconnect();
              }
            });
        }

        read();
      })
      .catch((err: unknown) => {
        if (!aborted) {
          onError(err instanceof Error ? err : new Error(String(err)));
          reconnect();
        }
      });
  }

  function reconnect() {
    if (aborted) return;
    const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
    attempt++;
    timeout = setTimeout(connect, delay);
  }

  connect();

  return () => {
    aborted = true;
    controller?.abort();
    if (timeout) clearTimeout(timeout);
  };
}
