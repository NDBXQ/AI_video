# Coze 接口清单（AI Video）

本文档整理了本项目中所有与 Coze 相关的“对外接口调用点”（Coze run endpoint 的 HTTP 调用）以及“Coze SDK 能力使用点”（`coze-coding-dev-sdk`）。不包含与 Coze 无关的普通业务 API。

## 1. 总览

**外部 Coze（run endpoint）主要用途**

- 故事内容 → 大纲（outline）生成：由 `/api/storyboard/generate-text` 代理调用
- 大纲/原文 → 分镜文本（storyboard_list）生成：由 `/api/storyboard/coze-generate-text` 代理调用
- 文本脚本 → 分镜脚本（video_script）生成：由 `/api/coze/generate-script` 代理调用
- 分镜脚本 → 提示词（video_prompt/image_prompt 等）生成：由 `/api/video-creation/prompts/generate` 与 `/api/video-creation/scripts/create` 内部异步调用
- 提示词/参考图 → 合成图生成：服务端业务层直连 Coze（`composeImage`）
- 提示词/参考图 → 视频生成：服务端 integration 直连 Coze（`requestCozeVideoGenerate`）
- 提示词 → 参考图生成：服务端业务层直连 Coze（`generateImageByCoze`）

**Coze SDK（`coze-coding-dev-sdk`）用途**

- `LLMClient.invoke(...)`：图片识别（多模态/视觉模型）
- `S3Storage`：对象存储（S3 兼容）上传/下载/预签名 URL
- `getDb()`：数据库访问（项目内多处 manager 使用）

## 2. 外部 Coze HTTP 接口（run endpoint）

### 2.1 故事大纲生成（Outline）

- **调用点**：`POST /api/storyboard/generate-text` → `fetch(COZE_API_URL)`
- **代码**：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/storyboard/generate-text/route.ts#L5-L66)
- **鉴权**：`Authorization: Bearer ${COZE_API_TOKEN}`
- **环境变量**
  - `COZE_API_URL`
  - `COZE_API_TOKEN`

**请求体（发往 Coze）**

```json
{
  "input_type": "original",
  "story_text": "..."
}
```

**响应体（Coze 期望返回）**

```json
{
  "story_original": "...",
  "story_text": "...",
  "outline_original_list": [
    { "outline": "...", "original": "..." }
  ],
  "run_id": "..."
}
```

### 2.2 分镜文本生成（Storyboard Text）

- **调用点**：`POST /api/storyboard/coze-generate-text` → `fetch(CREATE_STORYBOARD_TEXT_URL)`
- **代码**：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/storyboard/coze-generate-text/route.ts#L8-L77)
- **鉴权**：`Authorization: Bearer ${CREATE_STORYBOARD_TEXT_TOKEN}`
- **环境变量**
  - `CREATE_STORYBOARD_TEXT_URL`
  - `CREATE_STORYBOARD_TEXT_TOKEN`

**请求体（发往 Coze）**

```json
{
  "outline": "...",
  "original": "..."
}
```

**响应体（Coze 期望返回）**

```json
{
  "storyboard_list": [
    { "shot_cut": false, "storyboard_text": "..." }
  ],
  "run_id": "..."
}
```

### 2.3 分镜脚本生成（Video Script）

- **调用点**：`POST /api/coze/generate-script` → `fetch(COZE_SCRIPT_API_URL)`
- **代码**：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/coze/generate-script/route.ts#L48-L83)
- **鉴权**：`Authorization: Bearer ${COZE_SCRIPT_API_TOKEN}`
- **环境变量**
  - `COZE_SCRIPT_API_URL`
  - `COZE_SCRIPT_API_TOKEN`

**请求体（发往 Coze）**

```json
{
  "raw_script": "...",
  "demand": "..."
}
```

**响应体（代码约束）**

- 代码要求 `data.video_script` 必须存在，否则视为格式错误：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/coze/generate-script/route.ts#L174-L185)
- 如 `data.video_script.error` 存在，仍返回 `success: true` 但 message 带“警告”：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/coze/generate-script/route.ts#L163-L172)

### 2.4 提示词生成（Prompt）

该能力在项目中存在两套调用方式：一套是“线上业务路由（硬编码 token）”，另一套是“测试路由（env 注入 token）”。两者**请求体包裹方式不完全一致**（详见第 5 节）。

**A. 线上业务路由：`/api/video-creation/prompts/generate`**

- **调用点**：`POST /api/video-creation/prompts/generate` → `fetch(PROMPT_API_URL)`
- **代码**：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/video-creation/prompts/generate/route.ts#L6-L55)
- **鉴权**：`Authorization: Bearer <硬编码token>`（不建议）
- **外部 URL**：硬编码 `https://jyyj7yy9p5.coze.site/run`

**请求体（发往 Coze）**

该路由读取 `{ script_json }` 后，直接将 `script_json` 作为 body 发给 Coze（未包一层 `{script_json: ...}`）：

```json
{ "...": "这里是 script_json 本身" }
```

**B. 创建脚本后异步生成：`/api/video-creation/scripts/create` 内部异步任务**

- **调用点**：`generateAndSavePromptAsync()` → `fetch(PROMPT_API_URL)`
- **代码**：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/video-creation/scripts/create/route.ts#L13-L43)
- **鉴权**：`Authorization: Bearer <硬编码token>`（不建议）
- **外部 URL**：硬编码 `https://jyyj7yy9p5.coze.site/run`
- **输出字段**：期望 `video_prompt / image_prompt_type / image_prompt / run_id`，并写入 prompts 表：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/video-creation/scripts/create/route.ts#L64-L87)

**C. 测试直连：`/api/internal/test/call-coze-directly`（env 注入）**

- **调用点**：`POST /api/internal/test/call-coze-directly` → `fetch(COZE_PROMPT_API_URL)`
- **代码**：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/internal/test/call-coze-directly/route.ts#L3-L40)
- **环境变量**
  - `COZE_PROMPT_API_URL`
  - `COZE_PROMPT_API_TOKEN`
- **行为**：把请求体原样转发到 Coze，并尝试解析响应为 JSON

### 2.5 参考图生成（Reference Image）

- **调用点**：业务层直连 `generateImageByCoze()` → `fetch(COZE_REFERENCE_IMAGE_API_URL || default)`
- **代码**：[cozeClient.ts](file:///Users/bytedance/dev/AI%20Video/src/features/video-creation/services/image-generation/cozeClient.ts#L38-L56)
- **鉴权**：`Authorization: Bearer ${COZE_REFERENCE_IMAGE_API_TOKEN}`
- **环境变量**
  - `COZE_REFERENCE_IMAGE_API_URL`（缺省：`https://bx3fr9ndvs.coze.site/run`）
  - `COZE_REFERENCE_IMAGE_API_TOKEN`

**请求体（发往 Coze）**

```json
{
  "prompt": "...",
  "image_type": "background"
}
```

**响应体（提取规则）**

- 字段不固定，代码会从 `data/url/image/image_url/...` 以及任意首个 `http|data:` 字符串中提取 URL：[extractCozeImageUrl](file:///Users/bytedance/dev/AI%20Video/src/features/video-creation/services/image-generation/cozeClient.ts#L16-L30)

### 2.6 图片合成（Image Compose）

- **调用点**：业务层直连 `composeImage()` → `fetch(COZE_IMAGE_COMPOSE_API_URL)`
- **代码**：[compositionService.ts](file:///Users/bytedance/dev/AI%20Video/src/features/video-creation/services/compositionService.ts#L98-L141)
- **鉴权**：`Authorization: Bearer ${COZE_IMAGE_COMPOSE_API_TOKEN}`
- **环境变量**
  - `COZE_IMAGE_COMPOSE_API_URL`
  - `COZE_IMAGE_COMPOSE_API_TOKEN`

**请求体（发往 Coze）**

```json
{
  "image_list": [
    { "image_name": "角色A", "image_url": "https://..." }
  ],
  "prompt": "...",
  "aspect_ratio": "4:3"
}
```

**响应体（提取规则）**

- 优先读取 `generated_image_url`，否则复用 `extractCozeImageUrl()` 提取：[compositionService.ts](file:///Users/bytedance/dev/AI%20Video/src/features/video-creation/services/compositionService.ts#L134-L141)

### 2.7 视频生成（Video Generate）

- **调用点**：integration 直连 `requestCozeVideoGenerate()` → `fetch(COZE_VIDEO_GENERATE_API_URL || default)`
- **代码**：[videoGenerate.ts](file:///Users/bytedance/dev/AI%20Video/src/server/integrations/coze/videoGenerate.ts#L19-L53)
- **鉴权**：`Authorization: Bearer ${COZE_VIDEO_GENERATE_API_TOKEN}`
- **环境变量**
  - `COZE_VIDEO_GENERATE_API_URL`（缺省：`https://3f47zmnfcb.coze.site/run`）
  - `COZE_VIDEO_GENERATE_API_TOKEN`

**请求体（发往 Coze）**

```json
{
  "prompt": "...",
  "mode": "首帧",
  "generate_audio": true,
  "ratio": "16:9",
  "duration": 4,
  "watermark": false,
  "image": { "url": "https://...", "file_type": "image" }
}
```

**响应体（提取规则）**

- 从 `generated_video_url || video_url || data || url` 提取视频 URL：[videoGenerate.ts](file:///Users/bytedance/dev/AI%20Video/src/server/integrations/coze/videoGenerate.ts#L68-L73)

## 3. 项目内部“Coze 代理/封装”API（给前端/业务调用）

这些接口是 Next.js Route Handler，对外暴露给前端；其内部会调用第 2 节的 Coze run endpoint（或调用封装 service）。

### 3.1 `POST /api/storyboard/generate-text`（大纲生成代理）

- **入口类型**：前端通过 `apiClient.generateStoryboardText()` 调用：[client.ts](file:///Users/bytedance/dev/AI%20Video/src/lib/api/client.ts#L62-L75)
- **请求体（前端 → 本项目 API）**

```json
{
  "input_type": "original",
  "story_text": "..."
}
```

- **响应体（本项目 API → 前端）**

```json
{
  "success": true,
  "data": {
    "story_text": "...",
    "story_original": "...",
    "outline_original_list": [{ "outline": "...", "original": "..." }],
    "run_id": "..."
  },
  "message": "生成成功"
}
```

### 3.2 `POST /api/storyboard/coze-generate-text`（分镜文本生成代理）

- **调用方**：`useStoryboardGeneration()`：[useStoryboardGeneration.ts](file:///Users/bytedance/dev/AI%20Video/src/app/storyboard/text/hooks/useStoryboardGeneration.ts#L31-L163)
- **请求体（前端 → 本项目 API）**

```json
{
  "outline": "...",
  "original": "...",
  "outlineId": "可选，用于落库",
  "sequence": 1
}
```

- **响应体（本项目 API → 前端）**
  - `shotCut`：是否存在任意 `shot_cut=true`
  - `storyboardTexts`：当传入 `outlineId` 时，落库后返回该大纲下的所有分镜文本
  - `runId`：Coze `run_id`

参考实现：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/storyboard/coze-generate-text/route.ts#L198-L219)

### 3.3 `POST /api/coze/generate-script`（分镜脚本生成代理）

- **调用方**：`ScriptGenerationService.generateScript()`：[scriptGenerationService.ts](file:///Users/bytedance/dev/AI%20Video/src/features/video-creation/services/scriptGenerationService.ts#L61-L118)
- **请求体（前端 → 本项目 API）**

```json
{
  "raw_script": "...",
  "demand": "..."
}
```

- **响应体（本项目 API → 前端）**
  - 成功：`{ success: true, data: <coze原样JSON>, message }`
  - 失败：`{ success: false, message, details? }`（HTTP status 可能透传 Coze status）

### 3.4 `POST /api/video-creation/prompts/generate`（提示词生成代理）

- **调用方**：`promptGenerationService.generatePrompts()`：[promptGenerationService.ts](file:///Users/bytedance/dev/AI%20Video/src/features/video-creation/services/promptGenerationService.ts#L23-L63)
- **请求体（前端 → 本项目 API）**

```json
{
  "script_json": { "...": "分镜脚本 JSON" }
}
```

- **响应体（本项目 API → 前端）**

```json
{
  "success": true,
  "message": "提示词生成成功",
  "data": { "...": "Coze 原样返回" }
}
```

### 3.5 `POST /api/video-creation/images/generate`（参考图生成）

- **内部逻辑**：调用 `generateReferenceImages()`，其内部通过 `generateImageByCoze()` 直连 Coze：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/video-creation/images/generate/route.ts#L13-L54)
- **请求体（前端 → 本项目 API）**

```json
{
  "storyboardId": "...",
  "prompts": [
    { "name": "角色A", "prompt": "...", "type": "role" }
  ],
  "storyId": "可选",
  "forceRegenerate": false
}
```

- **响应体（本项目 API → 前端）**
  - `images/skipped/errors`：逐条结果汇总

### 3.6 `POST /api/video-creation/images/compose`（合成图生成）

- **内部逻辑**：调用 `composeImage()`（业务层直连 Coze）：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/video-creation/images/compose/route.ts#L17-L44)
- **请求体**

```json
{ "storyboardId": "..." }
```

- **响应体**

```json
{ "success": true, "data": { "image": { "id": "...", "url": "...", "thumbnailUrl": "...", "prompt": "..." } } }
```

### 3.7 `POST /api/video-creation/videos/generate`（视频生成）

- **内部逻辑**：调用 `generateVideo()`，其内部会调用 `requestCozeVideoGenerate()`：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/video-creation/videos/generate/route.ts#L34-L51)
- **请求体**

```json
{
  "storyboardId": "...",
  "mode": "首帧",
  "generateAudio": true,
  "watermark": false,
  "forceRegenerate": false
}
```

## 4. Coze SDK 能力使用点（coze-coding-dev-sdk）

### 4.1 视觉识别（LLMClient）

- **接口**：`POST /api/image-recognition`
- **代码**：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/image-recognition/route.ts#L16-L88)
- **调用方式**：`client.invoke(messages, { model, temperature })`
- **请求体（前端 → 本项目 API）**

```json
{
  "imageData": "base64（可选）",
  "imageUrl": "https://...（可选）",
  "prompt": "可选，自定义提问"
}
```

### 4.2 对象存储（S3Storage）

- **封装入口**：`createCozeStorage()`：[storage.ts](file:///Users/bytedance/dev/AI%20Video/src/features/video-creation/services/image-generation/storage.ts#L7-L15)
- **环境变量**
  - `COZE_BUCKET_ENDPOINT_URL`
  - `COZE_BUCKET_ACCESS_KEY`
  - `COZE_BUCKET_SECRET_KEY`
  - `COZE_BUCKET_NAME`
  - `COZE_BUCKET_REGION`
- **测试连通性**：`GET /api/internal/test/test-bucket-connection`：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/internal/test/test-bucket-connection/route.ts#L11-L41)

## 5. 已知差异与注意事项（对接排障必看）

### 5.1 Prompt 接口请求体包裹方式不一致

项目内存在两种向 Coze prompt endpoint 发送 body 的方式：

- **未包裹**：直接把 `script_json` 本体作为 body
  - `/api/video-creation/prompts/generate`：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/video-creation/prompts/generate/route.ts#L45-L55)
  - `/api/video-creation/scripts/create` 的异步任务：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/video-creation/scripts/create/route.ts#L30-L43)
- **有包裹**：`{ "script_json": <scriptJson> }`
  - `/api/internal/test/async-prompt`：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/internal/test/async-prompt/route.ts#L31-L40)
  - `/api/internal/test/debug-prompt-generation`：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/internal/test/debug-prompt-generation/route.ts#L31-L51)
  - `/api/internal/test/generate-prompt-only`：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/internal/test/generate-prompt-only/route.ts#L125-L147)

当 prompt 生成出现 “参数不识别/格式错误/JSON Extra data” 之类问题时，优先对照以上两种 body 结构排查。

### 5.2 Token/URL 硬编码风险

以下路由存在 Coze URL/Token **硬编码**（不应提交到仓库，且不利于多环境部署）：

- `/api/video-creation/prompts/generate`：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/video-creation/prompts/generate/route.ts#L6-L9)
- `/api/video-creation/scripts/create`：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/video-creation/scripts/create/route.ts#L6-L8)
- `/api/internal/test/debug-prompt-generation`：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/internal/test/debug-prompt-generation/route.ts#L3-L4)
- `/api/internal/test/async-prompt`：[route.ts](file:///Users/bytedance/dev/AI%20Video/src/app/api/internal/test/async-prompt/route.ts#L4-L6)

建议统一迁移为环境变量（例如：`COZE_PROMPT_API_URL/COZE_PROMPT_API_TOKEN`），并避免在日志中输出任何可复用凭证。

## 6. 环境变量速查表

| 能力 | URL | Token |
|---|---|---|
| 故事大纲（outline） | `COZE_API_URL` | `COZE_API_TOKEN` |
| 分镜文本（storyboard_list） | `CREATE_STORYBOARD_TEXT_URL` | `CREATE_STORYBOARD_TEXT_TOKEN` |
| 分镜脚本（video_script） | `COZE_SCRIPT_API_URL` | `COZE_SCRIPT_API_TOKEN` |
| Prompt（测试/直连） | `COZE_PROMPT_API_URL` | `COZE_PROMPT_API_TOKEN` |
| 参考图（reference image） | `COZE_REFERENCE_IMAGE_API_URL` | `COZE_REFERENCE_IMAGE_API_TOKEN` |
| 图片合成（compose） | `COZE_IMAGE_COMPOSE_API_URL` | `COZE_IMAGE_COMPOSE_API_TOKEN` |
| 视频生成（video generate） | `COZE_VIDEO_GENERATE_API_URL` | `COZE_VIDEO_GENERATE_API_TOKEN` |
| 图片合成（测试） | `COZE_IMAGE_API_URL` | `COZE_IMAGE_API_TOKEN` |
| 视频生成（测试） | `COZE_VIDEO_API_URL` | `COZE_VIDEO_API_TOKEN` |
| 对象存储（S3） | `COZE_BUCKET_ENDPOINT_URL / COZE_BUCKET_NAME / COZE_BUCKET_REGION` | `COZE_BUCKET_ACCESS_KEY / COZE_BUCKET_SECRET_KEY` |
| Workload Identity（仅检测存在） | - | `COZE_WORKLOAD_IDENTITY_API_KEY` |

## 7. 内部测试路由清单（与 Coze 对接相关）

这些路由位于 `src/app/api/internal/test/*`，通常用于联调/排障，不建议暴露到生产环境。

- Prompt 直连转发器：[/call-coze-directly](file:///Users/bytedance/dev/AI%20Video/src/app/api/internal/test/call-coze-directly/route.ts#L1-L85)
- Prompt（包裹 `script_json`）最小调用：[/async-prompt](file:///Users/bytedance/dev/AI%20Video/src/app/api/internal/test/async-prompt/route.ts#L1-L70)
- Prompt 调试（包含结构校验与回包透传）：[/debug-prompt-generation](file:///Users/bytedance/dev/AI%20Video/src/app/api/internal/test/debug-prompt-generation/route.ts#L1-L86)
- Prompt 生成并落库（env 注入，内部会转换脚本格式）：[/generate-prompt-only](file:///Users/bytedance/dev/AI%20Video/src/app/api/internal/test/generate-prompt-only/route.ts#L1-L226)
- 图片合成测试（使用 `COZE_IMAGE_API_URL/COZE_IMAGE_API_TOKEN`）：[/compose-image](file:///Users/bytedance/dev/AI%20Video/src/app/api/internal/test/compose-image/route.ts#L16-L110)
- 视频生成测试（使用 `COZE_VIDEO_API_URL/COZE_VIDEO_API_TOKEN`）：[/generate-video](file:///Users/bytedance/dev/AI%20Video/src/app/api/internal/test/generate-video/route.ts#L28-L147)
- 对象存储连通性测试：[/test-bucket-connection](file:///Users/bytedance/dev/AI%20Video/src/app/api/internal/test/test-bucket-connection/route.ts#L11-L59)
