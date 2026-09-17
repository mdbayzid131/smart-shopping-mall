/* eslint-disable no-undef */
/* eslint-disable no-console */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import config from '../config';

const s3Client = new S3Client({
  region: config.aws.region as string,
  credentials: {
    accessKeyId: config.aws.accessKeyId as string,
    secretAccessKey: config.aws.secretAccessKey as string,
  },
});

// Escape regex special characters
const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Extract only keys that belong to this application's configured bucket/CDN.
// Returning undefined for third-party URLs prevents accidental deletion calls
// against user-supplied or OAuth avatar URLs.
export const getS3KeyFromUrl = (url: string): string | undefined => {
  const cloudfrontDomain = config.aws.cloudfrontDomain?.replace(/\/$/, '');
  // Check if it's a CloudFront URL
  if (cloudfrontDomain && url.startsWith(`${cloudfrontDomain}/`)) {
    return url.slice(cloudfrontDomain.length + 1);
  }
  // Check if it's an S3 URL
  const escapedBucketName = escapeRegExp(config.aws.bucketName as string);
  const escapedRegion = escapeRegExp(config.aws.region as string);
  const s3UrlPattern = new RegExp(
    `^https?://${escapedBucketName}\\.s3[-.]${escapedRegion}\\.amazonaws\\.com/`,
  );
  if (s3UrlPattern.test(url)) {
    return url.replace(s3UrlPattern, '');
  }
  return undefined;
};

export const isManagedS3Url = (url: string): boolean =>
  Boolean(getS3KeyFromUrl(url));

const isMockAws = (): boolean => {
  const key = config.aws.accessKeyId || '';
  return (
    !key ||
    key.startsWith('mock_') ||
    key.includes('replace-me') ||
    (config.aws.bucketName || '').includes('replace-me')
  );
};

export const uploadToS3 = async (
  file: Express.Multer.File,
  folder: string = 'products',
): Promise<string> => {
  const safeOriginalName = path
    .basename(file.originalname)
    .replace(/[^a-zA-Z0-9._-]/g, '-');
  const fileName = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeOriginalName}`;

  // If running locally without real AWS credentials, store files in local uploads directory
  if (isMockAws()) {
    const targetPath = path.join(process.cwd(), 'uploads', fileName);
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }
    const hasBuffer = Buffer.isBuffer(file.buffer) && file.buffer.length > 0;
    if (hasBuffer) {
      await fs.promises.writeFile(targetPath, file.buffer);
    } else {
      await fs.promises.copyFile(file.path, targetPath);
    }
    return `${config.api_public_url}/uploads/${fileName}`;
  }

  const hasBuffer = Buffer.isBuffer(file.buffer) && file.buffer.length > 0;
  const contentLength = hasBuffer
    ? file.buffer.length
    : (await fs.promises.stat(file.path)).size;

  const uploadParams: PutObjectCommandInput = {
    Bucket: config.aws.bucketName as string,
    Key: fileName,
    Body: hasBuffer ? file.buffer : fs.createReadStream(file.path),
    ContentType: file.mimetype,
    ContentLength: contentLength,
    CacheControl: file.mimetype.startsWith('image/')
      ? 'public, max-age=31536000, immutable'
      : 'private, no-cache',
    ContentDisposition: file.mimetype.startsWith('image/')
      ? 'inline'
      : undefined,
  };

  const command = new PutObjectCommand(uploadParams);
  await s3Client.send(command);

  // Return CloudFront URL if available, else S3 URL
  if (
    config.aws.cloudfrontDomain &&
    !config.aws.cloudfrontDomain.includes('example.com')
  ) {
    return `${config.aws.cloudfrontDomain.replace(/\/$/, '')}/${fileName}`;
  }
  return `https://${config.aws.bucketName}.s3.${config.aws.region}.amazonaws.com/${fileName}`;
};

export const deleteFromS3 = async (url: string): Promise<void> => {
  if (url.includes('/uploads/')) {
    try {
      const relativePath = url.split('/uploads/')[1];
      if (relativePath) {
        const localPath = path.join(process.cwd(), 'uploads', relativePath);
        if (fs.existsSync(localPath)) {
          await fs.promises.unlink(localPath);
        }
      }
    } catch {
      // Ignore local cleanup errors
    }
    return;
  }

  const key = getS3KeyFromUrl(url);
  if (!key || isMockAws()) return;

  const deleteParams = {
    Bucket: config.aws.bucketName as string,
    Key: key,
  };

  const command = new DeleteObjectCommand(deleteParams);
  await s3Client.send(command);
};

