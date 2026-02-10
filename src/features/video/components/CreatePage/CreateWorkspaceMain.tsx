import type { ReactElement } from "react"
import { GenerationHeader } from "./GenerationHeader"
import shellStyles from "../ImageCreate/Shell.module.css"

export function CreateWorkspaceMain({
  onBack,
  activeTab,
  onTabChange,
  episodeLabel,
  sceneNo,
  recommendedStoryboardMode,
  canPrevScene,
  canNextScene,
  onPrevScene,
  onNextScene,
  info,
  mobileActions,
  leftPanel,
  rightPanel
}: {
  onBack: () => void
  activeTab: "image" | "video"
  onTabChange: (tab: "image" | "video") => void
  episodeLabel?: string | null
  sceneNo: number
  recommendedStoryboardMode: any
  canPrevScene: boolean
  canNextScene: boolean
  onPrevScene: () => void
  onNextScene: () => void
  info: Array<{ label: string; value: string }>
  mobileActions?: ReactElement | null
  leftPanel: ReactElement
  rightPanel: ReactElement
}): ReactElement {
  return (
    <>
      <GenerationHeader
        onBack={onBack}
        activeTab={activeTab}
        onTabChange={onTabChange}
        episodeLabel={episodeLabel}
        sceneNo={sceneNo}
        recommendedStoryboardMode={recommendedStoryboardMode}
        canPrevScene={canPrevScene}
        canNextScene={canNextScene}
        onPrevScene={onPrevScene}
        onNextScene={onNextScene}
        info={info}
        mobileActions={mobileActions}
      />

      <div className={shellStyles.workspaceWrap}>
        <div
          className={shellStyles.body}
          style={
            {
              ["--dock-h" as any]: activeTab === "video" ? "190px" : "140px",
              ["--dock-gap" as any]: "8px",
              gridTemplateRows: "calc(100% - var(--dock-h, 0px) - var(--dock-gap, 0px)) var(--dock-h, 0px)",
              rowGap: "var(--dock-gap, 0px)",
              columnGap: "10px"
            } as any
          }
        >
          {leftPanel}
          {rightPanel}
        </div>
      </div>
    </>
  )
}
