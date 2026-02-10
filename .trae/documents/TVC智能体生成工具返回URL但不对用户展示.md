## 门禁声明
以下为方案阶段内容，仅包含方案设计与验收标准；不包含任何代码改动、命令执行或补丁输出。

## 需求复述
调整智能体的生成类工具（参考图/合成图/视频）返回内容：在原有 `{ordinal,status}` 基础上增加 `url`，让模型知道生成产物的链接；但模型对用户的自然语言输出不需要（也不应）把链接告诉用户。

## 范围
- In scope：TVC 智能体三个生成工具返回 JSON 增加 `url`；同步更新系统提示词契约。
- Out of scope：不返回 `thumbnailUrl`；不做服务端兜底脱敏；不改前端展示。

## 影响面
- 工具定义/执行器：[vibeCreatingLlmTools.ts](file:///Users/bytedance/dev/ai-video/src/server/tvc/vibeCreating/tools/vibeCreatingLlmTools.ts)
- 系统提示词合同：[vibeCreatingSystemPrompt.ts](file:///Users/bytedance/dev/ai-video/src/server/tvc/vibeCreating/agent/vibeCreatingSystemPrompt.ts)
- 三个生成用例：
  - 参考图：[generateReferenceImagesBatch.ts](file:///Users/bytedance/dev/ai-video/src/server/tvc/vibeCreating/tooling/usecases/generateReferenceImagesBatch.ts)
  - 首帧：[generateFirstFramesFromReferencesBatch.ts](file:///Users/bytedance/dev/ai-video/src/server/tvc/vibeCreating/tooling/usecases/generateFirstFramesFromReferencesBatch.ts)
  - 视频：[generateVideosFromFirstFramesBatch.ts](file:///Users/bytedance/dev/ai-video/src/server/tvc/vibeCreating/tooling/usecases/generateVideosFromFirstFramesBatch.ts)

## 方案A（推荐）
1) **工具返回结构向后兼容扩展**
- 从：`{ results: [{ ordinal, status }] }`
- 扩展为：`{ results: [{ ordinal, status, url? , kind }] }`
  - `url`：成功时返回生成产物的可访问链接（图片/视频使用持久化后的 `persisted.url`）。
  - `kind`：`reference_image | first_frame | video_clip`，便于模型区分三类产物。
  - 失败项不返回 url（或置空）。

2) **提示词契约更新（确保不对用户输出 url）**
- 将“工具不包含 URL”的约束改为：工具会返回 url，但该 url 仅供模型内部理解/后续工具入参使用。
- 对用户输出仍只用 ordinal 自然语言表达（例如“第2张参考图/第3段视频”），明确禁止在 `<response>` 中粘贴 url。

## 任务拆解
1) 扩展三个生成用例的 `results` 类型与组装逻辑（写入 url/kind）。
2) 更新工具执行器返回 JSON（透传新字段）与工具描述文本。
3) 更新系统提示词契约第 9/10 条对工具返回/用户输出的约束。

## 验收标准
- 工具侧：三类生成工具每个成功项都返回 `ordinal/status/url/kind`，且旧字段保持可用。
- 对话侧：用户可见 `<response>` 中不出现 url，仅按 ordinal 描述生成结果。
- 回归：参考图/首帧/视频生成与资产入库、前端展示流程不受影响。

## 风险与回滚
- 风险：模型仍可能误把 url 输出给用户（仅靠提示词约束）。
- 回滚：移除 url 字段并恢复提示词“工具不含 URL”的原约束。

如需我进入执行阶段，请回复精确口令：确认方案并执行（按方案A）。