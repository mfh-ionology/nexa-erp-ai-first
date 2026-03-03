import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { getS3Client } from './s3-client.js';

const DEFAULT_PUT_EXPIRY = 15 * 60; // 15 minutes
const DEFAULT_GET_EXPIRY = 60 * 60; // 60 minutes per Architecture §2.20

/**
 * Generate a presigned PUT URL for direct browser upload to S3/MinIO.
 * The file never passes through the application server (BR-SYS-008).
 */
export async function generatePresignedPutUrl(
  bucket: string,
  key: string,
  contentType: string,
  contentLength: number,
  expiresIn: number = DEFAULT_PUT_EXPIRY,
): Promise<{ url: string; expiresIn: number }> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  const url = await getSignedUrl(getS3Client(), command, { expiresIn });
  return { url, expiresIn };
}

/**
 * Generate a presigned GET URL for direct browser download from S3/MinIO.
 * Default expiry 60 minutes per Architecture §2.20.
 */
export async function generatePresignedGetUrl(
  bucket: string,
  key: string,
  expiresIn: number = DEFAULT_GET_EXPIRY,
  downloadFileName?: string,
): Promise<{ url: string; expiresIn: number }> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(downloadFileName && {
      ResponseContentDisposition: `attachment; filename="${downloadFileName.replace(/"/g, '\\"')}"`,
    }),
  });

  const url = await getSignedUrl(getS3Client(), command, { expiresIn });
  return { url, expiresIn };
}

/**
 * Check if an object exists in S3/MinIO and return its metadata.
 * Returns null if the object does not exist.
 */
export async function headObject(
  bucket: string,
  key: string,
): Promise<{ contentLength: number; contentType: string } | null> {
  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await getS3Client().send(command);
    return {
      contentLength: response.ContentLength ?? 0,
      contentType: response.ContentType ?? 'application/octet-stream',
    };
  } catch (error: unknown) {
    // NotFound or NoSuchKey → object does not exist
    if (
      error instanceof Error &&
      'name' in error &&
      (error.name === 'NotFound' || error.name === 'NoSuchKey')
    ) {
      return null;
    }
    // Also handle the $metadata.httpStatusCode === 404 pattern
    if (
      typeof error === 'object' &&
      error !== null &&
      '$metadata' in error &&
      (error as { $metadata: { httpStatusCode?: number } }).$metadata.httpStatusCode === 404
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Delete an object from S3/MinIO.
 */
export async function deleteObject(bucket: string, key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await getS3Client().send(command);
}
