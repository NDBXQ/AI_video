# 视频创作功能模块化文档

## 概述

本项目采用**自上而下的模块化设计**，将视频创作功能从594行的单文件拆分为清晰的分层架构。

## 业务流程

```
Story（故事）
  └── Outline（大纲）
        └── StoryboardText（分镜文本）  ← 步骤1
              └── StoryboardScript（分镜脚本）  ← 步骤2
                    └── 参考图  ← 步骤3
                          └── 合成图  ← 步骤4
                                └── 视频  ← 步骤5
```

## 架构设计

### 分层结构

```
src/features/videoCreation/
├── domain/          # 领域层
│   ├── types.ts     # 类型定义
│   ├── constants.ts # 常量定义
│   └── validators.ts# 业务验证逻辑
├── services/        # 服务层
│   ├── index.ts
│   └── storyService.ts
├── hooks/           # Hooks层
│   ├── index.ts
│   ├── useStories.ts
│   ├── useScenes.ts
│   ├── usePlayback.ts
│   ├── useSynthesis.ts
│   └── useVideoCreation.ts
└── components/      # 组件层
    ├── index.ts
    ├── OutlineListPanel.tsx
    ├── SceneListPanel.tsx
    ├── VideoPreviewPanel.tsx
    ├── TimelinePanel.tsx
    ├── AudioConfigPanel.tsx
    ├── EffectConfigPanel.tsx
    ├── ExportConfigPanel.tsx
    └── SynthesisSuccessPanel.tsx
```

### 各层职责

#### 1. 领域层 (Domain Layer)
**职责**: 定义核心业务模型和规则

- **types.ts**: 所有领域类型定义
  - Story, Scene: 故事和分镜模型
  - AudioConfig, EffectConfig: 配置模型
  - 枚举类型: VoiceType, TransitionType等

- **constants.ts**: 业务常量
  - 默认配置
  - 可选值列表
  - UI常量（时间线尺寸等）

- **validators.ts**: 业务逻辑和验证
  - 数据验证函数
  - 时间计算逻辑
  - 业务规则判断

#### 2. 服务层 (Service Layer)
**职责**: 封装API调用和数据转换

- **storyService.ts**: 故事相关API
  - fetchStories(): 获取故事列表
  - fetchStoryDetail(): 获取故事详情
  - fetchOutlineScenes(): 获取大纲分镜

#### 3. Hooks层 (Hooks Layer)
**职责**: 管理状态和副作用

- **useStories**: 故事列表管理
- **useScenes**: 分镜列表管理
- **usePlayback**: 播放控制逻辑
- **useSynthesis**: 视频合成状态管理
- **useVideoCreation**: 组合主Hook，提供统一API

#### 4. 组件层 (Component Layer)
**职责**: UI展示和交互

- **OutlineListPanel**: 大纲选择面板
- **SceneListPanel**: 分镜列表面板
- **VideoPreviewPanel**: 视频预览面板
- **TimelinePanel**: 时间线面板
- **AudioConfigPanel**: 音频配置面板
- **EffectConfigPanel**: 特效配置面板
- **ExportConfigPanel**: 导出配置面板
- **SynthesisSuccessPanel**: 合成成功提示面板

#### 5. 页面层 (Page Layer)
**职责**: 组件组装和布局

- **page.tsx**: 简洁的页面组装（139行）

## 核心类型定义

### Story（故事）
```typescript
interface Story {
  id: string;
  storyId: string;
  title: string;
  duration: number;      // 总时长（秒）
  sceneCount: number;    // 分镜数量
  createdAt: string;
  storyText?: string;
  outlines?: OutlineData[];
}
```

### Scene（分镜）
```typescript
interface Scene {
  id: string;
  storyId: string;           // 故事ID
  storyboardTextId: string;  // 分镜文本ID
  sequence: number;          // 序号
  title: string;
  content: string;           // 分镜内容描述
  duration: number;          // 时长（秒）
  thumbnail: string;         // 缩略图URL
  // ...
}
```

## 设计原则

### 1. 单一职责原则 (SRP)
每个模块只负责一个具体的功能领域：
- domain层只关心业务模型
- services层只关心API调用
- hooks层只关心状态管理
- components层只关心UI展示

### 2. 依赖倒置原则 (DIP)
高层模块不依赖低层模块，都依赖抽象（类型）：
- components依赖hooks的返回类型
- hooks依赖domain的类型定义
- page通过组合使用各层功能

### 3. 开闭原则 (OCP)
对扩展开放，对修改关闭：
- 新增功能只需添加新组件/hook
- 不需要修改现有代码

### 4. 接口隔离原则 (ISP)
每个hook导出的接口都是最小化的：
- useStories只导出故事相关方法
- usePlayback只导出播放控制方法

## 代码统计

| 指标 | 重构前 | 重构后 | 改善 |
|------|--------|--------|------|
| 主页面行数 | 594 | 139 | -76% |
| 文件数量 | 1 | 22 | +2100% |
| 最大文件行数 | 594 | 119 | -80% |
| 平均文件行数 | 594 | 63 | -89% |

## 使用示例

### 在页面中使用

```typescript
'use client';

import { useVideoCreation } from '@/features/videoCreation/hooks';
import { VideoPreviewPanel, OutlineListPanel } from '@/features/videoCreation/components';

export default function VideoCreationPage() {
  const {
    stories,
    handleStorySelect,
    playback,
    // ...
  } = useVideoCreation();

  return (
    <div>
      <OutlineListPanel
        stories={stories}
        onOutlineSelect={handleOutlineSelect}
      />
      <VideoPreviewPanel
        isPlaying={playback.isPlaying}
        onPlayPause={playback.togglePlay}
      />
    </div>
  );
}
```

## 优势

### 1. 可维护性
- 每个文件职责单一，易于理解和修改
- 修改某个功能不会影响其他模块

### 2. 可测试性
- Hooks可以独立测试
- Services可以mock测试
- 组件可以单元测试

### 3. 可复用性
- Hooks可以在其他页面复用
- 组件可以在不同场景复用
- 类型定义可以在服务端复用

### 4. 可扩展性
- 新增功能只需添加新模块
- 不需要修改现有架构
- 支持功能独立迭代

## 命名规范

| 概念 | 变量命名 | 说明 |
|------|----------|------|
| 故事 | `story/stories` | 一个完整的视频项目 |
| 大纲 | `outline/outlines` | 故事的分段大纲 |
| 分镜文本 | `storyboardText` | 大纲下的具体分镜描述 |
| 分镜脚本 | `storyboardScript` | 分镜文本生成的详细脚本 |
| 分镜 | `scene/scenes` | 前端展示用的分镜单元 |

## 总结

通过这次模块化重构，我们：
- ✅ 将594行巨型文件拆分为22个模块
- ✅ 建立了清晰的分层架构
- ✅ 统一了变量命名，消除歧义
- ✅ 提高了代码的可维护性、可测试性和可复用性
- ✅ 遵循了SOLID等软件工程原则

这个架构为后续功能扩展和团队协作打下了良好基础。
