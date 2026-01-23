# 分镜文本页面模块化文档

## 概述

本页面已进行模块化重构，将原来1700多行的单文件拆分为多个可维护的模块。

## 文件结构

```
src/app/storyboard/text/
├── page.tsx                      # 主页面（待重构）
├── types.ts                      # 类型定义
├── constants.ts                  # 常量定义
├── utils.ts                      # 工具函数
├── hooks.ts                      # React Hooks
├── handlers.ts                   # 事件处理函数
├── components/                   # 组件目录
│   ├── index.ts                  # 组件导出
│   ├── Header.tsx                # 头部组件
│   ├── StepIndicator.tsx         # 步骤指示器
│   ├── InputSection.tsx          # 输入区域
│   ├── UsageGuide.tsx            # 使用说明
│   ├── GeneratingProgress.tsx    # 生成进度
│   ├── SceneList.tsx             # 场景列表
│   ├── SceneDetail.tsx           # 场景详情
│   └── BottomActions.tsx         # 底部操作按钮
└── README.md                     # 本文档
```

## 模块说明

### 1. types.ts - 类型定义

包含所有 TypeScript 类型定义：

- `StoryboardText` - 分镜文本类型
- `OutlineItem` - 大纲项类型
- `OutlineData` - 大纲数据类型
- `GeneratingProgress` - 生成进度类型
- `Step` - 步骤类型
- `InputType` - 输入类型
- `SceneGenerationStatus` - 场景生成状态类型
- `SceneGenerationResult` - 场景生成结果类型

### 2. constants.ts - 常量定义

包含所有常量：

- `USAGE_STEPS` - 使用步骤
- `PROFESSIONAL_TIP` - 专业提示
- `GENERATING_TIME_PER_SCENE` - 每个场景预计生成时间
- `URL_DATA_SIZE_WARNING_THRESHOLD` - URL参数大小警告阈值
- `ERROR_MESSAGES` - 错误消息
- `STEP_LABELS` - 步骤标签

### 3. utils.ts - 工具函数

包含纯函数工具：

- `parseStoryboardText()` - 解析分镜文本
- `buildGeneratedTextContent()` - 构建生成文本内容
- `calculateEstimatedTime()` - 计算预计时间
- `getErrorMessage()` - 获取错误消息
- `checkURLDataSize()` - 检查URL数据大小
- `outlineDataToText()` - 大纲数据转文本
- `hasGeneratedStoryboard()` - 检查是否已生成分镜文本

### 4. hooks.ts - React Hooks

包含自定义 Hooks：

- `useInitializeData()` - 初始化数据 Hook
- `useStoryboardGeneration()` - 生成分镜文本 Hook

### 5. handlers.ts - 事件处理函数

包含事件处理函数：

- `handleGenerate()` - 生成分镜文本
- `handleClear()` - 清空输入
- `handleSaveDraft()` - 保存草稿
- `handleEditText()` - 编辑文本
- `handleSceneSelect()` - 场景选择
- `handlePreviousScene()` - 上一场景
- `handleNextScene()` - 下一场景
- `handleCancelGeneration()` - 取消生成

### 6. components/ - 组件模块

所有UI组件：

- `Header` - 页面头部
- `StepIndicator` - 步骤指示器
- `InputSection` - 输入区域
- `UsageGuide` - 使用说明
- `GeneratingProgress` - 生成进度
- `SceneList` - 场景列表
- `SceneDetail` - 场景详情
- `BottomActions` - 底部操作按钮

## 使用示例

### 导入组件

```typescript
import { Header, StepIndicator, InputSection } from './components';
```

### 导入类型

```typescript
import type { OutlineData, GeneratingProgress } from './types';
```

### 导入工具函数

```typescript
import {
  parseStoryboardText,
  calculateEstimatedTime,
  getErrorMessage,
} from './utils';
```

### 导入 Hooks

```typescript
import {
  useInitializeData,
  useStoryboardGeneration,
} from './hooks';
```

### 导入处理函数

```typescript
import {
  handleGenerate,
  handleClear,
  handleSceneSelect,
} from './handlers';
```

## 重构主页面示例

以下是重构后的主页面示例：

```typescript
'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Header, StepIndicator, InputSection, UsageGuide, SceneList, SceneDetail, BottomActions } from './components';
import { useInitializeData, useStoryboardGeneration } from './hooks';
import { handleGenerate, handleClear, handleSceneSelect, handlePreviousScene, handleNextScene } from './handlers';

export default function StoryboardTextPage() {
  // 使用 Hooks
  const { urlStoryId, autoGenerate, outlineData, content, step } = useInitializeData();
  const { isGenerating, generatingProgress, generateStoryboardText } = useStoryboardGeneration(outlineData);

  // 本地状态
  const [inputType, setInputType] = useState<'original' | 'brief'>('original');
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);

  // 事件处理
  const handleGenerateClick = () => {
    handleGenerate(inputType, content, () => {}, () => {}, () => {});
  };

  const handleClearClick = () => {
    handleClear(() => {}, () => {}, () => {});
  };

  const handleSceneSelectClick = (index: number) => {
    handleSceneSelect(index, setSelectedSceneIndex);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <Header
          urlStoryId={urlStoryId}
          autoGenerate={autoGenerate}
          step={step}
          onClear={handleClearClick}
          onSaveDraft={() => {}}
        />
        <StepIndicator step={step} isGenerating={isGenerating} />
        {step === 'input' && !autoGenerate && (
          <>
            <InputSection
              inputType={inputType}
              setInputType={setInputType}
              content={content}
              setContent={() => {}}
              onGenerate={handleGenerateClick}
              isGenerating={isGenerating}
            />
            <UsageGuide />
          </>
        )}
        {step === 'preview' && outlineData && (
          <>
            <SceneList
              outlineOriginalList={outlineData.outline_original_list}
              selectedSceneIndex={selectedSceneIndex}
              onSceneSelect={handleSceneSelectClick}
              isGenerating={isGenerating}
              isGeneratingState={false}
              sceneGenerationStatus={{}}
            />
            <SceneDetail
              selectedSceneIndex={selectedSceneIndex}
              outlineOriginalList={outlineData.outline_original_list}
              onPreviousScene={() => handlePreviousScene(selectedSceneIndex, setSelectedSceneIndex)}
              onNextScene={() => handleNextScene(selectedSceneIndex, outlineData.outline_original_list.length - 1, setSelectedSceneIndex)}
              onRegenerate={() => {}}
            />
          </>
        )}
        <BottomActions
          urlStoryId={urlStoryId}
          isGenerating={isGenerating}
          progress={generatingProgress}
          shouldCancel={false}
          onUseText={() => {}}
          onCancel={() => {}}
        />
      </div>
    </MainLayout>
  );
}
```

## 后续工作

1. **重构主页面**：使用模块化组件重构 `page.tsx`
2. **添加测试**：为各个模块添加单元测试
3. **优化性能**：考虑使用 React.memo 优化组件渲染
4. **文档完善**：为每个模块添加详细的JSDoc注释

## 注意事项

1. **类型安全**：所有模块都使用 TypeScript 严格模式
2. **单一职责**：每个模块只负责一个功能
3. **可复用性**：组件和工具函数设计为可复用
4. **可维护性**：模块化后更容易维护和扩展
5. **文件大小**：单个文件不超过1万字符（约400行）

## 编译检查

```bash
npx tsc --noEmit
```

确保所有模块没有TypeScript错误。
