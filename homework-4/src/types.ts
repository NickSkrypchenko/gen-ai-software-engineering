export interface Header {
  alg: string;
  typ?: string;
  [key: string]: unknown;
}

export interface Claims {
  sub?: string;
  iat?: number;
  exp?: number;
  nbf?: number;
  [key: string]: unknown;
}

export interface DecodedToken {
  rawHeader:  string;
  rawPayload: string;
  signature:  string;
  header:     Header;
  payload:    Claims;
}

export interface VerifyResult {
  valid:   boolean;
  claims?: Claims;
  error?:  string;
}
