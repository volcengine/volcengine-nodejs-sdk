import { Client } from "../src/client/Client";
import { Command } from "../src/command/Command";
import { presignUrl } from "../src/utils/signer";

describe("Client.presign", () => {
  test("generates presigned url with resolved endpoint", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-01T12:00:00Z"));

    const client = new Client({
      accessKeyId: "AKTEST123",
      secretAccessKey: "SKTEST456",
      region: "cn-beijing",
    });

    const command = new Command({
      Action: "GetUser",
      UserName: "testuser",
      Version: "2018-01-01",
    });
    command.requestConfig = {
      method: "GET",
      serviceName: "iam",
      pathname: "/",
    };

    const url = await client.presign(command);

    const expected = presignUrl({
      method: "GET",
      uri: "/",
      query: {
        Action: "GetUser",
        UserName: "testuser",
        Version: "2018-01-01",
      },
      region: "cn-beijing",
      serviceName: "iam",
      accessKeyId: "AKTEST123",
      secretAccessKey: "SKTEST456",
      host: client.config.host,
    });

    expect(url).toBe(expected);

    jest.useRealTimers();
  });
});
