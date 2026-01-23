import { Camera, Film, Image, MapPin, Mic, Music, Package, User } from 'lucide-react';
import { InfoCard, TagDisplay, TextDisplay } from './Common';
import type { VideoScriptData } from './types';

interface ShotContentProps {
  shotContent?: VideoScriptData['shot_content'];
}

/**
 * ShotContent 信息卡片（拍摄内容）
 * @param {ShotContentProps} props - 组件入参
 * @returns {JSX.Element | null} 拍摄内容卡片
 */
export function ShotContent({ shotContent }: ShotContentProps) {
  if (!shotContent) return null;

  return (
    <InfoCard icon={Film} title="拍摄内容" color="text-violet-600">
      {shotContent.background && (
        <div className="space-y-2">
          <TextDisplay
            label="场景名称"
            content={shotContent.background.background_name as any}
            icon={MapPin}
            color="text-gray-900"
          />
          <TextDisplay
            label="场景描述"
            content={shotContent.background.status as any}
            icon={Image}
            color="text-gray-900"
          />
        </div>
      )}

      {shotContent.roles && shotContent.roles.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
            <User className="w-3 h-3" />
            角色信息
          </div>
          {shotContent.roles.map((role, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2">
              {role.role_name && typeof role.role_name === 'string' && (
                <div className="text-xs font-semibold text-gray-900">{role.role_name}</div>
              )}
              {role.appearance_time_point !== undefined && typeof role.appearance_time_point === 'number' && (
                <div className="text-xs text-gray-700">出场时间：{role.appearance_time_point} 秒</div>
              )}
              {role.location_info && typeof role.location_info === 'string' && (
                <div className="text-xs text-gray-700">位置：{role.location_info}</div>
              )}
              {role.action && typeof role.action === 'string' && (
                <TextDisplay label="动作" content={role.action} color="text-gray-900" />
              )}
              {role.expression && typeof role.expression === 'string' && (
                <TextDisplay label="表情" content={role.expression} color="text-gray-900" />
              )}
              {role.speak && (
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Mic className="w-3 h-3 text-gray-600" />
                    {role.speak.time_point !== undefined && typeof role.speak.time_point === 'number' && (
                      <span className="text-[11px] font-medium text-gray-700">
                        对话（{role.speak.time_point} 秒）
                      </span>
                    )}
                  </div>
                  {role.speak.content && typeof role.speak.content === 'string' && (
                    <div className="text-xs text-gray-900 whitespace-pre-wrap">“{role.speak.content}”</div>
                  )}
                  {role.speak.tone && typeof role.speak.tone === 'string' && (
                    <div className="text-xs text-gray-700 mt-1">语调：{role.speak.tone}</div>
                  )}
                  {role.speak.emotion && typeof role.speak.emotion === 'string' && (
                    <div className="text-xs text-gray-700">情绪：{role.speak.emotion}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(shotContent.role_items?.length || shotContent.other_items?.length) && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          {shotContent.role_items && shotContent.role_items.length > 0 && (
            <TagDisplay
              label="角色道具"
              tags={shotContent.role_items.map((item) =>
                typeof item === 'string' ? item : item.item_name || item.description || JSON.stringify(item)
              )}
              color="bg-gray-100 text-gray-800 border border-gray-200"
              icon={Package}
            />
          )}
          {shotContent.other_items && shotContent.other_items.length > 0 && (
            <TagDisplay
              label="其他道具"
              tags={shotContent.other_items.map((item) =>
                typeof item === 'string' ? item : item.item_name || item.description || JSON.stringify(item)
              )}
              color="bg-gray-100 text-gray-800 border border-gray-200"
              icon={Package}
            />
          )}
        </div>
      )}

      {shotContent.shoot && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <TextDisplay label="拍摄角度" content={shotContent.shoot.shot_angle as any} icon={Camera} color="text-gray-900" />
          <TextDisplay label="镜头距离" content={shotContent.shoot.angle as any} icon={Camera} color="text-gray-900" />
          <TextDisplay
            label="运镜方式"
            content={shotContent.shoot.camera_movement as any}
            icon={Camera}
            color="text-gray-900"
          />
        </div>
      )}

      {shotContent.bgm && typeof shotContent.bgm === 'string' && (
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
            <Music className="w-3.5 h-3.5 text-gray-600" />
            <div className="flex-1">
              <div className="text-[11px] text-gray-600 font-medium">背景音乐</div>
              <div className="text-xs text-gray-900 whitespace-pre-wrap">{shotContent.bgm}</div>
            </div>
          </div>
        </div>
      )}
    </InfoCard>
  );
}
