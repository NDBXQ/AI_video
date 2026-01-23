# 修改 Coze 改写接口的请求体格式

## 需求分析
- 当前代码中，`callCozeRunEndpoint` 调用的 `body` 字段传递了一个对象 `{"text": parsed.data}`。
- 实际上，`callCozeRunEndpoint` 期望的 `body` 参数（如果它是一个通用的 fetch 包装器）可能需要根据 Content-Type 自动处理，或者明确需要传入 JSON 字符串。
- 用户明确要求将第 88 行的 `body: {"text": parsed.data},` 改为字符串形式。这意味着我们需要使用 `JSON.stringify`。

## 修改计划
1.  **文件**: `/Users/bytedance/dev/ai-video/src/app/api/coze/rewrite/route.ts`
2.  **修改点**: 第 88 行
3.  **修改内容**: 将 `body: {"text": parsed.data},` 修改为 `body: JSON.stringify({"text": parsed.data}),`。

## 验证方案
- **代码静态检查**: 修改后，如果 `callCozeRunEndpoint` 的类型定义允许 `body` 为字符串，则 lint 不会报错。
- **功能验证**: 这通常是修复 API 调用失败（如 400 Bad Request）的问题，因为许多后端框架如果不接收 JSON 字符串作为 body，会无法解析。

## 风险评估
- 风险极低。如果 `callCozeRunEndpoint` 内部已经做了 `JSON.stringify`，那么这里再做一次可能会导致双重序列化。但通常通用 fetch 封装会期望调用者控制 body 格式，或者根据 header 决定。如果之前是直接传对象导致问题，那么转为字符串是标准的修复方式。
