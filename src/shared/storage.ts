import { S3Storage } from "coze-coding-dev-sdk"
import { readEnv } from "@/features/coze/env"

let s3Instance: S3Storage | null = null

export function getS3Storage(): S3Storage {
  if (s3Instance) return s3Instance

  const endpointUrl = readEnv("COZE_BUCKET_ENDPOINT_URL")
  const bucketName = readEnv("COZE_BUCKET_NAME")
  const accessKey = readEnv("COZE_BUCKET_ACCESS_KEY")
  const secretKey = readEnv("COZE_BUCKET_SECRET_KEY")
  const region = readEnv("COZE_BUCKET_REGION") ?? "cn-beijing"

  if (!endpointUrl || !bucketName || !accessKey || !secretKey) {
    throw new Error("S3 storage not configured")
  }

  s3Instance = new S3Storage({
    endpointUrl,
    accessKey,
    secretKey,
    bucketName,
    region
  })

  return s3Instance
}

export async function uploadPublicFile(
  file: File, 
  prefix: string = "public"
): Promise<{ url: string; key: string }> {
  const storage = getS3Storage()
  const bucketName = readEnv("COZE_BUCKET_NAME")
  const endpointUrl = readEnv("COZE_BUCKET_ENDPOINT_URL")
  if (!bucketName || !endpointUrl) throw new Error("S3 storage not configured")
  const buffer = Buffer.from(await file.arrayBuffer())
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = file.name.split(".").pop() ?? "bin"
  const key = `${prefix}/${timestamp}-${random}.${ext}`

  const uploadedKey = await storage.uploadFile({
    fileContent: buffer,
    fileName: key,
    contentType: file.type || "application/octet-stream"
  })

  // 生成公开可访问的 URL（长期有效，不依赖预签名）
  const url = new URL(`/${bucketName}/${uploadedKey}`, endpointUrl).toString()

  return { url, key: uploadedKey }
}

export async function uploadPublicBuffer(input: {
  buffer: Buffer
  contentType: string
  fileExt: string
  prefix?: string
}): Promise<{ url: string; key: string }> {
  const storage = getS3Storage()
  const bucketName = readEnv("COZE_BUCKET_NAME")
  const endpointUrl = readEnv("COZE_BUCKET_ENDPOINT_URL")
  if (!bucketName || !endpointUrl) throw new Error("S3 storage not configured")

  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const normalizedPrefix = input.prefix ?? "public"
  const fileExt = input.fileExt.startsWith(".") ? input.fileExt.slice(1) : input.fileExt
  const key = `${normalizedPrefix}/${timestamp}-${random}.${fileExt}`

  const uploadedKey = await storage.uploadFile({
    fileContent: input.buffer,
    fileName: key,
    contentType: input.contentType
  })

  const url = new URL(`/${bucketName}/${uploadedKey}`, endpointUrl).toString()
  return { url, key: uploadedKey }
}
