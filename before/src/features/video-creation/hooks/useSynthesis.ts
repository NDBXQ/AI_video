/**
 * useSynthesis Hook - 管理视频合成
 */

import { useState, useCallback } from 'react';
import { SynthesisStatus } from '../domain/types';
import {
  SYNTHESIS_PROGRESS_INTERVAL,
  SYNTHESIS_PROGRESS_STEP,
} from '../domain/constants';

export function useSynthesis() {
  const [status, setStatus] = useState<SynthesisStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 开始合成
  const startSynthesis = useCallback(async () => {
    setStatus('synthesizing');
    setProgress(0);
    setError(null);

    // 模拟合成过程
    return new Promise<void>((resolve, reject) => {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setStatus('completed');
            resolve();
            return 100;
          }
          return prev + SYNTHESIS_PROGRESS_STEP;
        });
      }, SYNTHESIS_PROGRESS_INTERVAL);
    });
  }, []);

  // 取消合成
  const cancelSynthesis = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setError(null);
  }, []);

  // 重置状态
  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setError(null);
  }, []);

  return {
    status,
    progress,
    error,
    startSynthesis,
    cancelSynthesis,
    reset,
    isIdle: status === 'idle',
    isSynthesizing: status === 'synthesizing',
    isCompleted: status === 'completed',
    isFailed: status === 'failed',
  };
}

export type UseSynthesisReturn = ReturnType<typeof useSynthesis>;
