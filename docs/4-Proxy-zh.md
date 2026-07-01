[← Transport](3-Transport-zh.md) | 代理配置 [(English)](4-Proxy.md) | [超时配置 →](5-Timeout-zh.md)

---

## HTTP(S) 代理配置

> **默认**
>
> - 无代理

### 在代码中配置

```typescript
const client = new ECSClient({
  region: "cn-beijing",
  httpOptions: {
    proxy: {
      protocol: "http",
      host: "127.0.0.1",
      port: 8888,
    },
  },
});
```

### 使用环境变量

SDK 会自动读取以下环境变量来配置代理：

- `VOLC_PROXY_PROTOCOL`：代理协议（`http` 或 `https`）
- `VOLC_PROXY_HOST`：代理主机
- `VOLC_PROXY_PORT`：代理端口

优先级：代码配置 > 环境变量。

---

[← Transport](3-Transport-zh.md) | 代理配置 [(English)](4-Proxy.md) | [超时配置 →](5-Timeout-zh.md)
