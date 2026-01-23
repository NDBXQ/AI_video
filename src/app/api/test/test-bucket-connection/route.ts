import { NextResponse } from "next/server"
import { S3Storage } from "coze-coding-dev-sdk"
import { readEnv } from "@/features/coze/env"
import { makeApiErr, makeApiOk } from "@/shared/api"
import { logger } from "@/shared/logger"
import { getTraceId } from "@/shared/trace"

export const runtime = "nodejs"

function getEndpointHost(endpointUrl: string | undefined): string | undefined {
  if (!endpointUrl) return undefined
  try {
    return new URL(endpointUrl).host
  } catch {
    return endpointUrl
  }
}

export async function GET(req: Request): Promise<Response> {
  const traceId = getTraceId(req.headers)
  const start = Date.now()

  const endpointUrl = readEnv("COZE_BUCKET_ENDPOINT_URL")
  const bucketName = readEnv("COZE_BUCKET_NAME")
  const accessKey = readEnv("COZE_BUCKET_ACCESS_KEY")
  const secretKey = readEnv("COZE_BUCKET_SECRET_KEY")
  const region = readEnv("COZE_BUCKET_REGION") ?? "cn-beijing"
  const workloadToken = readEnv("COZE_WORKLOAD_IDENTITY_API_KEY")

  const configured = {
    hasEndpoint: !!endpointUrl,
    hasBucket: !!bucketName,
    hasAccessKey: !!accessKey,
    hasSecretKey: !!secretKey,
    hasWorkloadToken: !!workloadToken
  }

  logger.info({
    event: "s3_connection_test_start",
    module: "storage",
    traceId,
    message: "开始测试对象存储连通性",
    configured,
    endpointHost: getEndpointHost(endpointUrl),
    bucketName,
    region
  })

  if (!endpointUrl || !bucketName || !accessKey || !secretKey) {
    const durationMs = Date.now() - start
    logger.warn({
      event: "s3_connection_test_not_configured",
      module: "storage",
      traceId,
      message: "对象存储未配置，跳过连通性测试",
      durationMs,
      configured
    })

    return NextResponse.json(
      makeApiErr(
        traceId,
        "S3_NOT_CONFIGURED",
        "对象存储未配置，请设置 COZE_BUCKET_ENDPOINT_URL/COZE_BUCKET_NAME/COZE_BUCKET_ACCESS_KEY/COZE_BUCKET_SECRET_KEY"
      ),
      { status: 500 }
    )
  }

  try {
    const storage = new S3Storage({
      endpointUrl,
      accessKey,
      secretKey,
      bucketName,
      region
    })

    const list = await storage.listFiles({ maxKeys: 1 })

    const durationMs = Date.now() - start
    logger.info({
      event: "s3_connection_test_success",
      module: "storage",
      traceId,
      message: "对象存储连通性测试成功",
      durationMs,
      endpointHost: getEndpointHost(endpointUrl),
      bucketName,
      region,
      resultSummary: {
        keys: Array.isArray((list as { keys?: unknown }).keys) ? (list as { keys: unknown[] }).keys.length : undefined
      }
    })

    return NextResponse.json(makeApiOk(traceId, { configured, list }), { status: 200 })
  } catch (err) {
    const durationMs = Date.now() - start
    const anyErr = err as { name?: string; message?: string; stack?: string }
    logger.error({
      event: "s3_connection_test_failed",
      module: "storage",
      traceId,
      message: "对象存储连通性测试失败",
      durationMs,
      configured,
      endpointHost: getEndpointHost(endpointUrl),
      bucketName,
      region,
      errorName: anyErr?.name,
      errorMessage: anyErr?.message,
      stack: anyErr?.stack
    })

    return NextResponse.json(makeApiErr(traceId, "S3_CONNECTION_TEST_FAILED", anyErr?.message ?? "对象存储连通性测试失败"), {
      status: 502
    })
  }
}
