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
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it("returns device initiation payloads", async () => {
    jest.mocked(global.fetch).mockResolvedValue(
      createJsonResponse(deviceInitiationSuccess),
    );

    const client = new ZohoAuthClient(baseConfig);

    await expect(
      client.nonBrowserApp.deviceInitiationRequest(["AaaServer.profile.Read"]),
    ).resolves.toMatchObject(deviceInitiationSuccess);
  });

  it("returns a token when polling succeeds immediately", async () => {
    jest.mocked(global.fetch).mockResolvedValue(createJsonResponse(tokenSuccess));

    const client = new ZohoAuthClient(baseConfig);

    await expect(
      client.nonBrowserApp.devicePollingRequest("device-code"),
    ).resolves.toMatchObject(tokenSuccess);
  });

  it("retries while authorization is pending", async () => {
    jest.useFakeTimers();
    jest.mocked(global.fetch)
      .mockResolvedValueOnce(
        createJsonResponse({ authorization_pending: true }),
      )
      .mockResolvedValueOnce(createJsonResponse(tokenSuccess));

    const client = new ZohoAuthClient(baseConfig, 2, 10);

    const pollingPromise = client.nonBrowserApp.devicePollingRequest("device-code");

    await jest.advanceTimersByTimeAsync(10);

    await expect(pollingPromise).resolves.toMatchObject(tokenSuccess);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws when polling retries are exhausted", async () => {
    jest.useFakeTimers();
    jest.mocked(global.fetch)
      .mockResolvedValueOnce(
        createJsonResponse({ authorization_pending: true }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ authorization_pending: true }),
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
    jest.mocked(global.fetch).mockResolvedValue(
      createJsonResponse({ access_denied: true }),
    );

    const client = new ZohoAuthClient(baseConfig);

    await expect(
      client.nonBrowserApp.devicePollingRequest("device-code"),
    ).rejects.toMatchObject({
      code: ZohoAuthErrorCode.ACCESS_DENIED,
    });
  });
});