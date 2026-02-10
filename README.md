# ai-video

Next.js App Router 项目骨架（TypeScript + ESLint）。

## 项目结构约定
- 见 [docs/architecture.md](file:///Users/bytedance/dev/ai-video/docs/architecture.md)

## 超级管理员后台（API 测试台）

### 访问条件
- 默认仅在非生产环境可用；生产环境需设置 `ADMIN_PANEL_ENABLED=1` 才会放行 `/admin`。
- 仅允许账号为 `admin` 的用户访问 `/admin/**`。

### 登录账号
- 账号：`admin`
- 密码：`admin`

说明：项目登录逻辑会在首次使用该账号登录时自动创建用户，因此无需提前建库。

### 入口
- 登录后（账号为 `admin`），顶部栏会出现“盾牌”图标入口，或直接访问：`/admin`。

### 使用方式
1. 使用 `admin/admin` 登录。
2. 打开 `/admin/api-tester`，在左侧选择接口。
3. 编辑请求 Method、URL、Headers、Body（JSON/Text/FormData/File），点击“发送”查看响应。
4. 需要测试事件流接口时，勾选“流式模式（EventSource）”（仅支持 GET）。
5. “历史”会保存最近 40 条请求到 localStorage，可一键复用；“复制 curl”可导出当前请求。
