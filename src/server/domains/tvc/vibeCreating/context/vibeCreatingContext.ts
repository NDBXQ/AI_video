import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { ServiceError } from "@/server/shared/errors"
import { tvcChatMessages, tvcLlmMessages, tvcStories } from "@/shared/schema/tvc"
import { desc, eq } from "drizzle-orm"
import { getDb } from "coze-coding-dev-sdk"
import type { StoryContext } from "../agent/vibeCreatingTypes"
import type { TvcLlmMessage } from "../llm/llmTypes"
import { auditDebug, summarizeLlmMessage } from "@/shared/logAudit"

export async function getOrCreateStoryContext(params: { storyId: string; userId: string; traceId?: string }): Promise<StoryContext> {
  const { storyId, userId } = params
  const traceId = String(params.traceId ?? "server")
  await ensureTvcSchema()
  const db = await getDb({ tvcStories, tvcChatMessages, tvcLlmMessages })

  const [story] = await db
    .select({ id: tvcStories.id, userId: tvcStories.userId, metadata: tvcStories.metadata })
    .from(tvcStories)
    .where(eq(tvcStories.id, storyId))
    .limit(1)

  if (!story) {
    const inserted = await db
      .insert(tvcStories)
      .values({
        id: storyId,
        userId,
        title: null,
        storyType: "tvc",
        resolution: "1080p",
        aspectRatio: "16:9",
        shotStyle: "cinema",
        storyText: "",
        generatedText: null,
        finalVideoUrl: null,
        status: "draft",
        progressStage: "outline",
        metadata: {}
      } as any)
      .returning({ id: tvcStories.id, userId: tvcStories.userId, metadata: tvcStories.metadata })
    const created = inserted?.[0]
    if (!created) throw new ServiceError("DB_INSERT_FAILED", "创建项目失败")
    return {
      storyId: created.id,
      userId: created.userId,
      recentMessages: [],
      recentLlmMessages: [],
      metadata: (created.metadata ?? {}) as Record<string, unknown>
    }
  }

  if (story.userId !== userId) throw new ServiceError("NOT_FOUND", "项目不存在")
  return loadStoryContext({ storyId, userId, traceId })
}

export async function loadStoryContext(params: { storyId: string; userId: string; traceId?: string }): Promise<StoryContext> {
  const { storyId, userId } = params
  const traceId = String(params.traceId ?? "server")
  await ensureTvcSchema()
  const db = await getDb({ tvcStories, tvcChatMessages, tvcLlmMessages })

  auditDebug("tvc_context", "load_story_context_start", "开始加载 StoryContext", { traceId, storyId })

  const [story] = await db
    .select({ id: tvcStories.id, userId: tvcStories.userId, metadata: tvcStories.metadata })
    .from(tvcStories)
    .where(eq(tvcStories.id, storyId))
    .limit(1)

  if (!story || story.userId !== userId) throw new ServiceError("NOT_FOUND", "项目不存在")

  const recentMessages = await db
    .select({ role: tvcChatMessages.role, content: tvcChatMessages.content })
    .from(tvcChatMessages)
    .where(eq(tvcChatMessages.storyId, storyId))
    .orderBy(desc(tvcChatMessages.createdAt))
    .limit(40)

  const recentLlmRows = await db
    .select({
      role: tvcLlmMessages.role,
      content: tvcLlmMessages.content,
      name: tvcLlmMessages.name,
      toolCallId: tvcLlmMessages.toolCallId,
      toolCalls: tvcLlmMessages.toolCalls,
      createdAt: tvcLlmMessages.createdAt,
      seq: tvcLlmMessages.seq
    })
    .from(tvcLlmMessages)
    .where(eq(tvcLlmMessages.storyId, storyId))
    .orderBy(desc(tvcLlmMessages.createdAt))
    .limit(120)

  const recentLlmMessages: TvcLlmMessage[] = recentLlmRows
    .slice()
    .sort((a, b) => {
      const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
      const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
      if (ta !== tb) return ta - tb
      return Number(a.seq ?? 0) - Number(b.seq ?? 0)
    })
    .map((r) => {
      const role = String(r.role ?? "").trim()
      const content = typeof r.content === "string" ? r.content : ""
      const msg: TvcLlmMessage = { role: role as any, content }
      if (typeof r.name === "string" && r.name.trim()) msg.name = r.name.trim()
      if (typeof r.toolCallId === "string" && r.toolCallId.trim()) msg.tool_call_id = r.toolCallId.trim()
      if (Array.isArray(r.toolCalls) && r.toolCalls.length) msg.tool_calls = r.toolCalls as any
      return msg
    })
    .filter((m) => ["system", "user", "assistant", "tool"].includes(String(m.role)))

  auditDebug("tvc_context", "load_story_context_loaded", "StoryContext 已加载", { traceId, storyId }, {
    recentChatMessages: recentMessages.length,
    recentLlmMessages: recentLlmMessages.length,
    llmRoles: recentLlmMessages.reduce(
      (acc, m) => {
        const r = String((m as any)?.role ?? "")
        acc[r] = (acc[r] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>
    ),
    llmItems: recentLlmMessages.slice(-20).map((m) => summarizeLlmMessage(m))
  })

  return {
    storyId,
    userId,
    recentMessages: recentMessages.reverse() as any,
    recentLlmMessages,
    metadata: (story.metadata ?? {}) as Record<string, unknown>
  }
}
