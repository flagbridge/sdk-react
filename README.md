# @flagbridge/sdk-react

React SDK for [FlagBridge](https://flagbridge.io) — feature flags with real-time updates via SSE.

## Install

::: code-group

```bash [pnpm]
pnpm add @flagbridge/sdk-react
```

```bash [npm]
npm install @flagbridge/sdk-react
```

```bash [yarn]
yarn add @flagbridge/sdk-react
```

:::

**Peer dependency:** React 18+

## Quick Start

```tsx
import { FlagBridgeProvider, useFlag } from '@flagbridge/sdk-react';

function App() {
  return (
    <FlagBridgeProvider
      apiKey="fb_sk_eval_..."
      apiUrl="https://api.flagbridge.io"
      environment="production"
      project="my-app"
      context={{ userId: 'user-123', attributes: { plan: 'pro' } }}
    >
      <MyApp />
    </FlagBridgeProvider>
  );
}

function Feature() {
  const enabled = useFlag('new-checkout', false);
  return enabled ? <NewCheckout /> : <OldCheckout />;
}
```

## Next.js App Router

The SDK uses `"use client"` directives internally, so it works with Next.js App Router out of the box. Wrap `FlagBridgeProvider` in a client component:

```tsx
// providers.tsx
"use client";

import { FlagBridgeProvider } from '@flagbridge/sdk-react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FlagBridgeProvider
      apiKey={process.env.NEXT_PUBLIC_FLAGBRIDGE_API_KEY!}
      apiUrl={process.env.NEXT_PUBLIC_FLAGBRIDGE_URL!}
      environment="production"
      project="my-app"
    >
      {children}
    </FlagBridgeProvider>
  );
}
```

```tsx
// app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

Then use `useFlag` in any client component:

```tsx
"use client";

import { useFlag } from '@flagbridge/sdk-react';

export function Banner() {
  const showBanner = useFlag('promo-banner', false);
  if (!showBanner) return null;
  return <div>Special offer!</div>;
}
```

## API

### `<FlagBridgeProvider>`

Wraps your app and manages flag state + SSE connection.

| Prop | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | API key (`fb_sk_eval_...`) |
| `apiUrl` | `string` | Yes | API base URL |
| `environment` | `string` | Yes | Environment slug (`staging`, `production`) |
| `project` | `string` | Yes | Project slug |
| `context` | `EvalContext` | No | User context for targeting |
| `onError` | `(error: Error) => void` | No | Error callback |

### `useFlag<T>(key, defaultValue?)`

Returns the value of a feature flag. Re-renders when the flag changes via SSE.

```tsx
const isEnabled = useFlag('my-flag', false);        // boolean
const variant = useFlag<string>('hero', 'default');  // string
const limit = useFlag<number>('max-items', 10);      // number
```

Returns `defaultValue` (or `false`) while loading or if the flag doesn't exist.

### `useFlagBridge()`

Returns the full context:

```tsx
const { flags, isLoading, error, refresh } = useFlagBridge();
```

| Field | Type | Description |
|---|---|---|
| `flags` | `Record<string, unknown>` | All evaluated flag values |
| `isLoading` | `boolean` | `true` during initial fetch |
| `error` | `Error \| null` | Last error, if any |
| `refresh` | `() => void` | Re-fetches all flags (does not reconnect SSE) |

### Types

```typescript
import type {
  FlagBridgeConfig,
  FlagBridgeProviderProps,
  FlagBridgeContextValue,
  EvalContext,
  EvalResult,
} from '@flagbridge/sdk-react';
```

**`EvalContext`** — targeting context sent with evaluations:

```typescript
interface EvalContext {
  userId?: string;
  attributes?: Record<string, unknown>;
}
```

## How It Works

1. On mount, fetches all flags via `POST /v1/evaluate/batch`
2. Connects to SSE at `GET /v1/sse/{environment}`
3. On `flag.updated` events, re-evaluates only the changed flag
4. Auto-reconnects with exponential backoff (1s to 30s)

The SDK uses `fetch`-based streaming instead of `EventSource`, which means it works in environments where `EventSource` doesn't support custom headers.

## License

Apache-2.0
