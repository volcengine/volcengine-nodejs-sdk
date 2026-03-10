declare module "@volcengine/ark" {
  export class ARKClient {
    constructor(opts: any);
    send<T = any>(command: any): Promise<T>;
  }
  export class GetApiKeyCommand {
    constructor(opts: any);
  }
}
