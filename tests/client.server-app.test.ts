/// <reference types="jest" />

import { ZohoAuthClient } from "../src/client";
import { ZohoAuthErrorCode } from "../src/error";
import {
  refreshTokenSuccess,
  tokenSuccess,
} from "./fixtures/zoho";
import { createJsonResponse, createTextResponse } from "./helpers/mock-fetch";

const baseConfig = {
  dataCenter: "eu",
  credentials: {
    clientId: "client-id",
    clientSecret: "client-secret",
  },
};

describe("ZohoAuthClient serverApp", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn() as typeof fetch;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("builds an authorization code URL", async () => {
    const client = new ZohoAuthClient(baseConfig);

    const url = await client.serverApp.getAuthorizationCodeUrl(
      ["scope.one", "scope.two"],
      "https://example.com/callback",
      "offline",
      "consent",
    );

    const parsedUrl = new URL(url);

    expect(parsedUrl.origin).toBe("https://accounts.zoho.eu");
    expect(parsedUrl.pathname).toBe("/oauth/v2/auth");
    expect(parsedUrl.searchParams.get("client_id")).toBe("client-id");
    expect(parsedUrl.searchParams.get("scope")).toBe("scope.one,scope.two");
    expect(parsedUrl.searchParams.get("redirect_uri")).toBe(
      "https://example.com/callback",
    );
    expect(parsedUrl.searchParams.get("response_type")).toBe("code");
    expect(parsedUrl.searchParams.get("prompt")).toBe("consent");
  });

  it("exchanges an authorization code for a token", async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(createJsonResponse(tokenSuccess));

    const client = new ZohoAuthClient(baseConfig);

    await expect(
      client.serverApp.getAccessToken("auth-code", "https://example.com/callback"),
    ).resolves.toMatchObject(tokenSuccess);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes an access token", async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      createJsonResponse(refreshTokenSuccess),
    );

    const client = new ZohoAuthClient(baseConfig);

    await expect(client.refreshTokenRequest("refresh-token")).resolves.toMatchObject(
      refreshTokenSuccess,
    );
  });

  it("maps JSON error responses to ZohoAuthErrorCode", async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      createJsonResponse(
        { error: "invalid_client" },
        { status: 400, statusText: "Bad Request" },
      ),
    );

    const client = new ZohoAuthClient(baseConfig);

    await expect(
      client.serverApp.getAccessToken("auth-code", "https://example.com/callback"),
    ).rejects.toMatchObject({
      code: ZohoAuthErrorCode.INVALID_CLIENT,
      details: {
        status: 400,
        zohoError: "invalid_client",
      },
    });
  });

  it("falls back to BAD_REQUEST for non-JSON error bodies", async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      createTextResponse("Internal Server Error", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    );

    const client = new ZohoAuthClient(baseConfig);

    await expect(client.refreshTokenRequest("refresh-token")).rejects.toMatchObject({
      code: ZohoAuthErrorCode.BAD_REQUEST,
      details: {
        status: 500,
        zohoError: "Internal Server Error",
      },
    });
  });
});