import { Image, MapPin, Package, Play, User } from 'lucide-react';
import { InfoCard, TagDisplay, TextDisplay } from './Common';
import type { VideoScriptData } from './types';

interface VideoContentProps {
  videoContent?: VideoScriptData['video_content'];
}

/**
 * VideoContent 信息卡片（视频内容）
 * @param {VideoContentProps} props - 组件入参
 * @returns {JSX.Element | null} 视频内容卡片
 */
export function VideoContent({ videoContent }: VideoContentProps) {
  if (!videoContent) return null;

  return (
    <InfoCard icon={Play} title="视频内容" color="text-violet-600">
      {videoContent.background && (
        <div className="space-y-2">
          <TextDisplay
            label="场景名称"
            content={videoContent.background.background_name as any}
            icon={MapPin}
            color="text-gray-900"
          />
          <TextDisplay
            label="视觉描述"
            content={videoContent.background.description as any}
            icon={Image}
            color="text-gray-900"
          />
        </div>
      )}

      {videoContent.roles && videoContent.roles.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
            <User className="w-3 h-3" />
            角色视觉描述
          </div>
          {videoContent.roles.map((role, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2">
              {role.role_name && typeof role.role_name === 'string' && (
                <div className="text-xs font-semibold text-gray-900">{role.role_name}</div>
              )}
              {role.description && typeof role.description === 'string' && (
                <TextDisplay label="描述" content={role.description} color="text-gray-900" />
              )}
            </div>
          ))}
        </div>
      )}

      {videoContent.items && videoContent.items.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
            <Package className="w-3 h-3" />
            物品描述
          </div>
          {videoContent.items.map((item, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2">
              {item.item_name && typeof item.item_name === 'string' && (
                <div className="text-xs font-semibold text-gray-900">{item.item_name}</div>
              )}
              {item.description && typeof item.description === 'string' && (
                <TextDisplay label="描述" content={item.description} color="text-gray-900" />
              )}
              {item.relation && typeof item.relation === 'string' && (
                <div className="text-xs text-gray-700">关联：{item.relation}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {videoContent.other_items && videoContent.other_items.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <TagDisplay
            label="其他物品"
            tags={videoContent.other_items.map((item) =>
              typeof item === 'string' ? item : item.item_name || item.description || JSON.stringify(item)
            )}
            color="bg-gray-100 text-gray-800 border border-gray-200"
            icon={Package}
          />
        </div>
      )}
    </InfoCard>
  );
}
