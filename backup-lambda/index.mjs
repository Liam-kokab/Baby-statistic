/**
 * Standalone AWS Lambda function (Node.js 20.x runtime, ES module).
 *
 * What it does, every time it's invoked:
 *   1. Logs into the baby-statistic API as an admin user (POST /api/auth/login)
 *   2. Downloads the full data backup (GET /api/backup)
 *   3. Uploads it to S3 as backups/backup-<timestamp>.json
 *   4. Concurrently (once uploaded): verifies the uploaded object's size is > 0
 *      (HeadObjectCommand), and deletes any object under the S3 prefix older
 *      than RETENTION_DAYS (default 14) — these two steps are independent of
 *      each other, so they run in parallel via Promise.all.
 *   5. If verification passed, reports success to the API
 *      (POST /api/app-events/backup) so the app can show a "last successful
 *      backup" status. No report is sent on failure — absence of a recent
 *      report is itself the failure signal.
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

import { S3Client, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

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

// Confirms the uploaded object actually made it to S3 with a non-zero size.
// Returns true if the backup can be considered a verified success.
const verifyUpload = async (config, key) => {
  const head = await s3Client.send(new HeadObjectCommand({ Bucket: config.s3Bucket, Key: key }));
  return (head.ContentLength ?? 0) > 0;
};

// Reports a successful, size-verified backup to the API so the app can show a
// "last successful backup" status dot. Failures here are logged but not thrown —
// a report failure shouldn't fail the whole Lambda invocation (the backup itself
// already succeeded).
const reportBackupSuccess = async (apiBaseUrl, accessToken) => {
  try {
    const response = await fetch(`${apiBaseUrl}/api/app-events/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ timestamp: new Date().toISOString() }),
    });
    if (!response.ok) {
      console.warn(`Backup success report failed: HTTP ${response.status} ${await response.text()}`);
    }
  } catch (err) {
    console.warn('Backup success report failed:', err);
  }
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

  // verifyUpload and pruneOldBackups are independent of each other (both only depend on
  // the already-uploaded uploadedKey/config), so run them concurrently.
  const [verified, deletedKeys] = await Promise.all([
    verifyUpload(config, uploadedKey),
    pruneOldBackups(config),
  ]);
  console.log(`Pruned ${deletedKeys.length} old backup(s): ${deletedKeys.join(', ') || '(none)'}`);

  // No report is sent on failure — per design, absence of a recent report IS the failure signal.
  if (verified) {
    await reportBackupSuccess(config.apiBaseUrl, accessToken);
    console.log('Backup verified (size > 0) and reported as successful.');
  } else {
    console.error(`Backup verification failed: s3://${config.s3Bucket}/${uploadedKey} has size 0.`);
  }


  return { ok: true, uploadedKey, verified, deletedKeys };
};

