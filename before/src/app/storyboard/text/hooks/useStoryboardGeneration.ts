import { OutlineData, OutlineItem } from '../types';

interface GenerateStoryboardTextOptions {
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  setIsGeneratingState: (state: boolean) => void;
  setOutlineData: React.Dispatch<React.SetStateAction<OutlineData | null>>;
  setGeneratingProgress: (progress: { completed: number; total: number; currentScene: string }) => void;
  setSceneGenerationStatus: (status: Record<string, 'pending' | 'generating' | 'completed' | 'failed'>) => void;
  sceneGenerationStatus: Record<string, 'pending' | 'generating' | 'completed' | 'failed'>;
  shouldCancel: boolean;
  setShouldCancel: (cancel: boolean) => void;
  isGeneratingRef: React.MutableRefObject<boolean>;
}

export function useStoryboardGeneration({
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
}: GenerateStoryboardTextOptions) {
  // 使用模块级别的变量来追踪，防止 React 18 严格模式下重复挂载导致重复调用
  let isGeneratingGlobal = false;

  const generateSingleScene = async (
    item: OutlineItem,
    index: number,
    data: OutlineData,
    totalScenes: number,
    currentCompleted: number
  ): Promise<{ index: number; storyboardText: string; shotCut: boolean; error?: string }> => {
    const { outlineId, sequence } = item;

    // 检查是否需要取消
    if (shouldCancel) {
      console.log(`场景${index + 1}已被取消`);
      return {
        index,
        storyboardText: '',
        shotCut: false,
        error: '用户已取消',
      };
    }

    // 标记为生成中
    const newStatus = { ...sceneGenerationStatus };
    newStatus[String(outlineId || index)] = 'generating';
    setSceneGenerationStatus(newStatus);

    // 更新进度
    const sceneTitle = item.outline?.slice(0, 20) || `场景${sequence}`;
    setGeneratingProgress({
      completed: currentCompleted,
      total: totalScenes,
      currentScene: sceneTitle,
    });

    console.log(`场景${index + 1}开始生成分镜文本，outlineId: ${outlineId}, sequence: ${sequence}`);

    try {
      const response = await fetch('/api/storyboard/coze-generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outline: item.outline || '',
          original: item.original || '',
          outlineId: outlineId,
          sequence: sequence,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        console.log(`场景${index + 1}生成成功，savedId: ${result.data.savedId}`);

        const receivedStoryboardTexts = Array.isArray(result.data.storyboardTexts) ? result.data.storyboardTexts : null;
        const storyboardTexts =
          receivedStoryboardTexts?.map((t: any, idx: number) => ({
            id: String(t.id ?? `${outlineId || index}-${idx}`),
            sequence: typeof t.sequence === 'number' ? t.sequence : idx + 1,
            shotCut: !!t.shotCut,
            storyboardText: String(t.storyboardText ?? ''),
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          })) ?? null;
        const primaryText = storyboardTexts && storyboardTexts.length > 0 ? storyboardTexts[0].storyboardText : result.data.storyboardText;
        const aggregatedShotCut =
          storyboardTexts && storyboardTexts.length > 0 ? storyboardTexts.some((t: any) => !!t.shotCut) : !!result.data.shotCut;

        // 立即更新UI：添加分镜文本到对应的场景（实时显示）
        setOutlineData((prevData) => {
          if (!prevData) return prevData;

          const updatedList = prevData.outline_original_list.map((scene: any, idx: number) => {
            if (idx === index) {
              return {
                ...scene,
                storyboardTexts: storyboardTexts ?? scene.storyboardTexts,
                storyboardText: primaryText,
                storyboardTextId: storyboardTexts && storyboardTexts.length > 0 ? storyboardTexts[0].id : result.data.savedId,
                shotCut: aggregatedShotCut,
              };
            }
            return scene;
          });

          return {
            ...prevData,
            outline_original_list: updatedList,
          };
        });

        // 标记为已完成
        const newStatus = { ...sceneGenerationStatus };
        newStatus[String(outlineId || index)] = 'completed';
        setSceneGenerationStatus(newStatus);

        // 更新完成数
        setGeneratingProgress({
          completed: currentCompleted + 1,
          total: totalScenes,
          currentScene: sceneTitle,
        });

        return {
          index,
          storyboardText: primaryText,
          shotCut: aggregatedShotCut,
        };
      } else {
        console.error(`场景${index + 1}生成失败:`, result.message);
        const newStatus = { ...sceneGenerationStatus };
        newStatus[String(outlineId || index)] = 'failed';
        setSceneGenerationStatus(newStatus);
        return {
          index,
          storyboardText: '',
          shotCut: false,
          error: result.message,
        };
      }
    } catch (error) {
      console.error(`场景${index + 1}调用失败:`, error);
      const newStatus = { ...sceneGenerationStatus };
      newStatus[String(outlineId || index)] = 'failed';
      setSceneGenerationStatus(newStatus);
      return {
        index,
        storyboardText: '',
        shotCut: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  };

  const generateAllScenes = async (data: OutlineData) => {
    setIsGenerating(true);
    setShouldCancel(false);

    // 检查是否已经在生成中
    if (isGeneratingRef.current || isGeneratingGlobal) {
      console.log('⚠️ 正在生成分镜文本中，请稍候...');
      alert('正在生成分镜文本中，请稍候...');
      setIsGenerating(false);
      return;
    }

    // 设置全局生成标志
    isGeneratingRef.current = true;
    isGeneratingGlobal = true;
    setIsGeneratingState(true);

    try {
      const { outline_original_list: outlineOriginalList } = data;

      // 初始化进度
      setGeneratingProgress({
        completed: 0,
        total: outlineOriginalList.length,
        currentScene: '',
      });

      // 标记所有场景为待生成
      const initialStatus: Record<string, 'pending' | 'generating' | 'completed' | 'failed'> = {};
      outlineOriginalList.forEach((item: any, index: number) => {
        initialStatus[String(item.outlineId || index)] = 'pending';
      });
      setSceneGenerationStatus(initialStatus);

      // 用于跟踪当前完成数量的计数器
      let completedCount = 0;

      // 并发生成所有场景
      const generatePromises = outlineOriginalList.map(async (item: any, index: number) => {
        return generateSingleScene(item, index, data, outlineOriginalList.length, completedCount).then(result => {
          completedCount++;
          return result;
        });
      });

      // 等待所有请求完成
      const results = await Promise.all(generatePromises);

      console.log('所有场景生成完成，结果数量:', results.length);

      // 检查是否被取消
      if (shouldCancel) {
        console.log('⚠️ 用户已取消生成');
        alert('已取消生成，已生成的场景将保留。您可以稍后继续生成或直接进入下一步。');
        setIsGenerating(false);
        return;
      }

      console.log('✅ 所有场景生成成功');
    } catch (error) {
      console.error('生成过程中发生错误:', error);
      alert('生成过程中发生错误，请查看控制台了解详情');
    } finally {
      setIsGenerating(false);
      setIsGeneratingState(false);
      isGeneratingRef.current = false;
      isGeneratingGlobal = false;
      setShouldCancel(false);
    }
  };

  return {
    generateAllScenes,
  };
}
