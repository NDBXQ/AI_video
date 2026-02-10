# 项目结构约定（Next.js App Router）

## 目标
- 模块化、结构化、可维护、可扩展
- 路由层只做编排，业务逻辑集中在领域模块
- 共享能力有唯一来源，避免重复实现

## 目录职责

### src/app（路由/编排层）
- `page.tsx`/`layout.tsx`：只做页面编排与组合，避免承载复杂业务逻辑
- `api/**/route.ts`：只做 HTTP 适配（参数校验、鉴权、调用服务端用例、返回标准响应）
- `proxy.ts`：仅用于必须在路由之前执行的拦截逻辑（尽量作为最后手段）

### src/server（服务端领域层）
- 存放业务真相：用例编排、数据访问、第三方集成与任务调度
- 建议逐步按域组织到 `src/server/domains/<domain>/**`，并在域内拆分：
  - `usecases/`：业务流程编排（跨 repo/服务的 orchestration）
  - `repos/`：数据库读写
  - `contracts/`：领域输入输出 DTO 与类型
  - `errors/`：领域错误定义（便于 route/controller 统一映射为 HTTP）
- `src/server/actions/**`：Server Actions 入口，仅做鉴权/入参校验/调用 usecase，避免混入复杂 SQL 与业务分支

### src/features（前端业务域）
- 存放页面所需的业务 UI、hooks 与前端状态
- 推荐结构：`components/ hooks/ api-client/ types/ utils/`
- 前端不直接依赖数据库访问与服务端实现细节

### src/shared（跨域共享）
- `shared/ui`：跨业务复用的 UI primitives（无业务规则）
- `shared/utils`：通用工具函数（无业务规则）
- `shared/contracts`：跨端共享类型/DTO
- `shared/logger`、`shared/trace`、`shared/session`：基础设施能力

### src/components（应用壳组件）
- 只放全局壳层组件（如 Header、Layout Shell 等）
- 可复用 UI primitive 优先放 `src/shared/ui`，避免多个入口并存

## 工程脚本约定
- `lint`：eslint
- `check:types`：TypeScript 类型检查
- `check:guards`：项目自定义质量门禁脚本
- `check`：聚合执行 `lint + check:types + check:guards`
