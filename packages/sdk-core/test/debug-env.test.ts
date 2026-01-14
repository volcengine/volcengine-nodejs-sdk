describe("Debug Env", () => {
  it("should log VOLC_PROXY_PORT", () => {
    console.log("VOLC_PROXY_PORT:", process.env.VOLC_PROXY_PORT);
    console.log("VOLC_PROXY_HOST:", process.env.VOLC_PROXY_HOST);
  });
});
