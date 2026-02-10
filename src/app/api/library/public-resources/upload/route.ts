import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getDb } from "coze-coding-dev-sdk"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { getSessionFromRequest } from "@/shared/session"
import { getTraceId } from "@/shared/trace"
import { publicResources, insertPublicResourceSchema } from "@/shared/schema"
import { uploadPublicBuffer } from "@/shared/storage"
import { eq } from "drizzle-orm"
import { ensurePublicSchema } from "@/server/db/ensurePublicSchema"

const inputSchema = z.object({
  type: z.string().trim().min(1).max(50),
  name: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  tags: z.string().trim().max(5000).optional(),
  applicableScenes: z.string().trim().max(5000).optional()
})

function normalizeDurationMs(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

function parseBoundary(contentType: string): string | null {
  const m = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
  const boundary = (m?.[1] ?? m?.[2] ?? "").trim()
  return boundary ? boundary : null
}

function parseFilenameFromDisposition(disposition: string): string | null {
  const direct = disposition.match(/filename="([^"]*)"/i)?.[1]
  if (typeof direct === "string") return direct

  const starred = disposition.match(/filename\*=([^;]+)/i)?.[1]?.trim()
  if (!starred) return null
  const cleaned = starred.replace(/^"(.*)"$/, "$1")
  const utf8Prefix = "utf-8''"
  if (cleaned.toLowerCase().startsWith(utf8Prefix)) {
    const encoded = cleaned.slice(utf8Prefix.length)
    try {
      return decodeURIComponent(encoded)
    } catch {
      return encoded
    }
  }
  return cleaned
}

type ParsedMultipart = {
  fields: Record<string, string>
  file: { buffer: Buffer; fileName: string; contentType: string } | null
  parts: Array<{ name: string; isFile: boolean; fileName?: string; contentType?: string }>
  isComplete: boolean
}

function parseMultipartBody(body: Buffer, boundary: string): ParsedMultipart {
  const boundaryBuf = Buffer.from(`--${boundary}`)
  const headerSep = Buffer.from("\r\n\r\n")
  const lineSep = Buffer.from("\r\n")
  const fields: Record<string, string> = {}
  let file: ParsedMultipart["file"] = null
  const parts: ParsedMultipart["parts"] = []
  let isComplete = true

  let pos = body.indexOf(boundaryBuf)
  if (pos === -1) return { fields, file, parts, isComplete: false }
  while (pos !== -1) {
    pos += boundaryBuf.length
    if (body.slice(pos, pos + 2).equals(Buffer.from("--"))) break
    if (body.slice(pos, pos + 2).equals(lineSep)) pos += 2

    let next = body.indexOf(boundaryBuf, pos)
    if (next === -1) {
      next = body.length
      isComplete = false
    }
    const partEnd = next === body.length ? next : Math.max(pos, next - 2)
    const part = body.slice(pos, partEnd)
    const headerEnd = part.indexOf(headerSep)
    if (headerEnd === -1) {
      pos = next === body.length ? -1 : next
      continue
    }

    const headerText = part.slice(0, headerEnd).toString("utf8")
    const content = part.slice(headerEnd + headerSep.length)
    const headers: Record<string, string> = {}
    for (const line of headerText.split("\r\n")) {
      const idx = line.indexOf(":")
      if (idx <= 0) continue
      const k = line.slice(0, idx).trim().toLowerCase()
      const v = line.slice(idx + 1).trim()
      headers[k] = v
    }

    const disposition = headers["content-disposition"] ?? ""
    const nameMatch = disposition.match(/name="([^"]+)"/i)
    const fileName = parseFilenameFromDisposition(disposition)
    const fieldName = nameMatch?.[1] ?? ""
    if (!fieldName) {
      pos = next === body.length ? -1 : next
      continue
    }

    if (fileName != null) {
      parts.push({
        name: fieldName,
        isFile: true,
        fileName: fileName || undefined,
        contentType: headers["content-type"] || undefined
      })
      if (fieldName === "file" && file == null) {
        file = {
          buffer: content,
          fileName: fileName || "upload.bin",
          contentType: headers["content-type"] || "application/octet-stream"
        }
      }
      pos = next === body.length ? -1 : next
      continue
    }

    fields[fieldName] = content.toString("utf8").trim()
    parts.push({ name: fieldName, isFile: false })
    pos = next === body.length ? -1 : next
  }

  return { fields, file, parts, isComplete }
}

export async function POST(req: NextRequest): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const session = await getSessionFromRequest(req)
  const userId = session?.userId
  if (!userId) return NextResponse.json(makeApiErr(traceId, "AUTH_REQUIRED", "未登录或登录已过期"), { status: 401 })

  await ensurePublicSchema()

  const contentType = req.headers.get("content-type") || "unknown"
  const contentLength = req.headers.get("content-length") || "unknown"
  const boundary = contentType.includes("multipart/form-data") ? parseBoundary(contentType) : null
  if (!boundary) {
    return NextResponse.json(makeApiErr(traceId, "INVALID_FORM", `请求体不是合法表单（需要 multipart/form-data；当前 content-type=${contentType}）`), { status: 400 })
  }

  let bodyBuffer: Buffer
  try {
    bodyBuffer = Buffer.from(await req.arrayBuffer())
  } catch (err) {
    const errText = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return NextResponse.json(
      makeApiErr(traceId, "INVALID_FORM", `请求体不是合法表单（content-type=${contentType}；content-length=${contentLength}；readError=${errText}）`),
      { status: 400 }
    )
  }

  const expectedLength = Number.parseInt(contentLength, 10)
  if (Number.isFinite(expectedLength) && expectedLength > 0 && bodyBuffer.length !== expectedLength) {
    return NextResponse.json(
      makeApiErr(
        traceId,
        "BODY_INCOMPLETE",
        `请求体不完整（expected=${expectedLength} bytes；received=${bodyBuffer.length} bytes；content-type=${contentType}）`
      ),
      { status: 400 }
    )
  }

  let parsedMultipart: ParsedMultipart
  try {
    parsedMultipart = parseMultipartBody(bodyBuffer, boundary)
  } catch (err) {
    const errText = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return NextResponse.json(
      makeApiErr(traceId, "INVALID_FORM", `请求体不是合法表单（content-type=${contentType}；content-length=${contentLength}；parseError=${errText}）`),
      { status: 400 }
    )
  }

  const file = parsedMultipart.file
  if (!parsedMultipart.isComplete) {
    return NextResponse.json(makeApiErr(traceId, "BODY_INCOMPLETE", "上传中断或请求体不完整"), { status: 400 })
  }
  if (!file) {
    const partsSummary = parsedMultipart.parts.map((p) => (p.isFile ? `${p.name}(file:${p.fileName ?? ""})` : p.name)).join(", ")
    return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", `缺少文件（已解析字段: ${partsSummary || "none"}）`), { status: 400 })
  }

  const parsed = inputSchema.safeParse({
    type: parsedMultipart.fields["type"] ?? "",
    name: parsedMultipart.fields["name"] || undefined,
    description: parsedMultipart.fields["description"] || undefined,
    tags: parsedMultipart.fields["tags"] || undefined,
    applicableScenes: parsedMultipart.fields["applicableScenes"] || undefined
  })
  if (!parsed.success) return NextResponse.json(makeApiErr(traceId, "VALIDATION_FAILED", "参数格式不正确"), { status: 400 })

  const type = parsed.data.type
  const fileExt = (file.fileName.split(".").pop() ?? "bin").toLowerCase()
  const { url, key } = await uploadPublicBuffer({
    buffer: file.buffer,
    contentType: file.contentType || "application/octet-stream",
    fileExt,
    prefix: `public/${type}`
  })
  const nameFromFile = file.fileName.replace(/\.[^/.]+$/, "")
  const resourceName = parsed.data.name?.trim() || nameFromFile || "audio"
  const tags = (parsed.data.tags ?? "")
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100)
  const applicableScenes = (parsed.data.applicableScenes ?? "")
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100)

  const durationMs = normalizeDurationMs(parsedMultipart.fields["durationMs"])

  const payload = insertPublicResourceSchema.parse({
    userId,
    type,
    source: "upload",
    name: resourceName,
    description: parsed.data.description ?? "",
    previewUrl: url,
    previewStorageKey: key,
    originalUrl: url,
    originalStorageKey: key,
    durationMs,
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

  return NextResponse.json(makeApiOk(traceId, { id, url: id ? `/api/library/public-resources/file/${id}?kind=original` : url, storageKey: key }), { status: 200 })
}
