import { readEnv, readEnvInt } from "@/shared/env"
import type { S3Storage } from "coze-coding-dev-sdk"

export type StorageUrlMode = "presigned" | "direct"

export function getStorageUrlMode(): StorageUrlMode {
  const raw = (readEnv("STORAGE_URL_MODE") ?? "presigned").toLowerCase()
  return raw === "direct" ? "direct" : "presigned"
}

export function getStoragePresignedUrlExpireSeconds(): number {
  const v = readEnvInt("STORAGE_PRESIGNED_URL_EXPIRE_SECONDS")
  return typeof v === "number" && v > 0 ? v : 60 * 60 * 24 * 365
}

export function getStoragePresignedUrlFallbackSeconds(): number {
  const v = readEnvInt("STORAGE_PRESIGNED_URL_FALLBACK_SECONDS")
  return typeof v === "number" && v > 0 ? v : 60 * 60 * 24 * 7
}

export function buildDirectBucketUrl(key: string): string {
  const endpointUrl = readEnv("BUCKET_ENDPOINT_URL")
  const bucketName = readEnv("BUCKET_NAME")
  if (!endpointUrl || !bucketName) throw new Error("S3 storage not configured")
  return new URL(`/${bucketName}/${key}`, endpointUrl).toString()
}

export async function resolveStorageUrl(storage: S3Storage, key: string): Promise<string> {
  if (getStorageUrlMode() === "direct") return buildDirectBucketUrl(key)

  const primary = getStoragePresignedUrlExpireSeconds()
  const fallback = getStoragePresignedUrlFallbackSeconds()

  try {
    return await storage.generatePresignedUrl({ key, expireTime: primary })
  } catch {
    if (fallback !== primary) {
      try {
        return await storage.generatePresignedUrl({ key, expireTime: fallback })
      } catch {
      }
    }
    return buildDirectBucketUrl(key)
  }
}
