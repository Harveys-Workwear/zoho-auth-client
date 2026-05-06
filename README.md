# @harveys-software/zoho-auth-client

A small TypeScript client for Zoho OAuth flows.

It currently supports:

- Server-based authorization code flow
- Device flow for non-browser apps
- Refresh token exchange shared across both flows
- Typed Zoho auth errors via `ZohoAuthError`

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Requirements

- Node.js 18+ or another runtime with a global `fetch` implementation
- A Zoho OAuth client ID and client secret
- The correct Zoho data center, for example `eu`, `com`, or `in`

## Usage

```ts
import { ZohoAuthClient } from "@harveys-software/zoho-auth-client";

const client = new ZohoAuthClient({
  dataCenter: "eu",
  credentials: {
    clientId: process.env.ZOHO_CLIENT_ID!,
    clientSecret: process.env.ZOHO_CLIENT_SECRET!,
  },
});
```

Constructor signature:

```ts
new ZohoAuthClient(config, maxPollingRetries?, pollingInterval?)
```

## Server App Flow

Use `serverApp` for the authorization code flow.

### 1. Build the authorization URL

```ts
const authorizationUrl = await client.serverApp.getAuthorizationCodeUrl(
  ["AaaServer.profile.Read"],
  "https://example.com/oauth/callback",
  "offline",
  "consent",
);
```

### 2. Exchange the authorization code for tokens

```ts
const tokenResponse = await client.serverApp.getAccessToken(
  authorizationCode,
  "https://example.com/oauth/callback",
);

console.log(tokenResponse.access_token);
console.log(tokenResponse.refresh_token);
```

## Non-Browser App Flow

Use `nonBrowserApp` for the device flow.

### 1. Initiate device authorization

```ts
const initiation = await client.nonBrowserApp.deviceInitiationRequest([
  "AaaServer.profile.Read",
]);

console.log(initiation.user_code);
console.log(initiation.device_code);
console.log(initiation.verification_url);
```

### 2. Poll for tokens

```ts
const tokenResponse = await client.nonBrowserApp.devicePollingRequest(
  initiation.device_code,
);

console.log(tokenResponse.access_token);
console.log(tokenResponse.refresh_token);
```

Polling automatically handles:

- `authorization_pending`
- `slow_down`
- retry exhaustion based on the configured retry limit

## Refresh Tokens

`refreshTokenRequest` stays at the client root because it is shared across both flows.

```ts
const refreshed = await client.refreshTokenRequest(refreshToken);

console.log(refreshed.access_token);
```

## Error Handling

All normalized auth failures throw `ZohoAuthError`.

```ts
import {
  ZohoAuthError,
  ZohoAuthErrorCode,
} from "@harveys-software/zoho-auth-client";

try {
  await client.refreshTokenRequest(refreshToken);
} catch (error) {
  if (error instanceof ZohoAuthError) {
    if (error.code === ZohoAuthErrorCode.INVALID_CLIENT) {
      console.error("Check your client credentials");
    }

    console.error(error.details);
  }
}
```

Current exported error codes include:

- `INVALID_CLIENT`
- `INVALID_CLIENT_SECRET`
- `INVALID_RESPONSE_TYPE`
- `INVALID_CODE`
- `INVALID_SCOPE`
- `INVALID_OAUTH_SCOPE`
- `INVALID_REDIRECT_URI`
- `BAD_REQUEST`
- `GENERAL_ERROR`
- `OTHER_DC`
- `ACCESS_DENIED`
- `EXPIRED`
- `POLLING_RETRIES_EXCEEDED`
- `UNKNOWN_ERROR`

## Public API

### `ZohoAuthClient`

- `serverApp.getAuthorizationCodeUrl(scopes, redirectUri, accessType?, prompt?)`
- `serverApp.getAccessToken(code, redirectUri)`
- `nonBrowserApp.deviceInitiationRequest(scopes)`
- `nonBrowserApp.devicePollingRequest(code, retryCount?)`
- `refreshTokenRequest(refreshToken)`

### Types and errors

- `ZohoAuthConfig`
- `ZohoAuthError`
- `ZohoAuthErrorCode`

## Development Notes

- Source exports are defined in `src/index.ts`
- Tests live under `tests/`
- The build uses `tsup`