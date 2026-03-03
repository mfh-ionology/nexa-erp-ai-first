import { S3Client } from '@aws-sdk/client-s3';

let s3Client: S3Client | null = null;

/**
 * Returns a singleton S3Client initialised from environment variables.
 *
 * For local development (MinIO): set S3_FORCE_PATH_STYLE=true and
 * S3_ENDPOINT=http://localhost:9000.
 *
 * For production: standard S3 endpoint with IAM credentials or explicit keys.
 */
export function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'S3 credentials not configured: S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required',
    );
  }

  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? 'eu-west-2';
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

  s3Client = new S3Client({
    region,
    ...(endpoint && { endpoint }),
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });

  return s3Client;
}

/**
 * Returns the default bucket name from environment.
 */
export function getDefaultBucket(): string {
  return process.env.S3_BUCKET_NAME ?? 'nexa-attachments';
}
