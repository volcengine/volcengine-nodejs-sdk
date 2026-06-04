/**
 * HMAC-SHA256 Signer for VolcEngine API requests
 * Optimized implementation with functional approach
 */

import * as crypto from "crypto";

// Constants
export const constant = {
  algorithm: "HMAC-SHA256",
  v4Identifier: "request",
  dateHeader: "x-date",
  tokenHeader: "x-security-token",
  contentSha256Header: "x-content-sha256",
  kDatePrefix: "",
};

// Headers that should not be signed
export const unsignableHeaders = [
  "authorization",
  "content-type",
  "content-length",
  "user-agent",
  "presigned-expires",
  "expect",
];

// ============================================================================
// Core Cryptographic Functions
// ============================================================================

// 辅助函数：SHA256 哈希
export const calculateSHA256 = (data: string | Buffer): string => {
  return crypto.createHash("sha256").update(data).digest("hex");
};

// 辅助函数：HMAC-SHA256
export const calculateHMAC = (
  key: string | Buffer,
  data: string | Buffer
): Buffer => {
  return crypto
    .createHmac("sha256", key as any)
    .update(data as any)
    .digest();
};

// ============================================================================
// Encoding and Date Functions
// ============================================================================

// 辅助函数：URI 编码
export const uriEscape = (str: string): string => {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
    return "%" + c.charCodeAt(0).toString(16).toUpperCase();
  });
};

// 辅助函数：ISO8601 时间格式
export const iso8601 = (date?: Date): string => {
  if (!date) {
    date = new Date();
  }
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
};

// 辅助函数：获取时间戳
export const getDateTime = (date?: Date): string => {
  return iso8601(date).replace(/[:\-]|\.\d{3}/g, "");
};

// ============================================================================
// Canonical Request Building
// ============================================================================

// 构建规范化 URI
export const canonicalUri = (path?: string): string => {
  if (!path) {
    return "/";
  }
  const segments = path.split("/");
  return segments.map((segment) => uriEscape(segment)).join("/");
};

// 构建规范化查询字符串
export const canonicalQueryString = (params: Record<string, any>): string => {
  if (!params || Object.keys(params).length === 0) {
    return "";
  }

  const sortedKeys = Object.keys(params)
    .filter((key) => {
      const value = params[key];
      return value !== undefined && value !== null;
    })
    .sort();

  const parts = sortedKeys.map((key) => {
    const value = params[key];
    const escapedKey = uriEscape(key);
    if (!escapedKey) {
      return null;
    }
    if (Array.isArray(value)) {
      return `${escapedKey}=${value
        .map(uriEscape)
        .sort()
        .join(`&${escapedKey}=`)}`;
    }
    return `${escapedKey}=${uriEscape(value)}`;
  });

  return parts.filter((v) => v !== null).join("&");
};

// 判断是否为可签名的请求头
export const isSignableHeader = (key: string): boolean => {
  return !unsignableHeaders.includes(key);
};

// 规范化请求头值
export const canonicalHeaderValues = (values: string): string => {
  return values.replace(/\s+/g, " ").trim();
};

// 构建规范化请求头
export const canonicalHeaders = (headers: Record<string, any>): string => {
  const headerEntries = Object.entries(headers);

  // 按请求头名称排序（不区分大小写）
  headerEntries.sort((a, b) =>
    a[0].toLowerCase().localeCompare(b[0].toLowerCase())
  );

  const parts: string[] = [];
  for (const [key, value] of headerEntries) {
    const lowerKey = key.toLowerCase();
    if (isSignableHeader(lowerKey)) {
      if (value === undefined || value === null) {
        throw new Error(`Header ${key} contains invalid value`);
      }
      parts.push(`${lowerKey}:${canonicalHeaderValues(String(value))}`);
    }
  }

  return parts.join("\n");
};

// 获取签名的请求头列表
export const signedHeaders = (headers: Record<string, any>): string => {
  const keys = Object.keys(headers)
    .map((key) => key.toLowerCase())
    .filter(isSignableHeader)
    .sort();

  return keys.join(";");
};

// 计算请求体的哈希值
export const hexEncodedBodyHash = (
  headers: Record<string, any>,
  body?: any
): string => {
  // 如果 headers 中已经有 content sha256，直接使用
  if (headers[constant.contentSha256Header]) {
    return headers[constant.contentSha256Header];
  }

  // 否则计算 body 的 hash
  if (typeof body === "string" || Buffer.isBuffer(body)) {
    return calculateSHA256(body);
  }

  const bodyStr = JSON.stringify(body);
  return body ? calculateSHA256(bodyStr || "") : calculateSHA256("");
};

// 构建规范化请求
export const createCanonicalRequest = (
  method: string,
  uri: string,
  query: Record<string, any>,
  headers: Record<string, any>,
  payload: string
): string => {
  return [
    method.toUpperCase(),
    canonicalUri(uri),
    canonicalQueryString(query),
    `${canonicalHeaders(headers)}\n`,
    signedHeaders(headers),
    payload,
  ].join("\n");
};

// ============================================================================
// String to Sign & Signing
// ============================================================================

// 构建作用域字符串
export const createScope = (
  date: string,
  region: string,
  serviceName: string
): string => {
  return [
    date.substring(0, 8),
    region,
    serviceName,
    constant.v4Identifier,
  ].join("/");
};

// 构建待签名字符串
export const createStringToSign = (
  timestamp: string,
  region: string,
  serviceName: string,
  canonicalRequest: string
): string => {
  const date = timestamp.slice(0, 8);
  const credentialScope = createScope(date, region, serviceName);

  return [
    constant.algorithm,
    timestamp,
    credentialScope,
    calculateSHA256(canonicalRequest),
  ].join("\n");
};

// 派生签名密钥（使用 Buffer 链式计算）
export const deriveSigningKey = (
  secretAccessKey: string,
  date: string,
  region: string,
  service: string
): Buffer => {
  const kDate = calculateHMAC(
    `${constant.kDatePrefix}${secretAccessKey}`,
    date
  );
  const kRegion = calculateHMAC(kDate, region);
  const kService = calculateHMAC(kRegion, service);
  return calculateHMAC(kService, constant.v4Identifier);
};

// 计算签名
export const calculateSignature = (
  signingKey: Buffer,
  stringToSign: string
): string => {
  return calculateHMAC(signingKey, stringToSign).toString("hex");
};

// 构建 Authorization 头
export const createAuthorization = (
  accessKeyId: string,
  credentialScope: string,
  signedHeadersStr: string,
  signature: string
): string => {
  return [
    `${constant.algorithm} Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeadersStr}`,
    `Signature=${signature}`,
  ].join(", ");
};

// 添加必要的请求头
export const addRequiredHeaders = (
  headers: Record<string, any>,
  timestamp: string,
  host: string,
  sessionToken?: string,
  body?: any
): Record<string, any> => {
  const updated = { ...headers };

  updated[constant.dateHeader] = timestamp;

  if (sessionToken) {
    updated[constant.tokenHeader] = sessionToken;
  }

  // 如果没有提供host，从headers获取
  if (!updated.host) {
    updated.host = host;
  }

  // 允许用户接管 Hash 的计算：流式场景预先计算好 hash
  // 只有在有 body 或者已经有 contentSha256Header 时才计算和添加
  if (body || updated[constant.contentSha256Header]) {
    const bodyHash = hexEncodedBodyHash(updated, body);
    updated[constant.contentSha256Header] = bodyHash;
  }

  return updated;
};

// ============================================================================
// Main Signing Function
// ============================================================================

// 主函数：签名请求
export const signRequest = (params: {
  method?: string;
  uri?: string;
  query?: Record<string, any>;
  headers?: Record<string, any>;
  body?: any;
  region: string;
  serviceName: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  host: string;
  timestamp?: string;
}): {
  headers: Record<string, any>;
  signature: string;
  authorization: string;
} => {
  const {
    method = "GET",
    uri = "/",
    query = {},
    headers = {},
    body,
    region,
    serviceName,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    host,
    timestamp,
  } = params;

  const datetime = timestamp || getDateTime();
  const date = datetime.slice(0, 8);

  // 1. Headers 统一小写处理，消除大小写歧义
  const lowerCaseHeaders: Record<string, any> = {};
  if (headers) {
    Object.keys(headers).forEach((key) => {
      lowerCaseHeaders[key.toLowerCase()] = headers[key];
    });
  }

  // 添加必要的请求头（包括计算 body hash）
  const allHeaders = addRequiredHeaders(
    lowerCaseHeaders,
    datetime,
    host,
    sessionToken,
    body
  );

  // 获取 payload hash（已经计算过，直接复用）
  const payload =
    allHeaders[constant.contentSha256Header] ||
    hexEncodedBodyHash(allHeaders, null);

  // 构建规范化请求
  const canonicalRequest = createCanonicalRequest(
    method,
    uri,
    query,
    allHeaders,
    payload
  );

  // 构建待签名字符串
  const stringToSignValue = createStringToSign(
    datetime,
    region,
    serviceName,
    canonicalRequest
  );

  // 派生签名密钥
  const signingKeyBuffer = deriveSigningKey(
    secretAccessKey,
    date,
    region,
    serviceName
  );

  // 计算签名
  const signature = calculateSignature(signingKeyBuffer, stringToSignValue);

  // 构建 Authorization 头
  const credentialScope = createScope(date, region, serviceName);
  const signedHeadersStr = signedHeaders(allHeaders);
  const authorization = createAuthorization(
    accessKeyId,
    credentialScope,
    signedHeadersStr,
    signature
  );

  return {
    headers: { ...allHeaders, Authorization: authorization },
    signature,
    authorization,
  };
};

// 辅助函数：对参数进行排序
export const sortParams = (
  params: Record<string, any>
): Record<string, any> => {
  if (!params || Object.keys(params).length === 0) {
    return {};
  }

  const newParams: Record<string, any> = {};
  Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .sort()
    .forEach((key) => {
      newParams[key] = params[key];
    });

  return newParams;
};

// Legacy exported function for backward compatibility
export { canonicalQueryString as queryParamsToString };

// ============================================================================
// Presigned URL Generation
// ============================================================================

export const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

// 派生签名密钥（无前缀版本，用于预签名 URL）
export const deriveSigningKeyNoPrefix = (
  secretAccessKey: string,
  date: string,
  region: string,
  service: string
): Buffer => {
  const kDate = calculateHMAC(secretAccessKey, date);
  const kRegion = calculateHMAC(kDate, region);
  const kService = calculateHMAC(kRegion, service);
  return calculateHMAC(kService, constant.v4Identifier);
};

// 构建预签名 URL 的规范化路径
export const canonicalizedPath = (path?: string): string => {
  if (!path || path === "/") {
    return "/";
  }
  // 去掉开头的 /，然后编码，再加回 /
  const trimmed = path.replace(/^\//, "");
  const encoded = encodeURIComponent(trimmed);
  // 把编码后的 %2F 还原为 /
  return "/" + encoded.replace(/%2F/gi, "/");
};

// 构建预签名 URL 的查询字符串
// keys: 需要输出的参数 key 列表（排序后）
// signedQueriesKeys: X-SignedQueries 的值对应的 key 列表（可能不包含 X-Security-Token）
export const buildPresignQueryString = (
  query: Record<string, any>,
  keys: string[],
  excludeSignature: boolean = false,
  signedQueriesKeys?: string[]
): string => {
  const parts: string[] = [];

  // 按 keys 的顺序构建
  for (const key of keys) {
    if (query[key] === undefined) continue;
    const value = query[key];
    if (Array.isArray(value)) {
      const sorted = [...value].sort();
      for (const v of sorted) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }

  // 如果不排除签名，添加 X-SignedQueries 和 X-Signature
  if (!excludeSignature) {
    const sqKeys = signedQueriesKeys || keys;
    parts.push(
      `X-SignedQueries=${encodeURIComponent(sqKeys.join(";"))}`
    );
    if (query["X-Signature"]) {
      parts.push(`X-Signature=${encodeURIComponent(query["X-Signature"])}`);
    }
  }

  return parts.join("&");
};

// 生成预签名 URL
// host 传了则参与签名并返回完整 URL；不传则不签名 host，返回 path?query
export const presignUrl = (params: {
  method?: string;
  uri?: string;
  query?: Record<string, any>;
  region: string;
  serviceName: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  host?: string; // 传了则参与签名，不传则不签名 host
  timestamp?: string;
  protocol?: string; // 协议，默认 https
}): string => {
  const {
    method = "GET",
    uri = "/",
    query = {},
    region,
    serviceName,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    host,
    timestamp,
    protocol = "https",
  } = params;

  const signHost = !!host;

  const datetime = timestamp || getDateTime();
  const date = datetime.slice(0, 8);
  const credentialScope = createScope(date, region, serviceName);

  // 构建预签名需要的查询参数
  const presignQuery: Record<string, any> = {
    ...query,
    "X-Date": datetime,
    "X-NotSignBody": "",
    "X-Algorithm": constant.algorithm,
    "X-Credential": `${accessKeyId}/${credentialScope}`,
    "X-SignedHeaders": signHost ? "host" : "",
  };

  // 获取所有需要签名的查询参数 key，排序（X-Security-Token 不参与 X-SignedQueries）
  const signedQueries = Object.keys(presignQuery).sort();

  // X-Security-Token 在 X-SignedQueries 计算之后添加
  if (sessionToken) {
    presignQuery["X-Security-Token"] = sessionToken;
  }

  // 构建用于签名的规范化查询字符串（只包含 signedQueries 中的参数，X-Security-Token 不参与签名）
  const canonicalQuery = buildPresignQueryString(presignQuery, signedQueries, true);

  // 最终 URL 需要输出所有参数（包括 X-Security-Token）
  const allKeys = Object.keys(presignQuery).sort();

  // 构建规范化路径
  const canonicalPath = canonicalizedPath(uri);

  // body hash（预签名 URL 不签名 body）
  const bodyHash = calculateSHA256("");

  // 构建规范化请求
  let canonicalRequest: string;
  if (signHost) {
    // host 参与签名
    canonicalRequest = [
      method.toUpperCase(),
      canonicalPath,
      canonicalQuery,
      `host:${host}\n`, // canonical headers
      "host", // signed headers
      bodyHash,
    ].join("\n");
  } else {
    // host 不参与签名
    canonicalRequest = [
      method.toUpperCase(),
      canonicalPath,
      canonicalQuery,
      "", // 空的 headers 行
      "", // 空行
      "", // 空的 signed headers 行
      bodyHash,
    ].join("\n");
  }

  // 构建待签名字符串
  const stringToSignValue = [
    constant.algorithm,
    datetime,
    credentialScope,
    calculateSHA256(canonicalRequest),
  ].join("\n");

  // 派生签名密钥（无前缀）
  const signingKeyBuffer = deriveSigningKeyNoPrefix(
    secretAccessKey,
    date,
    region,
    serviceName
  );

  // 计算签名
  const signature = calculateSignature(signingKeyBuffer, stringToSignValue);

  // 将签名添加到查询参数
  presignQuery["X-Signature"] = signature;

  // 构建最终查询字符串（allKeys 包含 X-Security-Token，signedQueries 不包含）
  const queryString = buildPresignQueryString(presignQuery, allKeys, false, signedQueries);

  // 有 host 返回完整 URL，没有 host 返回 path?query
  if (host) {
    return `${protocol}://${host}${canonicalPath}?${queryString}`;
  }
  return `${canonicalPath}?${queryString}`;
};
