# Deployment

## Prerequisites
- [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) installed and running

---

## First deploy

**On your dev machine:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\create-deploy-zip.ps1
```
Copy the generated `baby-statistic-deploy.zip` to the target PC and extract it.

**On the target PC** (in the extracted folder):
```bat
scripts\deploy.bat
```
App is now running at **http://localhost**.

---

## Daily backup

Run once as Administrator to fetch a backup and register the daily 00:05 scheduled task:
```bat
scripts\backup.bat
```
Backups are saved to `backups\backup-YYYY-MM-DD.json`.

---

## Updating the app

**On your dev machine:**
```powershell
npm run build:local
powershell -ExecutionPolicy Bypass -File scripts\create-update-zip.ps1
```
Copy the generated `baby-statistic-update.zip` to the target PC and extract it anywhere.

**On the target PC** (extract the zip, then run):
```bat
scripts\update-dist.bat
```
Injects the new `dist/` into the running container — no full Docker rebuild needed.

