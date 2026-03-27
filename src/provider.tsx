"use client";

import { createContext, useContext, type ReactNode } from "react";
import { FlagBridge, type FlagBridgeConfig } from "@flagbridge/sdk-node";

const FlagBridgeContext = createContext<FlagBridge | null>(null);

export function FlagBridgeProvider({
  config,
  children,
}: {
  config: FlagBridgeConfig;
  children: ReactNode;
}) {
  const client = new FlagBridge(config);

  return (
    <FlagBridgeContext.Provider value={client}>
      {children}
    </FlagBridgeContext.Provider>
  );
}

export function useFlagBridge(): FlagBridge {
  const client = useContext(FlagBridgeContext);
  if (!client) {
    throw new Error("useFlagBridge must be used within a FlagBridgeProvider");
  }
  return client;
}
