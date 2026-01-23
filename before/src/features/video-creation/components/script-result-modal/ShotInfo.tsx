import { Camera, Clock, Palette, Scissors } from 'lucide-react';
import { InfoCard, TextDisplay } from './Common';
import type { VideoScriptData } from './types';

interface ShotInfoProps {
  shot?: VideoScriptData['shot'];
}

/**
 * Shot 信息卡片（镜头设置）
 * @param {ShotInfoProps} props - 组件入参
 * @returns {JSX.Element | null} 镜头设置卡片
 */
export function ShotInfo({ shot }: ShotInfoProps) {
  if (!shot) return null;

  const durationValue =
    typeof shot.shot_duration === 'number'
      ? shot.shot_duration
      : typeof shot.shot_duration === 'string' && shot.shot_duration.trim() !== '' && Number.isFinite(Number(shot.shot_duration))
        ? Number(shot.shot_duration)
        : undefined;

  const styleValue =
    shot.shot_style === undefined || shot.shot_style === null || shot.shot_style === ''
      ? undefined
      : String(shot.shot_style);

  const cutToValue =
    typeof shot.cut_to === 'boolean'
      ? shot.cut_to
      : (shot.cut_to as any) === 1
        ? true
        : (shot.cut_to as any) === 0
          ? false
          : undefined;

  const hasAnyValue = durationValue !== undefined || styleValue !== undefined || cutToValue !== undefined;

  return (
    <InfoCard icon={Camera} title="镜头设置" color="text-violet-600">
      {!hasAnyValue && (
        <div className="text-xs text-gray-500 bg-white rounded-lg p-3 border border-gray-200">
          该脚本未包含镜头设置字段
        </div>
      )}
      {durationValue !== undefined && (
        <TextDisplay label="镜头时长" content={`${durationValue} 秒`} icon={Clock} color="text-gray-900" />
      )}
      {styleValue !== undefined && (
        <TextDisplay label="镜头风格" content={styleValue} icon={Palette} color="text-gray-900" />
      )}
      {cutToValue !== undefined && (
        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] gap-1 sm:gap-3 items-start">
          <div className="text-[11px] font-medium text-gray-500 flex items-center gap-1 sm:pt-2">
            <Scissors className="w-3 h-3" />
            转场
          </div>
          <div className="text-xs text-gray-900 bg-gray-50 rounded-md px-3 py-2 border border-gray-200">
            {cutToValue ? '需要转场' : '无需转场'}
          </div>
        </div>
      )}
    </InfoCard>
  );
}
