"use client";

import { useState, useEffect } from "react";
import { useFlagBridge } from "./provider";

export function useFlag(flagKey: string, defaultValue: boolean): boolean {
  const client = useFlagBridge();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    client.getBooleanValue(flagKey, defaultValue).then(setValue);
  }, [client, flagKey, defaultValue]);

  return value;
}
