import { S3Storage } from 'coze-coding-dev-sdk';
import { readEnv } from '@/shared/env';

let s3StorageInstance: S3Storage | null = null;

export const createCozeS3Storage = (): S3Storage => {
  if (s3StorageInstance) {
    return s3StorageInstance;
  }

  const endpointUrl = readEnv('BUCKET_ENDPOINT_URL');
  const bucketName = readEnv('BUCKET_NAME');
  const region = readEnv('BUCKET_REGION') || 'cn-beijing';
  const accessKey = readEnv('BUCKET_ACCESS_KEY') || '';
  const secretKey = readEnv('BUCKET_SECRET_KEY') || '';

  if (!endpointUrl || !bucketName) {
    throw new Error('Missing COZE_BUCKET configuration environment variables');
  }

  s3StorageInstance = new S3Storage({
    endpointUrl,
    accessKey,
    secretKey,
    bucketName,
    region,
  });

  return s3StorageInstance;
};
