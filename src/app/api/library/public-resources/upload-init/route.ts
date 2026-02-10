import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"

const inputSchema = z.object({
  type: z.string().trim().min(1).max(50),
  fileName: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(1).max(200),
  size: z.number().int().min(1),
  durationMs: z.number().int().positive().max(24 * 60 * 60 * 1000).optional(),
  name: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  tags: z.string().trim().max(5000).optional(),
  applicableScenes: z.string().trim().max(5000).optional()
})

function getUploadRoot(): string {
  return path.join(process.cwd(), ".tmp", "public-resource-uploads")
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

  const chunkSize = 5 * 1024 * 1024
  const totalChunks = Math.max(1, Math.ceil(parsed.data.size / chunkSize))
  const uploadId = crypto.randomUUID()
  const dir = path.join(getUploadRoot(), uploadId)
  await mkdir(dir, { recursive: true })

  const manifest = {
    uploadId,
    userId,
    createdAt: Date.now(),
    type: parsed.data.type,
    fileName: parsed.data.fileName,
    contentType: parsed.data.contentType,
    size: parsed.data.size,
    chunkSize,
    totalChunks,
    durationMs: parsed.data.durationMs ?? null,
    name: parsed.data.name ?? "",
    description: parsed.data.description ?? "",
    tags: parsed.data.tags ?? "",
    applicableScenes: parsed.data.applicableScenes ?? ""
  }

  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest), "utf8")

  return NextResponse.json(makeApiOk(traceId, { uploadId, chunkSize, totalChunks }), { status: 200 })
}
