# Backup Lambda — Manual AWS Console Setup Guide

Standalone Lambda function that, on a schedule, logs into the baby-statistic
API, downloads a backup (`GET /api/backup`), uploads it to S3, verifies the
uploaded object's size is greater than 0, reports that success back to the API
(`POST /api/app-events/backup` — shown in the app as a backup-status dot), then
deletes any backup older than the retention period. This is **not** part of the
main application repo/build — it's just the code + instructions, to be
deployed by hand.

> **Simpler alternative:** you don't need any of this. You can just
> download `GET /api/backup` yourself (e.g. via Swagger UI or curl) and
> upload the file to an S3 bucket by hand through the AWS Console whenever
> you want a backup — no Lambda/IAM/EventBridge required. Only set up the
> Lambda below if you want backups fully automated on a schedule.

## AWS Services You Need

| Service | Purpose |
|---|---|
| **S3** | Stores the backup JSON files |
| **IAM** | Role + policy granting the Lambda permission to write logs and access the S3 bucket |
| **Lambda** | Runs the backup code on demand |
| **EventBridge (Scheduler or Rules)** | Triggers the Lambda every 6 hours |
| **CloudWatch Logs** | Where the Lambda's `console.log` output goes (created automatically) |

No VPC, no Secrets Manager, no API Gateway required.

---

## 1. Create the S3 Bucket

1. Go to **S3 → Create bucket**.
2. Name it (e.g. `baby-statistic-backups-<something-unique>`), pick a region.
3. Leave "Block all public access" **enabled**.
4. Everything else can stay default. Create the bucket.

## 2. Create the IAM Role for the Lambda

1. Go to **IAM → Roles → Create role**.
2. Trusted entity type: **AWS service** → Use case: **Lambda**.
3. Skip attaching a managed policy for now — click **Next**, name the role
   (e.g. `baby-statistic-backup-lambda-role`), and create it.
4. Open the new role → **Add permissions → Create inline policy** → JSON tab,
   paste (replace `YOUR_BUCKET_NAME`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Logs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Sid": "S3BackupAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET_NAME",
        "arn:aws:s3:::YOUR_BUCKET_NAME/*"
      ]
    }
  ]
}
```

5. Name the policy (e.g. `baby-statistic-backup-lambda-policy`) and save.

## 3. Create the Lambda Function

1. Go to **Lambda → Create function → Author from scratch**.
2. Name: e.g. `baby-statistic-backup`.
3. Runtime: **Node.js 20.x**.
4. Architecture: `x86_64` (default is fine).
5. Permissions → **Use an existing role** → select the role from step 2.
6. Create function.
7. In the function's **Code** tab, open the built-in code editor (Lambda
   gives you a browser-based VS Code-like editor). The default file is
   `index.mjs` — select all its boilerplate content, delete it, and paste in
   the contents of this repo's `backup-lambda/index.mjs` (an ES module —
   `import`/`export` — so it works natively with the `.mjs` extension).
   Click **Deploy** to save.
8. Handler should be `index.handler` (matches `export const handler` in
   the file, and matches the `index.mjs` filename Lambda creates by default).


## 4. Set Environment Variables

In the function → **Configuration → Environment variables** → add:

| Key | Value |
|---|---|
| `API_BASE_URL` | `https://your-domain.example` (your public server URL, no trailing slash) |
| `ADMIN_USERNAME` | an existing admin user's username |
| `ADMIN_PASSWORD` | that admin user's password |
| `S3_BUCKET` | the bucket name from step 1 |
| `S3_PREFIX` *(optional)* | default `backups/` |
| `RETENTION_DAYS` *(optional)* | default `14` |

Lambda encrypts environment variables at rest by default — no extra setup
needed for the admin password to be reasonably safe, but consider using a
dedicated admin account with no other purpose.

## 5. Increase Timeout (default 3s is too short)

**Configuration → General configuration → Edit** → set **Timeout** to e.g.
`30 sec` (downloading + uploading a backup should be quick, but give it
margin). Memory can stay at the default (128 MB) unless the backup is huge.

## 6. Test It

**Test** tab → create a new test event (any empty `{}` payload works, the
handler ignores its input) → **Test**. Check the **Execution results** and
**CloudWatch Logs** for the `Backup uploaded: ...` / `Backup verified ...` /
`Pruned ... ` log lines, and confirm a new object appeared in the S3 bucket
and the app shows a fresh backup-status dot.

## 7. Schedule It — every 6 hours (00:00, 06:00, 12:00, 18:00)

1. Go to **Amazon EventBridge → Scheduler → Create schedule**.
2. Name: e.g. `baby-statistic-backup-schedule`.
3. Schedule type: **Recurring schedule** → **Cron-based schedule**.
4. Cron expression (every 6 hours, UTC):
   `0 0,6,12,18 * * ? *`
5. Target: **AWS Lambda → Invoke** → select your `baby-statistic-backup`
   function.
6. Flexible time window: **Off** (or a few minutes, doesn't matter here).
7. Retry policy: leave default (or set retries to 1–2).
8. Create the schedule. EventBridge will automatically add the required
   Lambda invoke permission (`lambda:InvokeFunction`) for the scheduler.

## Cleanup (when you're done testing/using this)

Delete, in this order: the EventBridge schedule, the Lambda function, the
IAM role/policy, and finally the S3 bucket (empty it first — S3 won't
delete a non-empty bucket).

