"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { FlagBridgeConfig, FlagBridgeContextValue } from "./types";
import { connectSSE, fetchAllFlags, fetchFlag } from "./client";

export const FlagBridgeContext = createContext<FlagBridgeContextValue | null>(
  null,
);

export interface FlagBridgeProviderProps extends FlagBridgeConfig {
  children: ReactNode;
}

export function FlagBridgeProvider({
  children,
  ...config
}: FlagBridgeProviderProps) {
  const [flags, setFlags] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const handleError = useCallback((err: Error) => {
    setError(err);
    configRef.current.onError?.(err);
  }, []);

  const refresh = useCallback(() => {
    fetchAllFlags(configRef.current)
      .then((result) => {
        setFlags(result);
        setError(null);
      })
      .catch(handleError);
  }, [handleError]);

  useEffect(() => {
    let cancelled = false;

    fetchAllFlags(config)
      .then((result) => {
        if (!cancelled) {
          setFlags(result);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error(String(err));
          setIsLoading(false);
          handleError(error);
        }
      });

    const disconnect = connectSSE(
      config,
      (flagKey) => {
        fetchFlag(config, flagKey)
          .then((value) => {
            if (!cancelled) {
              setFlags((prev) => ({ ...prev, [flagKey]: value }));
            }
          })
          .catch(handleError);
      },
      handleError,
    );

    return () => {
      cancelled = true;
      disconnect();
    };
    // Re-connect when these change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.apiKey, config.apiUrl, config.environment, config.project]);

  const value: FlagBridgeContextValue = {
    flags,
    isLoading,
    error,
    refresh,
  };

  return (
    <FlagBridgeContext.Provider value={value}>
      {children}
    </FlagBridgeContext.Provider>
  );
}
