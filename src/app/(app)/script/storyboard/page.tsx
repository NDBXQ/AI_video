import type { ReactElement } from "react"
import { StoryboardPage } from "@/features/script/storyboard/StoryboardPage"

type StoryboardRouteProps = Readonly<{
  searchParams?: Readonly<{
    mode?: string | string[]
    outline?: string | string[]
    storyId?: string | string[]
    scene?: string | string[]
  }>
}>

export const dynamic = "force-dynamic"

/**
 * 生成分镜文本页
 * @param {StoryboardRouteProps} props - 页面属性
 * @param {Object} [props.searchParams] - 查询参数
 * @param {string|string[]} [props.searchParams.mode] - 进入模式（brief/source）
 * @param {string|string[]} [props.searchParams.outline] - 大纲编号
 * @returns {ReactElement} 页面内容
 */
export default function StoryboardRoutePage({ searchParams }: StoryboardRouteProps): ReactElement {
  const modeValue = searchParams?.mode
  const mode = Array.isArray(modeValue) ? modeValue[0] : modeValue

  const outlineValue = searchParams?.outline
  const outline = Array.isArray(outlineValue) ? outlineValue[0] : outlineValue

  const storyIdValue = searchParams?.storyId
  const storyId = Array.isArray(storyIdValue) ? storyIdValue[0] : storyIdValue

  const sceneValue = searchParams?.scene
  const scene = Array.isArray(sceneValue) ? sceneValue[0] : sceneValue

  return <StoryboardPage mode={mode} outline={outline} storyId={storyId} scene={scene} />
}
