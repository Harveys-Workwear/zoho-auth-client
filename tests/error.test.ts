/// <reference types="jest" />

import { ZohoAuthError, ZohoAuthErrorCode } from "../src/error";

describe("ZohoAuthError", () => {
  it("preserves code and details", () => {
    const error = new ZohoAuthError(
      "Request failed",
      ZohoAuthErrorCode.BAD_REQUEST,
      { status: 400, zohoError: "invalid_client" },
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ZohoAuthError");
    expect(error.code).toBe(ZohoAuthErrorCode.BAD_REQUEST);
    expect(error.details).toEqual({
      status: 400,
      zohoError: "invalid_client",
    });
  });
});