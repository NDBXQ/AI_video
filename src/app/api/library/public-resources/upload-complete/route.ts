import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getDb } from "coze-coding-dev-sdk"
import { readFile, rm, stat } from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { publicResources, insertPublicResourceSchema } from "@/shared/schema"
import { getS3Storage } from "@/shared/storage"
import { resolveStorageUrl } from "@/shared/storageUrl"
import { eq } from "drizzle-orm"

const inputSchema = z.object({
  uploadId: z.string().trim().min(1)
})

function getUploadRoot(): string {
  return path.join(process.cwd(), ".tmp", "public-resource-uploads")
}

type Manifest = {
  uploadId: string
  userId: string
  type: string
  fileName: string
  contentType: string
  size: number
  chunkSize: number
  totalChunks: number
  durationMs?: number | null
  name: string
  description: string
  tags: string
  applicableScenes: string
}

async function readManifest(uploadId: string): Promise<Manifest | null> {
  try {
    const dir = path.join(getUploadRoot(), uploadId)
    const text = await readFile(path.join(dir, "manifest.json"), "utf8")
    return JSON.parse(text) as Manifest
  } catch {
    return null
  }
}

function sanitizeExt(ext: string): string {
  const v = ext.toLowerCase().replace(/[^a-z0-9]/g, "")
  return v || "bin"
}

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(makeApiErr(traceId, "INVALID_JSON", "请求体不是合法 JSON"), { status: 400 })
  }
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const uploadId = parsed.data.uploadId
  const manifest = await readManifest(uploadId)
  if (!manifest) return NextResponse.json(makeApiErr(traceId, "NOT_FOUND", "上传任务不存在"), { status: 404 })
  if (manifest.userId !== userId) return NextResponse.json(makeApiErr(traceId, "FORBIDDEN", "无权限操作该上传任务"), { status: 403 })
  const manifestSafe = manifest

  const dir = path.join(getUploadRoot(), uploadId)
  const missing: number[] = []
  for (let i = 0; i < manifestSafe.totalChunks; i++) {
    try {
      await stat(path.join(dir, `chunk_${i}.part`))
    } catch {
      missing.push(i)
    }
  }
  if (missing.length > 0) return NextResponse.json(makeApiErr(traceId, "CHUNK_MISSING", `缺少分片：${missing.slice(0, 20).join(",")}`), { status: 400 })

  const ext = sanitizeExt(manifestSafe.fileName.split(".").pop() ?? "bin")
  const timestamp = Date.now()
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8)
  const desiredKey = `public/${manifestSafe.type}/${timestamp}-${random}.${ext}`

  try {
    const storage = getS3Storage()
    async function* chunks(): AsyncIterable<Buffer> {
      for (let i = 0; i < manifestSafe.totalChunks; i++) {
        const buf = await readFile(path.join(dir, `chunk_${i}.part`))
        yield buf
      }
    }
    const uploadedKey = await storage.chunkUploadFile({
      chunks: chunks(),
      fileName: desiredKey,
      contentType: manifestSafe.contentType || "application/octet-stream"
    })
    const url = await resolveStorageUrl(storage, uploadedKey)

    const tags = (manifestSafe.tags ?? "")
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100)
    const applicableScenes = (manifestSafe.applicableScenes ?? "")
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100)

    const nameFromFile = (manifestSafe.fileName || "video").replace(/\.[^/.]+$/, "")
    const resourceName = manifestSafe.name?.trim() || nameFromFile || "video"

    const payload = insertPublicResourceSchema.parse({
      userId,
      type: manifestSafe.type,
      source: "upload",
      name: resourceName,
      description: manifestSafe.description ?? "",
      previewUrl: url,
      previewStorageKey: uploadedKey,
      originalUrl: url,
      originalStorageKey: uploadedKey,
      durationMs: typeof manifestSafe.durationMs === "number" ? manifestSafe.durationMs : null,
      tags,
      applicableScenes
    })

    const db = await getDb({ publicResources })
    const [row] = await db.insert(publicResources).values(payload).returning({ id: publicResources.id })
    const id = row?.id ?? null
    if (id) {
      const stablePreview = `/api/library/public-resources/file/${id}?kind=preview`
      const stableOriginal = `/api/library/public-resources/file/${id}?kind=original`
      await db
        .update(publicResources)
        .set({
          previewUrl: stablePreview,
          originalUrl: stableOriginal
        })
        .where(eq(publicResources.id, id))
    }

    await rm(dir, { recursive: true, force: true })
    return NextResponse.json(makeApiOk(traceId, { id, url: id ? `/api/library/public-resources/file/${id}?kind=original` : url, storageKey: uploadedKey }), {
      status: 200
    })
  } catch (err) {
    const errText = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return NextResponse.json(makeApiErr(traceId, "UPLOAD_FAILED", errText), { status: 500 })
  }
}
