/**
 * RDS MySQL authentication utilities
 *
 * Provides methods to generate authentication tokens for RDS MySQL database connections
 */

import { Client } from "../../client/Client";
import { Command } from "../../command/Command";

export interface BuildAuthTokenOptions {
  /** Database username */
  dbUser: string;
  /** RDS instance ID */
  instanceId: string;
  /** Token expiration time in seconds (default: 900, i.e., 15 minutes) */
  expires?: number;
}

/**
 * Build authentication token for RDS MySQL database connection
 *
 * Generates a pre-signed query string that can be used as an authentication
 * token to connect to RDS MySQL database instances.
 *
 * @param client - SDK client instance that carries credentials and region in config
 * @param options - Authentication token options
 * @returns Pre-signed query string (e.g., Action=ConnectDatabase&...)
 * @throws Error if required parameters are missing or invalid
 *
 * @example
 * ```typescript
 * const client = new Client({
 *   accessKeyId: "your-access-key",
 *   secretAccessKey: "your-secret-key",
 *   region: "cn-beijing",
 * });
 *
 * const token = await buildAuthToken(client, {
 *   dbUser: "admin",
 *   instanceId: "mysql-instance-id",
 *   expires: 900,
 * });
 * // => Action=ConnectDatabase&...
 * ```
 */
export async function buildAuthToken(
  client: Client,
  options: BuildAuthTokenOptions,
): Promise<string> {
  const { dbUser, instanceId, expires = 900 } = options;

  const { accessKeyId, secretAccessKey, region } = client.config;
  // Validate credentials
  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error(
      "Access key ID, secret access key, and region must not be empty",
    );
  }

  // Validate required parameters
  if (!dbUser || !instanceId) {
    throw new Error("DBUser and InstanceId must not be empty");
  }

  // Validate expires parameter
  if (typeof expires !== "number" || expires <= 0) {
    throw new Error("Expires must be a positive integer");
  }

  // Service name for RDS MySQL
  const service = "rds_mysql";

  // Build query parameters
  const query: Record<string, string> = {
    Action: "ConnectDatabase",
    Version: "2022-01-01",
    "X-Expires": String(expires),
    DBUser: dbUser,
    InstanceId: instanceId,
    "X-HOST": client.config.host || "",
  };

  client.config.host = "";
  client.config.protocol = undefined;

  const command = new Command(query);
  command.requestConfig = {
    method: "GET",
    serviceName: service,
    pathname: "/",
  };

  return (await client.presign(command)).replace("/?", "");
}
