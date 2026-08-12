/**
 * Standalone AWS Lambda function (Node.js 20.x runtime, ES module).
 *
 * What it does, every time it's invoked:
 *   1. Logs into the baby-statistic API as an admin user (POST /api/auth/login)
 *   2. Downloads the full data backup (GET /api/backup)
 *   3. Uploads it to S3 as backups/backup-<timestamp>.json
 *   4. Only if the upload succeeded: deletes any object under that S3 prefix
 *      older than RETENTION_DAYS (default 14)
 *
 * Deployment: paste this file's contents into the Lambda console's inline
 * code editor as index.mjs (Runtime: Node.js 20.x, Handler: index.handler).
 * The AWS SDK v3 (@aws-sdk/client-s3) and the global `fetch` are both already
 * available in the Node.js 20.x Lambda runtime — no dependencies to install,
 * no bundler needed.
 *
 * Required environment variables (set on the Lambda function):
 *   API_BASE_URL    e.g. https://your-domain.example  (no trailing slash)
 *   ADMIN_USERNAME  an admin user's username
 *   ADMIN_PASSWORD  that admin user's password
 *   S3_BUCKET       destination bucket name
 * Optional:
 *   S3_PREFIX       default "backups/"
 *   RETENTION_DAYS  default "14"
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({});

const getConfig = () => {
  const requireEnv = (name) => {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  };

  return {
    apiBaseUrl: requireEnv('API_BASE_URL').replace(/\/$/, ''),
    adminUsername: requireEnv('ADMIN_USERNAME'),
    adminPassword: requireEnv('ADMIN_PASSWORD'),
    s3Bucket: requireEnv('S3_BUCKET'),
    s3Prefix: process.env.S3_PREFIX || 'backups/',
    retentionDays: Number(process.env.RETENTION_DAYS || '14'),
  };
};

const login = async (apiBaseUrl, username, password) => {
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(`Login failed: HTTP ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  return data.accessToken;
};

const fetchBackup = async (apiBaseUrl, accessToken) => {
  const response = await fetch(`${apiBaseUrl}/api/backup`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Backup fetch failed: HTTP ${response.status} ${await response.text()}`);
  }
  return response.json();
};

const uploadBackup = async (config, backup) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `${config.s3Prefix}backup-${timestamp}.json`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
      Body: JSON.stringify(backup),
      ContentType: 'application/json',
    })
  );
  return key;
};

// Deletes every object under config.s3Prefix whose LastModified is older
// than config.retentionDays. Returns the list of deleted keys.
const pruneOldBackups = async (config) => {
  const cutoff = new Date(Date.now() - config.retentionDays * 24 * 60 * 60 * 1000);
  const staleKeys = [];
  let continuationToken;

  do {
    const listResult = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: config.s3Bucket,
        Prefix: config.s3Prefix,
        ContinuationToken: continuationToken,
      })
    );

    (listResult.Contents || [])
      .filter((object) => object.Key && object.LastModified && object.LastModified < cutoff)
      .forEach((object) => staleKeys.push(object.Key));

    continuationToken = listResult.IsTruncated ? listResult.NextContinuationToken : undefined;
  } while (continuationToken);

  // S3 DeleteObjects accepts at most 1000 keys per request.
  for (let i = 0; i < staleKeys.length; i += 1000) {
    const batch = staleKeys.slice(i, i + 1000);
    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: config.s3Bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      })
    );
  }

  return staleKeys;
};

export const handler = async () => {
  const config = getConfig();

  const accessToken = await login(config.apiBaseUrl, config.adminUsername, config.adminPassword);
  const backup = await fetchBackup(config.apiBaseUrl, accessToken);
  const uploadedKey = await uploadBackup(config, backup);
  console.log(`Backup uploaded: s3://${config.s3Bucket}/${uploadedKey}`);

  // Only prune once the new backup is safely uploaded.
  const deletedKeys = await pruneOldBackups(config);
  console.log(`Pruned ${deletedKeys.length} old backup(s): ${deletedKeys.join(', ') || '(none)'}`);

  return { ok: true, uploadedKey, deletedKeys };
};

