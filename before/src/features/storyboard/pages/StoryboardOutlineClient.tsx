'use client';

import { useOutlineLogic } from '@/features/storyboard/hooks/useOutlineLogic';
import { OutlineEditor } from '@/features/storyboard/components/outline/OutlineEditor';
import { OutlinePreview } from '@/features/storyboard/components/outline/OutlinePreview';
import { StoryboardStepper, StoryboardWorkbenchHeader } from '@/features/storyboard/components/workbench';
import { Button } from '@/components/ui/button';

/**
 * 故事大纲页面（Client 部分）
 * 负责读取 searchParams 和交互逻辑
 */
export function StoryboardOutlineClient() {
  const {
    storyId,
    inputType,
    setInputType,
    storyTitle,
    setStoryTitle,
    content,
    setContent,
    isGenerating,
    generatedData,
    step,
    setStep,
    isLoadingData,
    isSaving,
    aspectRatio,
    setAspectRatio,
    resolutionPreset,
    setResolutionPreset,
    handleGenerate,
    handleGoToText,
    handleClear,
  } = useOutlineLogic();

  if (isLoadingData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
          <p className="text-gray-500">加载作品数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StoryboardWorkbenchHeader
        backHref="/storyboard"
        title="生成故事大纲"
        description="第一步：输入故事内容，AI 生成结构化场景大纲"
        rightActions={
          step === 'input' ? (
            <Button
              variant="secondary"
              onClick={handleClear}
              className="rounded-xl bg-white text-gray-800 hover:bg-gray-50 ring-1 ring-gray-200"
            >
              清空
            </Button>
          ) : null
        }
      />
      <StoryboardStepper active="outline" storyId={storyId} />

      {step === 'input' ? (
        <OutlineEditor
          inputType={inputType}
          setInputType={setInputType}
          storyTitle={storyTitle}
          setStoryTitle={setStoryTitle}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          resolutionPreset={resolutionPreset}
          setResolutionPreset={setResolutionPreset}
          content={content}
          setContent={setContent}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
        />
      ) : (
        <OutlinePreview
          generatedData={generatedData}
          isLoadingData={isLoadingData}
          isSaving={isSaving}
          onRegenerate={() => setStep('input')}
          onNext={handleGoToText}
        />
      )}
    </div>
  );
}
