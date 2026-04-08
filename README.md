# @flagbridge/sdk-react

React SDK for [FlagBridge](https://flagbridge.io) — feature flags with real-time updates via SSE.

## Install

```bash
pnpm add @flagbridge/sdk-react
```

## Quick Start

```tsx
import { FlagBridgeProvider, useFlag } from '@flagbridge/sdk-react';

function App() {
  return (
    <FlagBridgeProvider
      apiKey="fb_sk_eval_..."
      apiUrl="https://api.flagbridge.io"
      environment="production"
      project="vozes"
      context={{ attributes: { locale: 'pt-BR' } }}
    >
      <Landing />
    </FlagBridgeProvider>
  );
}

function Landing() {
  const waitlistOpen = useFlag('waitlist-open', false);

  if (waitlistOpen) {
    return <WaitlistForm />;
  }
  return <ComingSoon />;
}
```

## API

### `<FlagBridgeProvider>`

Wraps your app and manages flag state + SSE connection.

| Prop | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | API key (e.g. `fb_sk_eval_...`) |
| `apiUrl` | `string` | Yes | API base URL |
| `environment` | `string` | Yes | `staging` or `production` |
| `project` | `string` | Yes | Project slug |
| `context` | `EvalContext` | No | User context for targeting |
| `onError` | `(error: Error) => void` | No | Error callback |

### `useFlag(key, defaultValue?)`

Returns the value of a feature flag.

```tsx
const isEnabled = useFlag('my-flag', false);        // boolean
const variant = useFlag<string>('hero', 'default');  // string
const limit = useFlag<number>('max-items', 10);      // number
```

- Returns `defaultValue` (or `false`) while loading or if the flag doesn't exist.
- Re-renders automatically when the flag changes via SSE.

### `useFlagBridge()`

Returns the full context value:

```tsx
const { flags, isLoading, error, refresh } = useFlagBridge();
```

## How It Works

1. On mount, fetches all flags via `POST /v1/evaluate/batch`
2. Connects to SSE at `GET /v1/sse/{environment}`
3. On `flag.updated` events, re-evaluates the changed flag
4. Auto-reconnects with exponential backoff (1s to 30s)

## Requirements

- React 18+
- TypeScript (optional but recommended)

## License

Apache-2.0
