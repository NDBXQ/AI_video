import { NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

/**
 * GET /api/test/test-bucket-connection
 * 测试对象存储（S3兼容）连通性与权限
 * @returns {Promise<NextResponse>} 响应结果
 */
export async function GET() {
  try {
    const hasEndpoint = !!process.env.COZE_BUCKET_ENDPOINT_URL;
    const hasBucket = !!process.env.COZE_BUCKET_NAME;
    const hasAccessKey = !!process.env.COZE_BUCKET_ACCESS_KEY;
    const hasSecretKey = !!process.env.COZE_BUCKET_SECRET_KEY;
    const hasWorkloadToken = !!process.env.COZE_WORKLOAD_IDENTITY_API_KEY;

    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: process.env.COZE_BUCKET_ACCESS_KEY || '',
      secretKey: process.env.COZE_BUCKET_SECRET_KEY || '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: process.env.COZE_BUCKET_REGION || 'cn-beijing',
    });

    const result = await storage.listFiles({ maxKeys: 1 });

    return NextResponse.json({
      success: true,
      data: {
        configured: {
          hasEndpoint,
          hasBucket,
          hasAccessKey,
          hasSecretKey,
          hasWorkloadToken,
        },
        list: result,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        configured: {
          hasEndpoint: !!process.env.COZE_BUCKET_ENDPOINT_URL,
          hasBucket: !!process.env.COZE_BUCKET_NAME,
          hasAccessKey: !!process.env.COZE_BUCKET_ACCESS_KEY,
          hasSecretKey: !!process.env.COZE_BUCKET_SECRET_KEY,
          hasWorkloadToken: !!process.env.COZE_WORKLOAD_IDENTITY_API_KEY,
        },
      },
      { status: 500 }
    );
  }
}

