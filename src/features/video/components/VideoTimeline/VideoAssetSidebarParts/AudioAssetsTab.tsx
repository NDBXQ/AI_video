import type { ReactElement } from "react"
import layoutStyles from "../VideoAssetSidebarLayout.module.css"
import audioStyles from "../VideoAssetSidebarAudio.module.css"
import type { Asset, AudioAsset } from "@/shared/utils/timelineUtils"
import { AudioRow } from "./AudioRow"
import { CollapsibleSplitBlock } from "./CollapsibleSplitBlock"
import { buildCollapsedStorageKey, writeCollapsedState } from "./collapseStorage"
import { useCollapsedPreference } from "./useCollapsedPreference"

export function AudioAssetsTab({
  scriptAudioAssets,
  audioAssets,
  onUploadAudio,
  onOpenPreview
}: {
  scriptAudioAssets: Array<{ id: string; name: string; kind: "audio"; src: string; roleName: string; speakerName: string; content: string }>
  audioAssets: AudioAsset[]
  onUploadAudio: (file: File) => void
  onOpenPreview: (asset: Asset) => void
}): ReactElement {
  const scriptKey = buildCollapsedStorageKey({ tab: "audio", block: "script" })
  const libraryKey = buildCollapsedStorageKey({ tab: "audio", block: "library" })
  const scriptCollapsed = useCollapsedPreference(scriptKey, false)
  const libraryCollapsed = useCollapsedPreference(libraryKey, true)
  return (
    <div className={layoutStyles.tabBody} aria-label="音频素材">
      <CollapsibleSplitBlock
        ariaLabel="脚本音频"
        label="脚本"
        title="音频"
        headerActions={<div className={layoutStyles.groupMeta}>{scriptAudioAssets.length} 条</div>}
        collapsed={scriptCollapsed}
        contentId="audio_script_assets"
        onToggle={() => {
          writeCollapsedState(scriptKey, !scriptCollapsed)
        }}
      >
        {scriptAudioAssets.length > 0 ? (
          <div className={audioStyles.audioList}>
            {scriptAudioAssets.map((a) => (
              <AudioRow key={a.id} id={a.id} name={a.name} src={a.src} content={a.content} draggableAsset={a as any} onOpenPreview={onOpenPreview as any} />
            ))}
          </div>
        ) : (
          <div className={layoutStyles.emptyHint}>暂无脚本音频</div>
        )}
      </CollapsibleSplitBlock>

      <CollapsibleSplitBlock
        ariaLabel="素材库音频"
        label="素材库"
        title="音频"
        headerActions={
          <>
            <div className={layoutStyles.groupMeta}>{audioAssets.length} 条</div>
            <label className={layoutStyles.uploadBtn}>
              <input
                type="file"
                accept="audio/*"
                className={layoutStyles.uploadInput}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  onUploadAudio(file)
                  e.target.value = ""
                }}
              />
              添加
            </label>
          </>
        }
        collapsed={libraryCollapsed}
        contentId="audio_library_assets"
        onToggle={() => {
          writeCollapsedState(libraryKey, !libraryCollapsed)
        }}
      >
        <div className={audioStyles.audioList}>
          {audioAssets.length > 0 ? (
            audioAssets.map((a) => <AudioRow key={a.id} id={a.id} name={a.name} src={a.src} draggableAsset={a} onOpenPreview={onOpenPreview as any} />)
          ) : (
            <div className={layoutStyles.emptyHint}>暂无素材库音频</div>
          )}
        </div>
      </CollapsibleSplitBlock>
    </div>
  )
}
