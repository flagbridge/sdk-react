export interface FlagBridgeConfig {
  apiKey: string;
  apiUrl: string;
  environment: string;
  project: string;
  context?: EvalContext;
  onError?: (error: Error) => void;
}

export interface EvalContext {
  userId?: string;
  attributes?: Record<string, unknown>;
}

export interface EvalResult {
  value: unknown;
  reason: string;
  ruleId?: string;
}

export interface FlagBridgeContextValue {
  flags: Record<string, unknown>;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}
