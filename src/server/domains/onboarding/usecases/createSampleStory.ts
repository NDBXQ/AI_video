import { getDb } from "coze-coding-dev-sdk"
import { generatedImages, stories, storyOutlines, storyboards } from "@/shared/schema"

export async function createSampleStory(params: { userId: string }): Promise<{ storyId: string }> {
  const db = await getDb({ stories, storyOutlines, storyboards, generatedImages })

  const now = new Date()
  const sampleStoryText =
    "一段 15 秒的短视频：一个人在清晨的城市街道上走过，镜头切换到咖啡店、地铁站与公园，最后以一句温暖的旁白收尾。"

  const [story] = await db
    .insert(stories)
    .values({
      userId: params.userId,
      title: "示例项目：城市清晨 15 秒短片",
      storyType: "brief",
      resolution: "1080p",
      aspectRatio: "16:9",
      shotStyle: "realistic",
      storyText: sampleStoryText,
      status: "ready",
      progressStage: "storyboard_text",
      createdAt: now,
      updatedAt: now
    })
    .returning({ id: stories.id })

  const [outline] = await db
    .insert(storyOutlines)
    .values({
      storyId: story.id,
      sequence: 1,
      outlineText: "清晨出发 → 城市切片 → 温暖收尾",
      originalText: sampleStoryText,
      createdAt: now
    })
    .returning({ id: storyOutlines.id })

  const storyboardTexts = [
    "清晨街道，人物背影前行，阳光穿过楼宇。",
    "咖啡店门口特写，蒸汽上升，人物推门进入。",
    "地铁站快节奏切换，人群流动，人物目光坚定。",
    "公园慢镜头，树叶摇曳，人物放慢脚步深呼吸。",
    "旁白收尾：‘新的开始，从今天的第一步开始。’ 画面淡出。"
  ]

  await db.insert(storyboards).values(
    storyboardTexts.map((text, idx) => {
      return {
        outlineId: outline.id,
        sequence: idx + 1,
        sceneTitle: "示例分镜",
        originalText: sampleStoryText,
        shotCut: idx > 0,
        storyboardText: text
      }
    })
  )

  return { storyId: story.id }
}

