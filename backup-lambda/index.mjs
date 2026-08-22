/**
 * Standalone AWS Lambda function (Node.js 20.x runtime, ES module).
 *
 * What it does, every time it's invoked:
 *   0. Starts listing S3 objects under the backup prefix (to find stale ones to
 *      prune) at MODULE LOAD TIME — i.e. during the Lambda init phase, before
 *      the handler even runs — since it only needs env vars (already set by
 *      the time the module loads), not the backup/upload result. The handler
 *      only awaits this prefetched promise later, once it actually needs the
 *      list (see step 3). This is scheduled every 6 hours (see README), which
 *      is far beyond Lambda's warm-container idle window, so in practice every
 *      invocation is a cold start and this prefetch always applies.
 *   1. Downloads the full data backup (GET /api/backup), authenticated with a
 *      pre-issued admin API key (see LAMBDA_API_KEY below) — no login step,
 *      since API keys don't require a slow password-hash round-trip.
 *   2. Uploads it to S3 as backups/backup-<timestamp>.json
 *   3. Verifies the uploaded object's size is > 0 (HeadObjectCommand), in
 *      parallel with awaiting the stale-object list prefetched in step 0
 *      (almost certainly already resolved by now) and then deleting those
 *      stale objects.
 *   4. If verification passed, reports success to the API
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
 *   API_BASE_URL     e.g. https://your-domain.example  (no trailing slash)
 *   LAMBDA_API_KEY   an admin-issued API key (create one via the admin "API
 *                    Keys" page, or POST /api/admin/api-keys) — sent as
 *                    Authorization: Bearer <key> on every API request.
 *   S3_BUCKET        destination bucket name
 * Optional:
 *   S3_PREFIX       default "backups/"
 *   RETENTION_DAYS  default "14"
 */

import { S3Client, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({});

// Wraps an async step with start/end logging (including duration in ms) so
// slow invocations can be diagnosed from the Lambda logs. Works equally well
// for a fresh call (fn kicks off new work) or for re-awaiting an
// already-in-flight promise (fn just returns it) — in the latter case the
// logged duration is however long was left to wait, not the total work time.
const timeStep = async (name, fn) => {
  console.log(`Step start: ${name}`);
  const startedAt = Date.now();
  const result = await fn();
  console.log(`Step end: ${name} (${Date.now() - startedAt}ms)`);
  return result;
};

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
    apiKey: requireEnv('LAMBDA_API_KEY'),
    s3Bucket: requireEnv('S3_BUCKET'),
    s3Prefix: process.env.S3_PREFIX || 'backups/',
    retentionDays: Number(process.env.RETENTION_DAYS || '14'),
  };
};

const fetchBackup = async (apiBaseUrl, apiKey) => {
  const response = await fetch(`${apiBaseUrl}/api/backup`, {
    headers: { Authorization: `Bearer ${apiKey}` },
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
const reportBackupSuccess = async (apiBaseUrl, apiKey) => {
  try {
    const response = await fetch(`${apiBaseUrl}/api/app-events/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ timestamp: new Date().toISOString() }),
    });
    if (!response.ok) {
      console.warn(`Backup success report failed: HTTP ${response.status} ${await response.text()}`);
    }
  } catch (err) {
    console.warn('Backup success report failed:', err);
  }
};

// Lists every object under config.s3Prefix whose LastModified is older than
// config.retentionDays. This is the slow part (paginated S3 List calls) — split
// out from deleteBackupKeys() below so it can be kicked off at module load time
// (see bottom of file) and only awaited once the result is actually needed.
const listStaleBackupKeys = async (config) => {
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

  return staleKeys;
};

// Deletes the given keys from S3 (batched at 1000 per request, the S3 DeleteObjects
// limit). Returns the same list back for convenient logging by the caller.
const deleteBackupKeys = async (config, staleKeys) => {
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

// ── Module-load-time prefetch ────────────────────────────────────────────────
// getConfig() only reads env vars, which Lambda already sets before the module is
// imported, so this — and the S3 listing it kicks off — can start during the
// Lambda init phase, before handler() is even called. By the time the handler
// reaches the prune step, this listing is very likely already finished (it was
// running the whole time the backup was being fetched/uploaded), turning what
// used to be a ~1.6s blocking step into a near-instant await.
//
// Caveat: on a warm (reused) container, this promise is NOT recomputed per
// invocation — it would resolve to a stale snapshot from whenever the module was
// first loaded. That's acceptable here: the schedule is every 6 hours (see
// README), far beyond Lambda's typical ~5-15 min idle teardown window, so in
// practice every invocation gets a fresh cold start (and thus a fresh listing).
const moduleLoadConfig = getConfig();
const staleBackupKeysPromise = listStaleBackupKeys(moduleLoadConfig);

export const handler = async () => {
  const config = moduleLoadConfig;

  const backup = await timeStep('fetchBackup', () => fetchBackup(config.apiBaseUrl, config.apiKey));
  const uploadedKey = await timeStep('uploadBackup', () => uploadBackup(config, backup));
  console.log(`Backup uploaded: s3://${config.s3Bucket}/${uploadedKey}`);

  // verifyUpload depends on uploadedKey; staleBackupKeysPromise was already kicked off
  // at module load (see above), so this just awaits whatever's left of it (likely ~0ms).
  const [verified, staleKeys] = await Promise.all([
    timeStep('verifyUpload', () => verifyUpload(config, uploadedKey)),
    timeStep('awaitStaleBackupKeys', () => staleBackupKeysPromise),
  ]);

  const deletedKeys = await timeStep('deleteStaleBackups', () => deleteBackupKeys(config, staleKeys));
  console.log(`Pruned ${deletedKeys.length} old backup(s): ${deletedKeys.join(', ') || '(none)'}`);

  // No report is sent on failure — per design, absence of a recent report IS the failure signal.
  if (verified) {
    await timeStep('reportBackupSuccess', () => reportBackupSuccess(config.apiBaseUrl, config.apiKey));
    console.log('Backup verified (size > 0) and reported as successful.');
  } else {
    console.error(`Backup verification failed: s3://${config.s3Bucket}/${uploadedKey} has size 0.`);
  }


  return { ok: true, uploadedKey, verified, deletedKeys };
};





