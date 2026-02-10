import type { TvcPhaseId } from "@/features/tvc/types"

export const tvcPhaseLabelById: Record<TvcPhaseId, string> = {
  clarification: "需求澄清",
  script: "剧情",
  reference_image: "参考图",
  storyboard: "分镜",
  first_frame: "分镜首帧",
  video_clip: "分镜视频"
}
