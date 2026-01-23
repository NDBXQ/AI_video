import { S3Storage } from 'coze-coding-dev-sdk';

/**
 * 创建对象存储客户端
 * @returns {S3Storage} S3 对象存储实例
 */
export function createCozeStorage(): S3Storage {
  return new S3Storage({
    endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
    accessKey: process.env.COZE_BUCKET_ACCESS_KEY || '',
    secretKey: process.env.COZE_BUCKET_SECRET_KEY || '',
    bucketName: process.env.COZE_BUCKET_NAME,
    region: process.env.COZE_BUCKET_REGION || 'cn-beijing',
  });
}

