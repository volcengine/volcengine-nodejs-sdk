import type { CredentialValue, Provider } from "./types";

/**
 * Static AK/SK(/Token) credential provider.
 *
 * Credentials never expire and are never refreshed – suitable for long-lived
 * server-side secrets.
 */
export class StaticCredentialProvider implements Provider {
  readonly providerName = "StaticCredentialProvider";
  private readonly credentials: CredentialValue;

  constructor({
    accessKeyId,
    secretAccessKey,
    sessionToken,
  }: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  }) {
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "StaticCredentialProvider: accessKeyId and secretAccessKey are required",
      );
    }

    this.credentials = {
      accessKeyId,
      secretAccessKey,
      sessionToken,
      providerName: this.providerName,
    };
  }

  async resolveCredentials(): Promise<CredentialValue> {
    return this.credentials;
  }
}
