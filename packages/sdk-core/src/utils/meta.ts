/**
 * MetaPath utilities
 * Helper functions to parse metaPath strings and build request configs.
 */
import type { MetaPathInfo } from "../types/types";

export function parseMetaPath(metaPath: string): MetaPathInfo {
  // Check if metaPath ends with // (indicating empty contentType)
  let hasEmptyContentType = /\/\/$/.test(metaPath);

  // Remove leading slashes but handle trailing slashes specially
  const trimmedPath = metaPath.replace(/^\/+/, "");
  let parts = trimmedPath.split("/");

  // Remove empty strings from split (except we need to preserve empty contentType)
  parts = parts.filter((p) => p !== "");

  // If we detected // at the end, add empty contentType
  if (hasEmptyContentType) {
    // If the last part was removed by filter, add empty string
    if (parts.length === 4) {
      parts.push("");
    }
  }

  if (parts.length !== 5) {
    throw new Error(
      `Invalid metaPath format: ${metaPath}. Expected format: /Action/Version/serviceName/method/contentType/`
    );
  }

  const [action, version, serviceName, method, contentType] = parts;
  const normalizedMethod = method.toUpperCase();
  const normalizedContentType = contentType.replace(/_/g, "/");

  return {
    action,
    version,
    serviceName,
    method: normalizedMethod,
    contentType: normalizedContentType,
  };
}

export function buildRequestConfigFromMeta(meta: MetaPathInfo): {
  params: { Action: string; Version: string };
  method: string;
  serviceName: string;
  contentType: string;
} {
  return {
    params: {
      Action: meta.action,
      Version: meta.version,
    },
    method: meta.method,
    serviceName: meta.serviceName,
    contentType: meta.contentType,
  };
}

export function buildRequestConfigFromMetaPath(metaPath: string): {
  params: { Action: string; Version: string };
  method: string;
  serviceName: string;
  contentType: string;
} {
  const meta = parseMetaPath(metaPath);
  return buildRequestConfigFromMeta(meta);
}
