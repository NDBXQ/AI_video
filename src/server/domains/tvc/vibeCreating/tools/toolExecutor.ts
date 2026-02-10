import { ServiceError } from "@/server/shared/errors"
import { auditDebug } from "@/shared/logAudit"
import { ensureTvcSchema } from "@/server/db/ensureTvcSchema"
import { tvcAssets } from "@/shared/schema/tvc"
import { getDb } from "coze-coding-dev-sdk"
import { and, eq } from "drizzle-orm"
import { getS3Storage } from "@/shared/storage"
import { buildDirectBucketUrl, resolveStorageUrl } from "@/shared/storageUrl"
import { z } from "zod"
import { safeJsonParse } from "../utils/vibeCreatingJson"
import type { TvcToolCall } from "../llm/llmTypes"
import type { VibeSessionState } from "../vibeCreatingState"
import { generateFirstFramesFromReferencesBatch, generateReferenceImagesBatch, generateVideosFromFirstFramesBatch, recommendBackgroundMusic } from "../vibeCreatingTools"
import { getVibeSkillRuntimePolicy } from "../skills/skillRegistry"
import { VIBE_VIDEO_DURATION_MAX_SECONDS, VIBE_VIDEO_DURATION_MIN_SECONDS } from "../vibeCreatingConfig"
import type { TvcAgentStreamData } from "../agent/vibeCreatingTypes"
import { loadSkillInstructions } from "./vibeCreatingSkills"
import { VIBE_SKILLS } from "./constants"
import type { VibeSkillName } from "./constants"
import { normalizeSeedreamSize, SEEDREAM_ALLOWED_SIZES } from "./validators/seedreamSize"

type ToolRuntime = {
  traceId: string
  storyId: string
  getState: () => VibeSessionState
  setState: (s: VibeSessionState) => void
  sendEvent: (d: TvcAgentStreamData) => void
  sendStatus: (t: string, extra?: Omit<Extract<TvcAgentStreamData, { type: "status" }>, "type" | "text">) => void
  image: { size: string; watermark: boolean }
  video: { watermark: boolean; maxConcurrent: number }
}

const AssetKindSchema = z.enum(["reference_image", "first_frame", "video_clip", "user_image"])

function formatZodError(err: z.ZodError): string {
  const issue = err.issues[0]
  if (!issue) return "参数无效"
  const path = issue.path.length ? issue.path.join(".") : ""
  return path ? `${path}: ${issue.message}` : issue.message
}

function parseToolArgs<T>(toolCall: TvcToolCall, schema: z.ZodType<T>): T {
  const raw = toolCall.function.arguments ?? ""
  const parsed = safeJsonParse(raw)
  if (!parsed || typeof parsed !== "object") {
    throw new ServiceError("TOOL_ARGS_INVALID", `工具参数不是合法 JSON：${toolCall.function.name}`)
  }
  const res = schema.safeParse(parsed)
  if (!res.success) {
    throw new ServiceError("TOOL_ARGS_INVALID", `工具参数不合法：${toolCall.function.name}（${formatZodError(res.error)}）`)
  }
  return res.data
}

export function createVibeCreatingToolExecutor(runtime: ToolRuntime): (call: TvcToolCall) => Promise<string> {
  return async (call: TvcToolCall) => {
    const name = call.function.name
    const sendTask = (t: Omit<Extract<TvcAgentStreamData, { type: "task" }>, "type">) => {
      runtime.sendEvent({ type: "task", ...t })
    }
    const sendCheckpoint = (c: Omit<Extract<TvcAgentStreamData, { type: "checkpoint" }>, "type">) => {
      runtime.sendEvent({ type: "checkpoint", ...c })
    }
    try {
      if (name === "load_skill_instructions") {
        const args = parseToolArgs(
          call,
          z.object({
            skill: z.string().trim().min(1)
          })
        )
        const skill = args.skill as VibeSkillName
        if (!VIBE_SKILLS.includes(skill)) {
          return JSON.stringify({ error: "SKILL_NOT_FOUND", message: `Skill 不存在：${String(args.skill)}`, allowedSkills: [...VIBE_SKILLS] })
        }
        try {
          sendCheckpoint({ name: "before_load_skill", detail: { skill } })
          const content = await loadSkillInstructions(skill)
          runtime.setState({ ...runtime.getState(), activeSkill: skill, updatedAt: Date.now() })
          runtime.sendStatus(`已加载技能：${skill}`, { op: name })
          auditDebug("tvc_context", "tool_load_skill_instructions", "已加载技能", { traceId: runtime.traceId, storyId: runtime.storyId, runId: runtime.traceId }, { skill })
          sendCheckpoint({ name: "after_load_skill", detail: { skill } })
          return JSON.stringify({ skill, content })
        } catch (err) {
          if (err instanceof ServiceError && err.code === "SKILL_NOT_FOUND") {
            return JSON.stringify({ error: err.code, message: err.message, allowedSkills: [...VIBE_SKILLS] })
          }
          throw err
        }
      }

      const state = runtime.getState()
      const activeSkill = typeof (state as any)?.activeSkill === "string" ? String((state as any).activeSkill).trim() : ""
      if (!activeSkill) {
        throw new ServiceError("TOOL_NOT_ALLOWED", "未加载技能规范：请先调用 load_skill_instructions({skill})")
      }
      if (!VIBE_SKILLS.includes(activeSkill as any)) {
        throw new ServiceError("TOOL_NOT_ALLOWED", `未知技能：${activeSkill}`)
      }
      const policy = await getVibeSkillRuntimePolicy(activeSkill)
      if (!policy.allowedTools.includes(name)) {
        throw new ServiceError("TOOL_NOT_ALLOWED", `当前技能(${activeSkill})不允许调用工具：${name}`)
      }

    if (name === "generate_images_batch") {
      const args = parseToolArgs(
        call,
        z.object({
          requests: z.array(
            z.object({
              kind: z.enum(["reference_image", "first_frame"]).optional(),
              ordinal: z.number().int().positive(),
              category: z.enum(["role", "background", "item"]).optional(),
              name: z.string().trim().optional(),
              description: z.string().optional(),
              prompt: z.string().trim().min(1),
              reference_image_ordinals: z.array(z.number().int().positive()).optional()
            })
          ),
          overwrite_existing: z.boolean().optional(),
          size: z.string().optional()
        })
      )
      const requestsRaw = args.requests
      const overwriteExisting = Boolean(args.overwrite_existing)
      const defaultSize = (() => {
        const normalized = normalizeSeedreamSize(runtime.image.size)
        return normalized.ok ? normalized.size : "2048x2048"
      })()
      const sizeRaw = typeof args.size === "string" && args.size.trim() ? args.size.trim() : ""
      const size = (() => {
        if (!sizeRaw) return defaultSize
        const normalized = normalizeSeedreamSize(sizeRaw)
        if (normalized.ok) return normalized.size
        throw new ServiceError("TOOL_ARGS_INVALID", `${normalized.message}，可选值：${SEEDREAM_ALLOWED_SIZES.join(" / ")}`)
      })()
      const watermark = runtime.image.watermark

      const referenceRequests: Array<{ ordinal: number; category: "role" | "background" | "item"; name: string; description: string; prompt: string }> = []
      const firstFrameRequests: Array<{ ordinal: number; description: string; prompt: string; referenceImageOrdinals: number[] }> = []
      for (const r of requestsRaw) {
        const prompt = r.prompt
        const ordinal = r.ordinal
        const kind: "reference_image" | "first_frame" = r.kind === "first_frame" || r.reference_image_ordinals ? "first_frame" : "reference_image"

        if (kind === "reference_image") {
          const category = r.category
          if (!category) throw new ServiceError("TOOL_ARGS_INVALID", "参考图 requests[].category 必须为 role/background/item")
          const name = String(r.name ?? "").trim()
          if (!name) throw new ServiceError("TOOL_ARGS_INVALID", "参考图 requests[].name 不能为空")
          referenceRequests.push({
            ordinal,
            prompt,
            category,
            name,
            description: String(r.description ?? "").trim()
          })
          continue
        }

        const ref = Array.isArray(r.reference_image_ordinals) ? r.reference_image_ordinals : []
        const ordinals = ref.map((n) => Math.trunc(n))
        if (ordinals.length === 0) throw new ServiceError("TOOL_ARGS_INVALID", "requests[].reference_image_ordinals 不能为空")
        firstFrameRequests.push({
          ordinal,
          description: String(r.description ?? "").trim() || "首帧图",
          prompt,
          referenceImageOrdinals: Array.from(new Set(ordinals))
        })
      }

      const total = referenceRequests.length + firstFrameRequests.length
      runtime.sendStatus(`正在生成图片（共${total}张）...`, { op: name, progress: { current: 0, total } })
      if (total === 0) return JSON.stringify({ results: [] })

      let nextState = runtime.getState()
      const results: any[] = []

      if (referenceRequests.length > 0) {
        const ordinals = Array.from(new Set(referenceRequests.map((r) => r.ordinal))).sort((a, b) => a - b)
        const taskId = `${call.id}:reference_image`
        sendTask({
          id: taskId,
          kind: "reference_image",
          state: "running",
          ...(ordinals.length === 1 ? { targetOrdinal: ordinals[0] } : {}),
          targetOrdinals: ordinals,
          message: "正在生成参考图"
        })
        try {
          const generated = await generateReferenceImagesBatch({
            traceId: runtime.traceId,
            storyId: runtime.storyId,
            state: nextState,
            requests: referenceRequests,
            size,
            watermark,
            overwriteExisting
          })
          nextState = generated.nextState
          results.push(...generated.results)
          sendTask({
            id: taskId,
            kind: "reference_image",
            state: "done",
            ...(ordinals.length === 1 ? { targetOrdinal: ordinals[0] } : {}),
            targetOrdinals: ordinals,
            producedCount: generated.results.length,
            message: "参考图生成完成"
          })
        } catch (err) {
          sendTask({
            id: taskId,
            kind: "reference_image",
            state: "failed",
            ...(ordinals.length === 1 ? { targetOrdinal: ordinals[0] } : {}),
            targetOrdinals: ordinals,
            message: String((err as any)?.message ?? "参考图生成失败")
          })
          throw err
        }
      }

      if (firstFrameRequests.length > 0) {
        const ordinals = Array.from(new Set(firstFrameRequests.map((r) => r.ordinal))).sort((a, b) => a - b)
        const taskId = `${call.id}:first_frame`
        sendTask({
          id: taskId,
          kind: "first_frame",
          state: "running",
          ...(ordinals.length === 1 ? { targetOrdinal: ordinals[0] } : {}),
          targetOrdinals: ordinals,
          message: "正在生成首帧"
        })
        try {
          const generated = await generateFirstFramesFromReferencesBatch({
            traceId: runtime.traceId,
            storyId: runtime.storyId,
            state: nextState,
            requests: firstFrameRequests,
            size,
            watermark,
            overwriteExisting
          })
          nextState = generated.nextState
          results.push(...generated.results)
          sendTask({
            id: taskId,
            kind: "first_frame",
            state: "done",
            ...(ordinals.length === 1 ? { targetOrdinal: ordinals[0] } : {}),
            targetOrdinals: ordinals,
            producedCount: generated.results.length,
            message: "首帧生成完成"
          })
        } catch (err) {
          sendTask({
            id: taskId,
            kind: "first_frame",
            state: "failed",
            ...(ordinals.length === 1 ? { targetOrdinal: ordinals[0] } : {}),
            targetOrdinals: ordinals,
            message: String((err as any)?.message ?? "首帧生成失败")
          })
          throw err
        }
      }

      runtime.setState(nextState)
      return JSON.stringify({ results })
    }

    if (name === "assets_resolve") {
      const args = parseToolArgs(
        call,
        z.object({
          kind: AssetKindSchema,
          ordinal: z.number().int().positive()
        })
      )
      const kind = args.kind
      const ordinal = args.ordinal

      await ensureTvcSchema()
      const db = await getDb({ tvcAssets })
      const [row] = await db
        .select({
          id: tvcAssets.id,
          kind: tvcAssets.kind,
          assetOrdinal: tvcAssets.assetOrdinal,
          storageKey: tvcAssets.storageKey,
          thumbnailStorageKey: tvcAssets.thumbnailStorageKey,
          meta: tvcAssets.meta,
          updatedAt: tvcAssets.updatedAt
        })
        .from(tvcAssets)
        .where(and(eq(tvcAssets.storyId, runtime.storyId), eq(tvcAssets.kind, kind), eq(tvcAssets.assetOrdinal, ordinal)))
        .limit(1)

      if (!row) return JSON.stringify({ ok: false, error: "ASSET_NOT_FOUND", kind, ordinal })

      const meta = (row.meta ?? {}) as any
      const canUseStorage = (() => {
        try {
          getS3Storage()
          return true
        } catch {
          return false
        }
      })()
      const storage = canUseStorage ? getS3Storage() : null

      let url = ""
      let thumbnailUrl = ""
      if (storage) {
        try {
          url = row.storageKey ? await resolveStorageUrl(storage, row.storageKey) : ""
          thumbnailUrl = row.thumbnailStorageKey ? await resolveStorageUrl(storage, row.thumbnailStorageKey) : ""
        } catch {
        }
      }
      if (!url) url = String(meta?.url ?? "").trim()
      if (!thumbnailUrl) thumbnailUrl = String(meta?.thumbnailUrl ?? "").trim()
      if (!url && row.storageKey) {
        try {
          url = buildDirectBucketUrl(row.storageKey)
        } catch {
        }
      }
      if (!thumbnailUrl && row.thumbnailStorageKey) {
        try {
          thumbnailUrl = buildDirectBucketUrl(row.thumbnailStorageKey)
        } catch {
        }
      }

      const updatedAt = row.updatedAt instanceof Date ? row.updatedAt : new Date()
      const updatedAtMs = updatedAt.getTime()
      return JSON.stringify({
        ok: true,
        kind,
        ordinal,
        url,
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
        meta: meta as Record<string, unknown>,
        updatedAtMs: Number.isFinite(updatedAtMs) ? Math.trunc(updatedAtMs) : 0
      })
    }

    if (name === "generate_videos_from_images_batch") {
      const args = parseToolArgs(
        call,
        z.object({
          requests: z.array(
            z.object({
              ordinal: z.number().int().positive(),
              first_frame_ordinal: z.number().int().positive(),
              description: z.string().optional(),
              prompt: z.string().trim().min(1),
              duration_seconds: z.number()
            })
          ),
          overwrite_existing: z.boolean().optional(),
          max_concurrent: z.number().int().positive().optional()
        })
      )
      const requestsRaw = args.requests
      const overwriteExisting = Boolean(args.overwrite_existing)
      const watermark = runtime.video.watermark
      const maxConcurrent =
        typeof args.max_concurrent === "number" ? Math.max(1, Math.trunc(args.max_concurrent)) : runtime.video.maxConcurrent

      const requests: Array<{ ordinal: number; firstFrameOrdinal: number; description: string; prompt: string; durationSeconds: number }> = []
      for (const r of requestsRaw) {
        const ordinal = r.ordinal
        const firstFrameOrdinal = r.first_frame_ordinal
        const prompt = r.prompt
        const durationSecondsRaw = r.duration_seconds
        if (!Number.isInteger(durationSecondsRaw)) {
          throw new ServiceError(
            "TOOL_ARGS_INVALID",
            `requests[].duration_seconds 必须为 ${VIBE_VIDEO_DURATION_MIN_SECONDS}~${VIBE_VIDEO_DURATION_MAX_SECONDS} 的整数`
          )
        }
        if (durationSecondsRaw < VIBE_VIDEO_DURATION_MIN_SECONDS) {
          throw new ServiceError(
            "TOOL_ARGS_INVALID",
            `requests[].duration_seconds 必须为 ${VIBE_VIDEO_DURATION_MIN_SECONDS}~${VIBE_VIDEO_DURATION_MAX_SECONDS} 的整数`
          )
        }
        if (durationSecondsRaw > VIBE_VIDEO_DURATION_MAX_SECONDS) {
          throw new ServiceError(
            "TOOL_ARGS_INVALID",
            `requests[].duration_seconds 必须为 ${VIBE_VIDEO_DURATION_MIN_SECONDS}~${VIBE_VIDEO_DURATION_MAX_SECONDS} 的整数`
          )
        }
        requests.push({
          ordinal,
          firstFrameOrdinal,
          description: String(r.description ?? "").trim() || `首帧${firstFrameOrdinal}视频`,
          prompt,
          durationSeconds: durationSecondsRaw
        })
      }

      runtime.sendStatus(`正在生成分镜视频（共${requests.length}段，可能较慢）...`, { op: name, progress: { current: 0, total: requests.length } })
      if (requests.length === 0) return JSON.stringify({ results: [] })
      const ordinals = Array.from(new Set(requests.map((r) => r.ordinal))).sort((a, b) => a - b)
      const taskId = `${call.id}:video_clip`
      sendTask({
        id: taskId,
        kind: "video_clip",
        state: "running",
        ...(ordinals.length === 1 ? { targetOrdinal: ordinals[0] } : {}),
        targetOrdinals: ordinals,
        message: "正在生成视频片段"
      })
      try {
        const generated = await generateVideosFromFirstFramesBatch({
          traceId: runtime.traceId,
          storyId: runtime.storyId,
          state: runtime.getState(),
          requests,
          watermark,
          maxConcurrent,
          overwriteExisting
        })
        runtime.setState(generated.nextState)
        sendTask({
          id: taskId,
          kind: "video_clip",
          state: "done",
          ...(ordinals.length === 1 ? { targetOrdinal: ordinals[0] } : {}),
          targetOrdinals: ordinals,
          producedCount: generated.results.length,
          message: "视频片段生成完成"
        })
        return JSON.stringify({ results: generated.results })
      } catch (err) {
        sendTask({
          id: taskId,
          kind: "video_clip",
          state: "failed",
          ...(ordinals.length === 1 ? { targetOrdinal: ordinals[0] } : {}),
          targetOrdinals: ordinals,
          message: String((err as any)?.message ?? "视频生成失败")
        })
        throw err
      }
    }

    if (name === "recommend_background_music") {
      const args = parseToolArgs(
        call,
        z.object({
          scene_type: z.string().trim().min(1),
          mood: z.string().trim().min(1),
          duration_seconds: z.number().int().positive()
        })
      )
      const rec = recommendBackgroundMusic({ sceneType: args.scene_type, mood: args.mood, durationSeconds: args.duration_seconds })
      return JSON.stringify(rec)
    }

      throw new ServiceError("TOOL_NOT_FOUND", `未知工具：${name}`)
    } catch (err) {
      if (err instanceof ServiceError) {
        const code = err.code
        const recoverable =
          code === "TOOL_ARGS_INVALID" || code === "TOOL_NOT_ALLOWED" || code === "TOOL_NOT_FOUND" || code === "SKILL_NOT_FOUND"
        if (recoverable) {
          return JSON.stringify({ error: code, message: err.message, tool: name, allowedSkills: [...VIBE_SKILLS] })
        }
      }
      throw err
    }
  }
}
