import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { GeneratedOutline } from '../types';

/**
 * 大纲页面的业务逻辑 Hook
 */
export function useOutlineLogic() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 状态定义
  const [storyId, setStoryId] = useState<string | null>(null);
  const [typeParam, setTypeParam] = useState<string | null>(null);
  const [inputType, setInputType] = useState<'original' | 'brief'>('original');
  const [storyTitle, setStoryTitle] = useState('');
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<GeneratedOutline | null>(null);
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3' | '3:4' | '9:16'>('16:9');
  const [resolutionPreset, setResolutionPreset] = useState<'480p' | '720p' | '1080p'>('1080p');

  // 初始化 URL 参数
  useEffect(() => {
    const currentStoryId = searchParams.get('storyId');
    const currentTypeParam = searchParams.get('type');
    setStoryId(currentStoryId);
    setTypeParam(currentTypeParam);

    if (currentStoryId) {
      setStep('preview');
    }
    if (currentTypeParam) {
      setInputType(currentTypeParam === 'brief' ? 'brief' : 'original');
    }
  }, [searchParams]);

  // 加载故事数据
  useEffect(() => {
    const loadStoryData = async () => {
      if (!storyId) return;

      setIsLoadingData(true);
      try {
        const storyResponse = await fetch(`/api/story/${storyId}`);
        const storyResult = await storyResponse.json();

        if (storyResult.success && storyResult.data) {
          const story = storyResult.data;
          setStoryTitle(story.title);
          setContent(story.storyText);
          setInputType(story.storyType);
          if (typeof story.aspectRatio === 'string') {
            const v = story.aspectRatio.trim();
            if (v === '16:9' || v === '4:3' || v === '3:4' || v === '9:16') setAspectRatio(v);
          }
          if (typeof story.resolutionPreset === 'string') {
            const v = story.resolutionPreset.trim();
            if (v === '480p' || v === '720p' || v === '1080p') setResolutionPreset(v);
          }

          const outlineResponse = await fetch(`/api/outline/by-story/${storyId}`);
          const outlineResult = await outlineResponse.json();

          if (outlineResult.success && outlineResult.data?.length > 0) {
            const outlineItems = outlineResult.data.map((item: any) => ({
              outline: item.outlineText,
              original: item.originalText,
              outlineId: item.id,
              sequence: item.sequence,
            }));

            setGeneratedData({
              story_original: story.storyText,
              story_text: story.generatedText || '',
              outline_original_list: outlineItems,
              run_id: story.runId || ''
            });
            setStep('preview');
          } else {
            setGeneratedData(null);
            setStep('input');
          }
        } else {
          setStep('input');
        }
      } catch (error) {
        console.error('加载故事数据失败:', error);
        setStep('input');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadStoryData();
  }, [storyId]);

  // 生成大纲
  const handleGenerate = async () => {
    if (!content.trim()) return;

    setIsGenerating(true);
    setStep('input');

    try {
      const response = await apiClient.generateStoryboardText({
        input_type: inputType,
        story_text: content,
      });

      if (response.success && response.data) {
        setGeneratedData(response.data);
        setStep('preview');
      } else {
        throw new Error(response.message || '生成失败');
      }
    } catch (error) {
      console.error('生成故事大纲失败:', error);
      let errorMessage = '生成失败，请稍后重试';
      const errorMsg = error instanceof Error ? error.message : '未知错误';

      if (errorMsg.includes('504') || errorMsg.includes('超时')) {
        errorMessage = '生成时间较长，请稍后重试或减少输入内容长度';
      } else if (errorMsg.includes('500')) {
        errorMessage = '服务器错误，请稍后重试';
      } else if (errorMsg.includes('Failed to fetch')) {
        errorMessage = '网络连接失败，请检查网络或稍后重试';
      } else {
        errorMessage = `生成失败: ${errorMsg}`;
      }
      alert(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  // 保存并跳转
  const handleGoToText = async () => {
    if (!generatedData || isSaving) return;

    setIsSaving(true);
    let storyIdToUse = storyId;

    try {
      // 1. 获取或创建用户
      const userResponse = await fetch('/api/user/get-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '匿名用户',
          email: `user_${Date.now()}@example.com`,
        }),
      });
      const userResult = await userResponse.json();
      if (!userResult.success) throw new Error(`用户创建失败: ${userResult.message}`);
      const userId = userResult.data.id;

      // 2. 创建或更新故事
      if (storyIdToUse) {
        const updateResponse = await fetch(`/api/story/${storyIdToUse}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storyType: inputType,
            storyText: content,
            title: storyTitle || content.slice(0, 50) + '...',
            generatedText: generatedData.story_text,
            runId: generatedData.run_id || '',
            aspectRatio,
            resolutionPreset,
          }),
        });
        const updateResult = await updateResponse.json();
        if (!updateResult.success) throw new Error(`故事更新失败: ${updateResult.message}`);
      } else {
        const storyResponse = await fetch('/api/story/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            storyType: inputType,
            storyText: content,
            title: storyTitle || content.slice(0, 50) + '...',
            generatedText: generatedData.story_text,
            runId: generatedData.run_id,
            aspectRatio,
            resolutionPreset,
          }),
        });
        const storyResult = await storyResponse.json();
        if (!storyResult.success) throw new Error(`故事创建失败: ${storyResult.message}`);
        storyIdToUse = storyResult.data.id;
      }

      // 3. 保存大纲
      if (storyId) {
        await fetch(`/api/outline/by-story/${storyId}`, { method: 'DELETE' });
      }

      const outlineResponse = await fetch('/api/outline/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: storyIdToUse,
          outlines: generatedData.outline_original_list,
        }),
      });
      const outlineResult = await outlineResponse.json();
      if (!outlineResult.success) throw new Error(`故事大纲创建失败: ${outlineResult.message}`);

      // 4. 跳转
      const freshOutlineResponse = await fetch(`/api/outline/by-story/${storyIdToUse}`);
      const freshOutlineResult = await freshOutlineResponse.json();

      const outlineListWithIds = freshOutlineResult.success
        ? freshOutlineResult.data.map((item: any) => ({
            outline: item.outlineText,
            original: item.originalText,
            outlineId: item.id,
            sequence: item.sequence,
          }))
        : generatedData.outline_original_list;

      await fetch('/api/story/' + storyIdToUse + '/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progressStage: 'text' }),
      }).catch(() => null);

      router.push(`/storyboard/text?storyId=${storyIdToUse}&autoGenerate=true`);

    } catch (error) {
      console.error('保存数据失败:', error);
      try {
        const tempKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem(
          `ai-video:storyboard-text-payload:${tempKey}`,
          JSON.stringify({
            ...generatedData,
            storyId: storyIdToUse,
            outline_original_list: generatedData.outline_original_list,
          })
        );
        const storyIdParam = storyIdToUse ? `&storyId=${storyIdToUse}` : '';
        router.push(`/storyboard/text?tempKey=${tempKey}${storyIdParam}&autoGenerate=true`);
      } catch {
        router.push(`/storyboard/text${storyIdToUse ? `?storyId=${storyIdToUse}` : ''}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    setStoryTitle('');
    setContent('');
    setGeneratedData(null);
    setStep('input');
  };

  return {
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
  };
}
