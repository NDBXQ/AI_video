import { useCallback, useState } from 'react';
import type { Scene } from '../domain/types';
import { scriptGenerationService } from '../services/scriptGenerationService';

interface SelectedScriptScene {
  id: string;
  title: string;
  scriptData: any;
}

interface UseSceneScriptsParams {
  scenes: Scene[];
  setScenes: (scenes: Scene[] | ((prev: Scene[]) => Scene[])) => void;
  setError: (error: string | null) => void;
}

/**
 * 分镜脚本生成与查看逻辑 Hook
 * @param {UseSceneScriptsParams} params - 入参
 * @returns {object} 分镜脚本相关状态与操作方法
 */
export function useSceneScripts({ scenes, setScenes, setError }: UseSceneScriptsParams) {
  const [scriptGenerating, setScriptGenerating] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [selectedScriptScene, setSelectedScriptScene] = useState<SelectedScriptScene | null>(null);

  /**
   * 批量生成分镜脚本
   * @returns {Promise<void>} 无返回
   */
  const handleGenerateScripts = useCallback(async () => {
    if (scenes.length === 0) return;

    setScriptGenerating(true);
    setError(null);

    try {
      const scenesToGenerate = scenes.map((scene) => ({
        id: scene.id,
        content: scene.content,
        storyboardTextId: scene.storyboardTextId,
        sequence: scene.sequence,
      }));

      setScenes(
        scenes.map((scene) => ({
          ...scene,
          scriptGenerating: true,
        }))
      );

      await scriptGenerationService.generateBatchScripts(
        scenesToGenerate,
        '请为每个分镜生成详细的分镜脚本，包括镜头类型、角度、运镜、构图、光线、色彩等详细信息',
        (currentIndex, total, storyboardId, result) => {
          console.log('[useSceneScripts] 分镜脚本生成回调:', {
            currentIndex,
            total,
            storyboardId,
            hasResult: !!result,
          });

          setScenes((prevScenes) =>
            prevScenes.map((scene) => {
              if (scene.id !== storyboardId) return scene;

              if (result) {
                return {
                  ...scene,
                  scriptGenerating: false,
                  scriptGenerated: true,
                  generatedScript: result,
                };
              }

              return {
                ...scene,
                scriptGenerating: false,
                scriptGenerated: false,
              };
            })
          );
        }
      );
    } catch (error) {
      console.error('[useSceneScripts] 批量生成分镜脚本失败:', error);
      const errorMessage = error instanceof Error ? error.message : '生成分镜脚本失败，请稍后重试';
      setError(errorMessage);
      setScenes((prevScenes) =>
        prevScenes.map((scene) => ({
          ...scene,
          scriptGenerating: false,
          scriptGenerated: false,
        }))
      );
    } finally {
      setScriptGenerating(false);
    }
  }, [scenes, setError, setScenes]);

  /**
   * 查看某个分镜脚本
   * @param {string} storyboardId - 分镜 ID
   * @returns {void} 无返回
   */
  const handleViewScript = useCallback(
    (storyboardId: string) => {
      const scene = scenes.find((s) => s.id === storyboardId);
      console.log('[useSceneScripts] handleViewScript:', {
        storyboardId,
        hasScene: !!scene,
        hasGeneratedScript: !!scene?.generatedScript,
      });

      if (scene && scene.generatedScript) {
        setSelectedScriptScene({
          id: scene.id,
          title: scene.title,
          scriptData: scene.generatedScript,
        });
        setShowScriptModal(true);
      }
    },
    [scenes]
  );

  /**
   * 关闭脚本 Modal
   * @returns {void} 无返回
   */
  const handleCloseScriptModal = useCallback(() => {
    setShowScriptModal(false);
    setSelectedScriptScene(null);
  }, []);

  return {
    scriptGenerating,
    showScriptModal,
    selectedScriptScene,
    handleGenerateScripts,
    handleViewScript,
    handleCloseScriptModal,
  };
}

