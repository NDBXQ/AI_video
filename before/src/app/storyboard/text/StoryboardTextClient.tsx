'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useStoryboardGeneration } from './hooks/useStoryboardGeneration';
import { SceneDetail, SceneList, BottomActions } from './components';
import type { OutlineData, StoryboardText } from './types';
import { StoryboardStepper, StoryboardWorkbenchHeader } from '@/features/storyboard/components/workbench';

const isGeneratingGlobal = false;

/**
 * 分镜文本页面（Client 部分）
 * 负责读取 searchParams 并执行交互逻辑
 */
export default function StoryboardTextClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [urlStoryId, setUrlStoryId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingState, setIsGeneratingState] = useState(false);
  const [generatedText, setGeneratedText] = useState<StoryboardText | null>(null);
  const [outlineData, setOutlineData] = useState<OutlineData | null>(null);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [detailViewMode, setDetailViewMode] = useState<'all' | 'selected'>('selected');
  const [generatingProgress, setGeneratingProgress] = useState({
    completed: 0,
    total: 0,
    currentScene: '',
  });
  const [shouldCancel, setShouldCancel] = useState(false);
  const [sceneGenerationStatus, setSceneGenerationStatus] = useState<
    Record<string, 'pending' | 'generating' | 'completed' | 'failed'>
  >({});

  const isGeneratingRef = useRef(false);
  const loadedStoryIdRef = useRef<string | null>(null);

  const { generateAllScenes } = useStoryboardGeneration({
    isGenerating,
    setIsGenerating,
    setIsGeneratingState,
    setOutlineData,
    setGeneratingProgress,
    setSceneGenerationStatus,
    sceneGenerationStatus,
    shouldCancel,
    setShouldCancel,
    isGeneratingRef,
  });

  /**
   * 自动生成分镜文本
   * @param {any} data - 大纲数据
   * @param {boolean} isAutoTrigger - 是否由自动流程触发
   * @returns {Promise<void>} 无返回
   */
  const autoGenerateStoryboardText = async (data: any, isAutoTrigger: boolean = false) => {
    if (!isAutoTrigger) {
      if (isGenerating) {
        console.log('⚠️  正在生成分镜文本中，请稍候...');
        alert('正在生成分镜文本中，请稍候...');
        return;
      }
    }

    await generateAllScenes(data);
  };

  /**
   * 手动重新生成
   * @returns {Promise<void>} 无返回
   */
  const handleGenerate = async () => {
    if (!outlineData) {
      alert('请先加载数据');
      return;
    }

    await generateAllScenes(outlineData);
  };

  useEffect(() => {
    const dataParam = searchParams.get('data');
    const storyId = searchParams.get('storyId');
    const autoGenerateParam = searchParams.get('autoGenerate');
    const tempKey = searchParams.get('tempKey');

    console.log('=== 分镜文本页面加载 ===');
    console.log('URL 参数:', { storyId, autoGenerate: autoGenerateParam, hasDataParam: !!dataParam, hasTempKey: !!tempKey });
    console.log('当前加载的 storyId:', loadedStoryIdRef.current);

    if (storyId) {
      setUrlStoryId(storyId);
      console.log('✅ 已保存URL中的storyId到state:', storyId);
    }

    if (storyId && loadedStoryIdRef.current === storyId) {
      console.log('⚠️ 该storyId的数据已加载，跳过重复调用');
      return;
    }

    loadedStoryIdRef.current = storyId || null;

    const loadData = async () => {
      try {
        let decodedData: any = null;

        if (storyId) {
          console.log('📥 开始从数据库加载数据，storyId:', storyId);

          const storyResponse = await fetch(`/api/story/${storyId}`);
          const storyResult = await storyResponse.json();
          console.log('📖 故事API响应:', storyResult);

          if (storyResult.success) {
            const story = storyResult.data;
            console.log('✅ 故事详情加载成功:', story.id);

            const outlinesResponse = await fetch(`/api/outline/by-story/${storyId}`);
            const outlinesResult = await outlinesResponse.json();
            console.log('📖 大纲API响应:', outlinesResult);

            if (outlinesResult.success) {
              const outlines = outlinesResult.data;
              console.log('✅ 大纲加载成功，数量:', outlines.length);

              const storyboardTextsResponse = await fetch(`/api/storyboard-text/by-story/${storyId}`);
              const storyboardTextsResult = await storyboardTextsResponse.json();
              console.log('📖 分镜文本API响应:', storyboardTextsResult);

              const outlineOriginalList = outlines.map((outline: any) => ({
                outline: outline.outlineText,
                original: outline.originalText,
                outlineId: outline.id,
                sequence: outline.sequence,
              }));

              if (storyboardTextsResult.success && storyboardTextsResult.data.length > 0) {
                const storyboardTexts = storyboardTextsResult.data;
                console.log('✅ 已有分镜文本，数量:', storyboardTexts.length);

                outlineOriginalList.forEach((item: any) => {
                  const records = storyboardTexts
                    .filter((st: any) => st.outlineId === item.outlineId)
                    .sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0));

                  if (records.length > 0) {
                    item.storyboardTexts = records.map((r: any) => ({
                      id: r.id,
                      sequence: r.sequence ?? 0,
                      shotCut: !!r.shotCut,
                      storyboardText: r.storyboardText || '',
                      createdAt: r.createdAt,
                      updatedAt: r.updatedAt,
                    }));

                    item.storyboardText = records[0].storyboardText;
                    item.storyboardTextId = records[0].id;
                    item.shotCut = records[0].shotCut;
                  }
                });
              }

              decodedData = {
                story_text: story.generatedText || story.storyText,
                outline_original_list: outlineOriginalList,
                storyId: story.id,
                userId: story.userId,
                run_id: story.runId,
              };

              console.log('✅ 数据构建完成，outline数量:', decodedData.outline_original_list.length);
            } else {
              console.error('❌ 大纲加载失败:', outlinesResult.message);
            }
          } else {
            console.error('❌ 故事加载失败:', storyResult.message);
          }
        } else {
          console.warn('⚠️ 没有storyId，跳过数据库加载');
        }

        if (!decodedData && tempKey) {
          try {
            const raw = sessionStorage.getItem(`ai-video:storyboard-text-payload:${tempKey}`);
            if (raw) {
              decodedData = JSON.parse(raw);
              sessionStorage.removeItem(`ai-video:storyboard-text-payload:${tempKey}`);
            }
          } catch (e) {
            console.warn('⚠️ tempKey 数据读取失败:', e);
          }
        }

        if (!decodedData && dataParam) {
          decodedData = JSON.parse(decodeURIComponent(dataParam));
        }

        if (decodedData) {
          setOutlineData(decodedData);

          let textContent = '';

          if (decodedData.story_text) {
            textContent += `【故事简介】\n${decodedData.story_text}\n\n`;
          }

          if (decodedData.outline_original_list && Array.isArray(decodedData.outline_original_list)) {
            textContent += `【故事大纲】\n`;
            decodedData.outline_original_list.forEach((item: any, index: number) => {
              textContent += `\n【场景${index + 1}】\n${item.outline}\n${item.original}\n`;
            });
          }

          setGeneratedText({
            id: `t${Date.now()}`,
            title: textContent.slice(0, 20) + '...',
            type: 'original',
            content: textContent,
            generatedText: textContent,
            createdAt: new Date().toISOString(),
          });

          const hasExistingText = decodedData.outline_original_list.some(
            (item: any) =>
              (Array.isArray(item.storyboardTexts) && item.storyboardTexts.length > 0) ||
              (item.storyboardText && item.storyboardText.length > 0)
          );

          console.log('🔍 自动生成检查:', {
            autoGenerateParam,
            hasExistingText,
            outlineCount: decodedData.outline_original_list?.length,
            isGeneratingGlobal,
            isGenerating,
            isGeneratingState,
          });

          if (autoGenerateParam === 'true' && decodedData.outline_original_list && !hasExistingText) {
            console.log('✅ 检测到autoGenerate参数，且数据库中暂无分镜文本，准备自动开始生成...');

            if (isGeneratingGlobal) {
              console.log('⚠️  正在生成分镜文本中，跳过重复调用');
              return;
            }

            console.log('🚀 开始自动生成分镜文本...');
            await autoGenerateStoryboardText(decodedData, true);
            console.log('✅ 自动生成分镜文本完成');
          } else {
            console.log('⏭️ 跳过自动生成:', {
              reason:
                autoGenerateParam !== 'true'
                  ? 'autoGenerate参数不为true'
                  : hasExistingText
                    ? '已存在分镜文本'
                    : '无大纲数据',
            });
          }
        }
      } catch (error) {
        console.error('解析大纲数据失败:', error);
      }
    };

    loadData();
  }, [searchParams]);

  /**
   * 切换到上一个场景
   * @returns {void} 无返回
   */
  const handlePreviousScene = () => {
    setSelectedSceneIndex(Math.max(0, selectedSceneIndex - 1));
  };

  /**
   * 切换到下一个场景
   * @returns {void} 无返回
   */
  const handleNextScene = () => {
    if (outlineData) {
      setSelectedSceneIndex(Math.min(outlineData.outline_original_list.length - 1, selectedSceneIndex + 1));
    }
  };

  /**
   * 选择场景（在全部模式下会滚动到对应场景）
   * @param {number} index - 场景索引
   * @returns {void} 无返回
   */
  const handleSelectScene = (index: number) => {
    setSelectedSceneIndex(index);
    if (detailViewMode === 'all') {
      const el = document.getElementById(`scene-detail-${index}`);
      el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };

  /**
   * 获取当前故事ID（用于跳转）
   * @returns {string | null} storyId
   */
  const getCurrentStoryId = () => {
    return outlineData?.storyId || urlStoryId || searchParams.get('storyId');
  };

  return (
    <div className="space-y-6">
      <StoryboardWorkbenchHeader
        backHref={`/storyboard/create/outline${getCurrentStoryId() ? `?storyId=${getCurrentStoryId()}` : ''}`}
        title="生成场景文本"
        description="第二步：基于故事大纲，生成每个场景的详细描述"
      />
      <StoryboardStepper active="text" storyId={getCurrentStoryId()} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          {outlineData && outlineData.outline_original_list ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex-1 rounded-xl bg-white text-gray-800 hover:bg-gray-50 ring-1 ring-gray-200"
                >
                  {isGenerating ? '生成中...' : '重新生成'}
                </Button>
              </div>

              <SceneList
                scenes={outlineData.outline_original_list.map((item: any) => ({
                  ...item,
                  generationStatus: sceneGenerationStatus[String(item.outlineId)] || 'pending',
                }))}
                selectedIndex={selectedSceneIndex}
                onSelectScene={handleSelectScene}
                disabled={isGenerating}
              />
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                  <svg className="h-8 w-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-amber-900">暂无大纲数据</h4>
                  <p className="mt-2 text-sm text-amber-800">请先在故事大纲页面生成大纲，然后再进入此页面。</p>
                </div>
                <Button
                  onClick={() =>
                    router.push(
                      `/storyboard/create/outline${getCurrentStoryId() ? `?storyId=${getCurrentStoryId()}` : ''}`
                    )
                  }
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  前往生成故事大纲
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {outlineData && outlineData.outline_original_list && selectedSceneIndex >= 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">详情展示</div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={detailViewMode === 'selected' ? 'primary' : 'secondary'}
                    onClick={() => setDetailViewMode('selected')}
                    className={
                      detailViewMode === 'selected'
                        ? 'rounded-xl'
                        : 'rounded-xl bg-white text-gray-800 hover:bg-gray-50 ring-1 ring-gray-200'
                    }
                  >
                    当前
                  </Button>
                  <Button
                    size="sm"
                    variant={detailViewMode === 'all' ? 'primary' : 'secondary'}
                    onClick={() => setDetailViewMode('all')}
                    className={
                      detailViewMode === 'all'
                        ? 'rounded-xl'
                        : 'rounded-xl bg-white text-gray-800 hover:bg-gray-50 ring-1 ring-gray-200'
                    }
                  >
                    全部
                  </Button>
                </div>
              </div>

              <div className="mt-4">
                {detailViewMode === 'all' ? (
                  <div className="space-y-6">
                    {outlineData.outline_original_list.map((scene: any, index: number) => (
                      <div
                        key={scene.outlineId || index}
                        id={`scene-detail-${index}`}
                        className={`rounded-2xl border bg-white p-4 sm:p-6 ${
                          index === selectedSceneIndex ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-200'
                        }`}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="text-sm font-bold text-gray-900">场景 {index + 1}</div>
                          <div className="text-xs text-gray-500">
                            {scene.outlineId ? `outlineId: ${scene.outlineId}` : ''}
                          </div>
                        </div>
                        <SceneDetail
                          scene={scene}
                          sceneIndex={index}
                          onRegenerate={handleGenerate}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <SceneDetail
                    scene={outlineData.outline_original_list[selectedSceneIndex]}
                    sceneIndex={selectedSceneIndex}
                    totalScenes={outlineData.outline_original_list.length}
                    onPreviousScene={handlePreviousScene}
                    onNextScene={handleNextScene}
                    onRegenerate={handleGenerate}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomActions
        isGenerating={isGenerating}
        generatingProgress={generatingProgress}
        storyId={getCurrentStoryId()}
        shouldCancel={shouldCancel}
        onSetShouldCancel={setShouldCancel}
      />
    </div>
  );
}
