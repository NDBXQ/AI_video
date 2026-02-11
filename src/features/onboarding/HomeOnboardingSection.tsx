import type { ReactElement } from "react"
import { cookies } from "next/headers"
import { getDb } from "@/server/db/getDb"
import { desc, eq } from "drizzle-orm"
import { generatedImages } from "@/shared/schema/generation"
import { stories, storyOutlines, storyboards } from "@/shared/schema/story"
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { OnboardingChecklistCard } from "@/features/onboarding/components/OnboardingChecklistCard"
import { ONBOARDING_DISMISSED_COOKIE_NAME } from "@/shared/onboardingDismissed"

type StepId = "login" | "create_story" | "generate_outline" | "generate_storyboard" | "generate_assets" | "export_video"

type ChecklistStep = {
  id: StepId
  title: string
  description: string
  done: boolean
  href: string
  helpTopic?: string
}

function storyModeFromType(storyType: string | null | undefined): string {
  return storyType === "source" ? "source" : "brief"
}

export async function HomeOnboardingSection(): Promise<ReactElement | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const isDismissed = cookieStore.get(ONBOARDING_DISMISSED_COOKIE_NAME)?.value === "1"
  const traceId = getTraceId(new Headers())

  if (isDismissed) return null

  if (!token) {
    const steps: ChecklistStep[] = [
      {
        id: "login",
        title: "登录并进入工作台",
        description: "开始创建你的第一个项目",
        done: false,
        href: "/login",
        helpTopic: "login"
      }
    ]
    return <OnboardingChecklistCard steps={steps} initialDismissed={false} />
  }

  const session = await verifySessionToken(token, traceId)
  if (!session) return null

  const db = await getDb({ stories, storyOutlines, storyboards, generatedImages })

  const latestStory = await db
    .select({
      id: stories.id,
      storyType: stories.storyType,
      progressStage: stories.progressStage,
      finalVideoUrl: stories.finalVideoUrl
    })
    .from(stories)
    .where(eq(stories.userId, session.userId))
    .orderBy(desc(stories.updatedAt))
    .limit(1)
    .then((rows) => rows[0] ?? null)

  const hasStory = Boolean(latestStory?.id)
  const storyId = latestStory?.id ?? ""
  const storyMode = storyModeFromType(latestStory?.storyType)

  const latestOutline = hasStory
    ? await db
        .select({ id: storyOutlines.id })
        .from(storyOutlines)
        .where(eq(storyOutlines.storyId, storyId))
        .orderBy(desc(storyOutlines.sequence))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null

  const hasOutline = Boolean(latestOutline?.id)
  const outlineId = latestOutline?.id ?? ""

  const hasStoryboard = hasOutline
    ? await db
        .select({ id: storyboards.id })
        .from(storyboards)
        .where(eq(storyboards.outlineId, outlineId))
        .limit(1)
        .then((rows) => Boolean(rows[0]?.id))
    : false

  const hasGeneratedAsset = hasStory
    ? await db
        .select({ id: generatedImages.id })
        .from(generatedImages)
        .where(eq(generatedImages.storyId, storyId))
        .limit(1)
        .then((rows) => Boolean(rows[0]?.id))
    : false

  const stage = (latestStory?.progressStage ?? "").trim()
  const hasAssetStage = stage === "image_assets" || stage === "video_assets" || stage === "done"

  const hasFinalVideo = Boolean((latestStory?.finalVideoUrl ?? "").trim()) || stage === "done"

  const workspaceHref = hasStory ? `/script/workspace/${encodeURIComponent(storyId)}?mode=${encodeURIComponent(storyMode)}` : "/script/workspace?mode=brief"
  const videoHref = hasStory ? `/video?${new URLSearchParams({ tab: "list", storyId }).toString()}` : "/video"

  const steps: ChecklistStep[] = [
    {
      id: "create_story",
      title: "创建一个项目（剧本）",
      description: "从简介或原文开始，生成你的第一个故事",
      done: hasStory,
      href: "/script/workspace?mode=brief",
      helpTopic: "script-start"
    },
    {
      id: "generate_outline",
      title: "生成大纲",
      description: "让系统先把故事拆成清晰的章节结构",
      done: hasOutline,
      href: workspaceHref,
      helpTopic: "script-outline"
    },
    {
      id: "generate_storyboard",
      title: "生成分镜脚本",
      description: "把章节细化到镜头级，便于后续生成素材",
      done: hasStoryboard,
      href: workspaceHref,
      helpTopic: "script-storyboard"
    },
    {
      id: "generate_assets",
      title: "生成素材（图 / 视频）",
      description: "从分镜一键生成图片或视频片段",
      done: hasGeneratedAsset || hasAssetStage,
      href: videoHref,
      helpTopic: "video-generate"
    },
    {
      id: "export_video",
      title: "导出或保存成片",
      description: "把当前成果沉淀到内容库，便于复用与分享",
      done: hasFinalVideo,
      href: videoHref,
      helpTopic: "video-export"
    }
  ]

  const shouldShow = steps.some((s) => !s.done)
  if (!shouldShow) return null

  return <OnboardingChecklistCard steps={steps} initialDismissed={false} />
}
