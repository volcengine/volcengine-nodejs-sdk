import type { Args, MiddlewareFunction, MiddlewareStackOptions } from "./types";
import { loadEnv } from "../utils/env";
import { getAssumeRole } from "../utils/assumeRole";
import { PRIORITY } from "./priority";

export const credentialsMiddleware: {
  middleware: MiddlewareFunction;
  options: MiddlewareStackOptions;
} = {
  middleware: (next, _context) => async (args: Args) => {
    const { clientConfig } = _context;

    const { accessKeyId, secretAccessKey, sessionToken, assumeRoleParams } =
      clientConfig || {};

    const EnvCredentials = loadEnv().credentials;

    if (assumeRoleParams) {
      const newCredentials = await getAssumeRole(clientConfig);
      if (newCredentials.accessKeyId) {
        clientConfig.accessKeyId = newCredentials.accessKeyId;
      }
      if (newCredentials.secretAccessKey) {
        clientConfig.secretAccessKey = newCredentials.secretAccessKey;
      }
      if (newCredentials.sessionToken) {
        clientConfig.sessionToken = newCredentials.sessionToken;
      }

      return next(args);
    } else {
      if (!accessKeyId && EnvCredentials.accessKeyId) {
        clientConfig.accessKeyId = EnvCredentials.accessKeyId;
      }
      if (!secretAccessKey && EnvCredentials.secretAccessKey) {
        clientConfig.secretAccessKey = EnvCredentials.secretAccessKey;
      }
      if (!sessionToken && EnvCredentials.sessionToken) {
        clientConfig.sessionToken = EnvCredentials.sessionToken;
      }

      return next(args);
    }
  },
  options: {
    step: PRIORITY.credentialsMiddleware.step,
    name: "credentialsMiddleware",
    priority: PRIORITY.credentialsMiddleware.priority,
  },
};
