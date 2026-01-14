import type { Args, MiddlewareFunction, MiddlewareStackOptions } from "./types";
import { PRIORITY } from "./priority";

/**
 * 扁平化 dotN 参数
 * 不要修改原对象
 * 例如： {A: {B: 1}, C: 2} ["A"] => {A.B: 1, C: 2}
 *       {A: [{B: 1}]} => {A.1.B: 1}
 */
const flatDotN = (obj: any, params?: string[]) => {
  if (!obj) {
    return obj;
  }
  const result: Record<string, any> = {};
  const flatten = (prefix: string, value: any) => {
    if (typeof value === "object" && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          const newPrefix = `${prefix}.${index + 1}`;
          flatten(newPrefix, item);
        });
      } else {
        Object.entries(value).forEach(([key, val]) => {
          const newPrefix = `${prefix}.${key}`;
          flatten(newPrefix, val);
        });
      }
    } else {
      result[prefix] = value;
    }
  };
  Object.keys(obj).forEach((key) => {
    if (!params?.length || params.includes(key)) {
      flatten(key, obj[key]);
    } else {
      result[key] = obj[key];
    }
  });
  return result;
};

export const dotNMiddleware: {
  middleware: MiddlewareFunction;
  options: MiddlewareStackOptions;
} = {
  middleware: (next, context) => async (args: Args) => {
    const { request } = args;

    const contentType = context.contentType;
    if (
      contentType === "application/x-www-form-urlencoded" &&
      request.method === "POST"
    ) {
      request.params = flatDotN(request.params);
      request.body = flatDotN(request.body);
    }
    if (request.method === "GET") {
      request.params = flatDotN(request.params);
    }

    return next(args);
  },
  options: {
    step: PRIORITY.dotNMiddleware.step,
    name: "dotNMiddleware",
    priority: PRIORITY.dotNMiddleware.priority,
  },
};
