"use client";

import { useContext } from "react";
import { FlagBridgeContext } from "./provider";
import type { FlagBridgeContextValue } from "./types";

export function useFlagBridge(): FlagBridgeContextValue {
  const ctx = useContext(FlagBridgeContext);
  if (!ctx) {
    throw new Error(
      "useFlagBridge must be used within a <FlagBridgeProvider>",
    );
  }
  return ctx;
}

export function useFlag<T = unknown>(key: string, defaultValue?: T): T {
  const { flags, isLoading } = useFlagBridge();

  if (isLoading || !(key in flags)) {
    return (defaultValue ?? false) as T;
  }

  return flags[key] as T;
}
