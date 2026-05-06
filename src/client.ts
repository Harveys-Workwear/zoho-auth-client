import { ZohoAuthError, ZohoAuthErrorCode } from "./error";

class ZohoAuthClient {
  private baseUrl: string;
  private pollingInterval: number = 5100;
  private maxPollingRetries: number = 24;

  constructor(
    private config: ZohoAuthConfig,
    maxPollingRetries?: number,
    pollingInterval?: number,
  ) {
    if (maxPollingRetries !== undefined) {
      this.maxPollingRetries = maxPollingRetries;
    }
    if (pollingInterval !== undefined) {
      this.pollingInterval = pollingInterval;
    }
    this.baseUrl = this.getBaseUrl();
  }

  readonly nonBrowserApp = {
    deviceInitiationRequest: (scopes: string[]) =>
      this.deviceInitiationRequest(scopes),
    devicePollingRequest: (code: string, retryCount = 0) =>
      this.devicePollingRequest(code, retryCount),
  };

  readonly serverApp = {
    getAuthorizationCodeUrl: (
      scopes: string[],
      redirectUri: string,
      accessType: "online" | "offline" = "offline",
      prompt?: "consent",
    ) => this.getAuthorizationCodeUrl(scopes, redirectUri, accessType, prompt),
    getAccessToken: (code: string, redirectUri: string) =>
      this.serverGetAccessTokenRequest(code, redirectUri),
  };

  async refreshTokenRequest(refreshToken: string): Promise<ZohoTokenResponse> {
    const url = `${this.baseUrl}oauth/v2/token`;
    const params = new URLSearchParams();
    params.append("client_id", this.config.credentials.clientId);
    params.append("client_secret", this.config.credentials.clientSecret);
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken);

    const response = await fetch(`${url}?${params.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = await this.handleAuthResponse(response);

    if (!this.isTokenResponse(data)) {
      throw new ZohoAuthError(
        "Unexpected response from refresh token request",
        ZohoAuthErrorCode.UNKNOWN_ERROR,
        { status: response.status, zohoError: JSON.stringify(data) },
      );
    }

    return data;
  }

  private async getAuthorizationCodeUrl(
    scopes: string[],
    redirectUri: string,
    accessType: "online" | "offline" = "offline",
    prompt?: "consent",
  ): Promise<string> {
    const url = `${this.baseUrl}oauth/v2/auth`;
    const params = new URLSearchParams();
    params.append("client_id", this.config.credentials.clientId);
    params.append("scope", scopes.join(","));
    params.append("access_type", accessType);
    if (prompt) {
      params.append("prompt", prompt);
    }
    params.append("response_type", "code");
    params.append("redirect_uri", redirectUri);

    return `${url}?${params.toString()}`;
  }

  private async serverGetAccessTokenRequest(
    code: string,
    redirectUri: string,
  ): Promise<ZohoTokenResponse> {
    const url = `${this.baseUrl}oauth/v2/token`;
    const params = new URLSearchParams();
    params.append("client_id", this.config.credentials.clientId);
    params.append("client_secret", this.config.credentials.clientSecret);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirectUri);

    const response = await fetch(`${url}?${params.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = await this.handleAuthResponse(response);

    if (!this.isTokenResponse(data)) {
      throw new ZohoAuthError(
        "Unexpected response from access token request",
        ZohoAuthErrorCode.UNKNOWN_ERROR,
        { status: response.status, zohoError: JSON.stringify(data) },
      );
    }

    return data;
  }

  private async deviceInitiationRequest(
    scopes: string[],
  ): Promise<ZohoInitiationResponse> {
    const url = `${this.baseUrl}oauth/v3/device/code`;
    const params = new URLSearchParams();
    params.append("client_id", this.config.credentials.clientId);
    params.append("scope", scopes.join(","));
    params.append("grant_type", "device_request");
    params.append("access_type", "offline");
    params.append("prompt", "consent");

    const response = await fetch(`${url}?${params.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = await this.handleAuthResponse(response);

    if (!this.isInitationResponse(data)) {
      throw new ZohoAuthError(
        "Unexpected response from device initiation request",
        ZohoAuthErrorCode.UNKNOWN_ERROR,
        { status: response.status, zohoError: JSON.stringify(data) },
      );
    }
    return data;
  }

  private async devicePollingRequest(
    code: string,
    retryCount: number = 0,
  ): Promise<ZohoTokenResponse> {
    const url = `${this.baseUrl}oauth/v3/device/token`;
    const params = new URLSearchParams();
    params.append("client_id", this.config.credentials.clientId);
    params.append("client_secret", this.config.credentials.clientSecret);
    params.append("grant_type", "device_token");
    params.append("code", code);

    const response = await fetch(`${url}?${params.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await this.handleAuthResponse(response);

    if (this.isTokenResponse(data)) {
      return data as ZohoTokenResponse;
    }

    if (this.isPollingFeedbackResponse(data)) {
      await this.handlePollingFeedback(data);
      if (retryCount < this.maxPollingRetries) {
        return this.devicePollingRequest(code, retryCount + 1);
      } else {
        throw new ZohoAuthError(
          "Maximum polling retries exceeded",
          ZohoAuthErrorCode.POLLING_RETRIES_EXCEEDED,
        );
      }
    }

    throw new ZohoAuthError(
      "Unexpected response from device polling request",
      ZohoAuthErrorCode.UNKNOWN_ERROR,
      { status: response.status, zohoError: JSON.stringify(data) },
    );
  }

  private async handlePollingFeedback(
    feedback: ZohoPollingFeedbackResponse,
  ): Promise<void> {
    if (feedback.slow_down) {
      await new Promise((resolve) => setTimeout(resolve, this.pollingInterval));
      return;
    }

    if (feedback.authorization_pending) {
      await new Promise((resolve) => setTimeout(resolve, this.pollingInterval));
      return;
    }

    if (feedback.other_dc) {
      throw new ZohoAuthError(
        "User is trying to authenticate from a different data center",
        ZohoAuthErrorCode.OTHER_DC,
      );
    }

    if (feedback.access_denied) {
      throw new ZohoAuthError(
        "User denied access",
        ZohoAuthErrorCode.ACCESS_DENIED,
      );
    }

    if (feedback.expired) {
      throw new ZohoAuthError("Device code expired", ZohoAuthErrorCode.EXPIRED);
    }

    throw new ZohoAuthError(
      "Unknown polling feedback",
      ZohoAuthErrorCode.UNKNOWN_ERROR,
    );
  }

  private async handleAuthResponse(response: Response): Promise<unknown> {
    const rawBody = await response.text();

    let data: unknown;
    try {
      data = rawBody ? JSON.parse(rawBody) : undefined;
    } catch {
      data = undefined;
    }

    if (data && this.isErrorResponse(data)) {
      const zohoErrorCode = this.mapZohoErrorCode(data.error);
      throw new ZohoAuthError(
        response.statusText || "Device initiation request failed",
        zohoErrorCode,
        { status: response.status, zohoError: data.error },
      );
    }

    if (!response.ok) {
      throw new ZohoAuthError(
        response.statusText || "Device initiation request failed",
        ZohoAuthErrorCode.BAD_REQUEST,
        { status: response.status, zohoError: rawBody },
      );
    }

    if (!data) {
      throw new ZohoAuthError(
        "Unexpected response from device initiation request",
        ZohoAuthErrorCode.UNKNOWN_ERROR,
        { status: response.status, zohoError: rawBody },
      );
    }

    return data;
  }

  private isPollingFeedbackResponse(
    data: any,
  ): data is ZohoPollingFeedbackResponse {
    return (
      "slow_down" in data ||
      "authorization_pending" in data ||
      "other_dc" in data ||
      "access_denied" in data ||
      "expired" in data
    );
  }

  private isInitationResponse(data: any): data is ZohoInitiationResponse {
    return (
      "user_code" in data &&
      "device_code" in data &&
      "expires_in" in data &&
      "interval" in data
    );
  }

  private isTokenResponse(data: any): data is ZohoTokenResponse {
    return "access_token" in data && "expires_in" in data;
  }

  private isErrorResponse(data: any): data is ZohoErrorResponse {
    return "error" in data;
  }

  private mapZohoErrorCode(zohoError: string): ZohoAuthErrorCode {
    const normalizedError = zohoError
      .toLowerCase()
      .replaceAll(/[^A-Za-z0-9_]+/g, "_");
    if (
      (Object.values(ZohoAuthErrorCode) as string[]).includes(normalizedError)
    ) {
      return normalizedError as ZohoAuthErrorCode;
    }
    return ZohoAuthErrorCode.UNKNOWN_ERROR;
  }

  private getBaseUrl(): string {
    return `https://accounts.zoho.${this.config.dataCenter}/`;
  }
}

interface ZohoAuthConfig {
  dataCenter: string;
  credentials: {
    clientId: string;
    clientSecret: string;
  };
}

export { ZohoAuthClient, type ZohoAuthConfig };

interface ZohoInitiationResponse {
  user_code: string;
  device_code: string;
  verification_url?: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

interface ZohoPollingFeedbackResponse {
  slow_down?: boolean;
  authorization_pending?: boolean;
  other_dc?: boolean;
  access_denied?: boolean;
  expired?: boolean;
}

interface ZohoTokenResponse {
  access_token: string;
  refresh_token?: string;
  api_domain: string;
  token_type: string;
  expires_in: number;
}

interface ZohoErrorResponse {
  error: string;
}
