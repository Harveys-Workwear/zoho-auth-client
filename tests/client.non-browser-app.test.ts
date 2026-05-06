/// <reference types="jest" />

import { ZohoAuthClient } from "../src/client";
import { ZohoAuthErrorCode } from "../src/error";
import {
  deviceInitiationSuccess,
  tokenSuccess,
} from "./fixtures/zoho";
import { createJsonResponse } from "./helpers/mock-fetch";

const baseConfig = {
  dataCenter: "eu",
  credentials: {
    clientId: "client-id",
    clientSecret: "client-secret",
  },
};

describe("ZohoAuthClient nonBrowserApp", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn() as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it("returns device initiation payloads", async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      createJsonResponse(deviceInitiationSuccess),
    );

    const client = new ZohoAuthClient(baseConfig);

    await expect(
      client.nonBrowserApp.deviceInitiationRequest(["AaaServer.profile.Read"]),
    ).resolves.toMatchObject(deviceInitiationSuccess);
  });

  it("returns a token when polling succeeds immediately", async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(createJsonResponse(tokenSuccess));

    const client = new ZohoAuthClient(baseConfig);

    await expect(
      client.nonBrowserApp.devicePollingRequest("device-code"),
    ).resolves.toMatchObject(tokenSuccess);
  });

  it("retries while authorization is pending", async () => {
    jest.useFakeTimers();
    jest.mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        createJsonResponse({ error: "authorization_pending" }),
      )
      .mockResolvedValueOnce(createJsonResponse(tokenSuccess));

    const client = new ZohoAuthClient(baseConfig, 2, 10);

    const pollingPromise = client.nonBrowserApp.devicePollingRequest("device-code");

    await jest.advanceTimersByTimeAsync(10);

    await expect(pollingPromise).resolves.toMatchObject(tokenSuccess);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws when polling retries are exhausted", async () => {
    jest.useFakeTimers();
    jest.mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        createJsonResponse({ error: "authorization_pending" }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ error: "authorization_pending" }),
      );

    const client = new ZohoAuthClient(baseConfig, 1, 10);

    const pollingPromise = client.nonBrowserApp.devicePollingRequest("device-code");
    const rejection = expect(pollingPromise).rejects.toMatchObject({
      code: ZohoAuthErrorCode.POLLING_RETRIES_EXCEEDED,
    });

    await jest.advanceTimersByTimeAsync(20);

    await rejection;
  });

  it("throws terminal polling feedback errors", async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      createJsonResponse({ error: "access_denied" }),
    );

    const client = new ZohoAuthClient(baseConfig);

    await expect(
      client.nonBrowserApp.devicePollingRequest("device-code"),
    ).rejects.toMatchObject({
      code: ZohoAuthErrorCode.ACCESS_DENIED,
    });
  });
});