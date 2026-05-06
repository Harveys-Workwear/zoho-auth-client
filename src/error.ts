class ZohoAuthError extends Error {
  constructor(
    message: string,
    public code: ZohoAuthErrorCode,
    public details?: { status?: number; zohoError?: string; cause?: unknown },
  ) {
    super(message);
    this.name = "ZohoAuthError";
  }
}

enum ZohoAuthErrorCode {
  INVALID_CLIENT = "invalid_client",
  INVALID_CLIENT_SECRET = "invalid_client_secret",
  INVALID_RESPONSE_TYPE = "invalid_response_type",
  INVALID_CODE = "invalid_code",
  INVALID_SCOPE = "invalid_scope",
  INVALID_OAUTH_SCOPE = "invalid_oauth_scope",
  INVALID_REDIRECT_URI = "invalid_redirect_uri",
  BAD_REQUEST = "400_bad_request",
  GENERAL_ERROR = "general_error",
  OTHER_DC = "other_dc",
  ACCESS_DENIED = "access_denied",
  EXPIRED = "expired",
  POLLING_RETRIES_EXCEEDED = "polling_retries_exceeded",
  UNKNOWN_ERROR = "unknown_error",
}

export { ZohoAuthError, ZohoAuthErrorCode };
