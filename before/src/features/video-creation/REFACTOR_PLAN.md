# 视频创作页逻辑优化方案 (已完成)

## 1. 现状分析 (已解决)

通过对代码的深度审查，发现 `src/features/videoCreation` 模块虽然采用了分层架构，但在具体实现细节上存在逻辑断层和职责不清的问题，主要体现在状态管理和数据流向方面。

### 主要问题

#### 1.1 状态管理混乱 (State Management Conflict)
- **Story与Outline维度的混淆**：
  - `useScenes` Hook 初衷是管理 Story 维度的分镜 (`loadScenes` 接收 `storyId`)。
  - 实际业务场景需要按 Outline 维度展示分镜。
  - 导致 `useVideoCreation` 不得不绕过 `useScenes` 的封装，手动调用 API 并使用 `setScenes` 直接修改内部状态。
  - 结果：`useScenes` 退化为单纯的 `useState` 包装器，失去了逻辑封装的作用；且 `currentStory` 等状态在切换大纲时可能未能正确更新。

#### 1.2 "上帝函数" 难以维护 (God Function)
- **`handleOutlineSelect` 职责过重**：
  - 该函数同时负责：状态重置、UI 交互、分镜数据获取、时间线数据获取 (fetch)、播放列表更新。
  - 数据获取逻辑和 UI 逻辑高度耦合。
  - 时间线数据的获取直接在 Hook 中使用 `fetch`，未封装进 Service 层。

#### 1.3 自动选择逻辑脆弱 (Fragile Auto-selection)
- `useVideoCreation` 中的 `useEffect` 负责自动选中第一个大纲。
- 依赖条件简单 (`stories.length > 0 && !selectedOutlineId`)，容易在数据刷新或边缘情况下产生非预期的状态重置。

#### 1.4 API 调用分散 (Scattered API Calls)
- 大部分 API 调用在 `StoryService` 中。
- 时间线数据 (`/api/video-creation/timeline`) 却直接散落在 `useVideoCreation` 中。
- 缺乏统一的错误处理和加载状态管理。

## 2. 优化方案 (已实施)

### 2.1 重构 `useScenes` Hook

将分镜加载逻辑完全收敛到 `useScenes` 中，支持按 Outline 维度加载。

**已修改：**
- 扩展了 `loadScenes` 方法，支持接收对象参数 `{ storyId?: string, outlineId?: string }`。
- 移除了 `useVideoCreation` 中手动 `setScenes` 的逻辑。

### 2.2 封装时间线服务

将时间线数据的获取逻辑封装到 Service 层。

**已修改：**
- 在 `src/features/videoCreation/services/storyService.ts` 中添加了 `fetchTimeline` 方法。
- 完善了 `TimelineVideoData` 类型定义。

### 2.3 拆分 `handleOutlineSelect`

将巨型函数拆分为职责单一的小函数，利用 `useEffect` 监听 `selectedOutlineId` 的变化来触发数据加载。

**已修改：**
- `handleOutlineSelect` 仅负责更新选中状态。
- 新增 `useEffect` 监听 `selectedOutlineId`，负责调用 `loadScenes` 和 `StoryService.fetchTimeline`。

### 2.4 优化自动选择逻辑

使用 `useRef` 记录初始化状态，防止重复触发自动选择。

**已修改：**
- 引入 `initializedRef`，确保自动选择逻辑只在初始化时执行一次。

## 3. 预期收益

*   **代码可维护性提升**：逻辑归位，Hook 职责单一，减少"上帝函数"。
*   **状态一致性**：通过收敛数据加载逻辑，避免状态不一致。
*   **扩展性增强**：未来增加新的分镜加载方式（如按角色筛选）更简单。
*   **调试更容易**：数据流向清晰，容易定位问题。
