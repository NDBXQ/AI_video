# 项目重构计划 (Refactoring Plan)

## 已完成工作 (Completed)

1.  **`src/features/video` 模块化重构**
    - 将 `CreateWorkspacePage.tsx` (原 600+ 行) 拆分为以下模块：
        - **UI 组件**: `ImageParamsSidebar`, `VideoParamsSidebar`, `MediaPreviewPanel`, `GenerationHeader`.
        - **Hooks**:
            - `useWorkspaceData.ts`: 负责数据获取 (Storyboards, Previews).
            - `useWorkspaceState.ts`: 负责表单状态管理和 URL 同步.
            - `useGenerationActions.ts`: 负责 API 调用 (生图/生视频).
    - 修复了相关组件的 Props 定义 (`ImageParamsSidebar`, `VideoParamsSidebar`).

2.  **服务端类型修复**
    - 修复了 `ImageGenerationService` 和 `StoryboardService` 中 `traceId` 类型不匹配的问题 (Strict Null Checks).

3.  **构建验证**
    - 项目构建 (`npm run build`) 成功通过.

## 后续建议 (Next Steps)

1.  **Service 层重构**
    - 目前 API Route (如 `api/video/storyboards/route.ts`) 仍包含大量业务逻辑.
    - 建议将更多逻辑移至 `src/server/services/` 下的 Service 类中, 保持 API Route 轻量化 (仅做 Controller).

2.  **`useAutoGenerateStoryboards.ts` 优化**
    - 该 Hook 依然较为复杂 (384 行).
    - 建议将 API 调用封装为 Service 函数.
    - 优化资源生成的并发逻辑.

3.  **CSS 模块化**
    - `StoryboardList.module.css` 等大文件可以进一步拆分, 跟随组件拆分进行解耦.

4.  **统一错误处理**
    - 建立统一的 API 错误响应格式和前端错误捕获机制 (Error Boundary).

## 目录结构调整建议

建议采用 **Features-First** 架构:

```
src/
├── app/                  # 路由层
├── features/             # 业务特性
│   ├── video/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/     # 前端 Service (API Client)
│   │   └── types/
│   └── library/
├── server/               # 后端核心
│   ├── services/         # 业务逻辑 (Domain Logic)
│   ├── db/               # 数据访问
│   └── jobs/             # 异步任务
└── shared/               # 共享代码
```
