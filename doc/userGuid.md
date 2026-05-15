# Baby Statistics — User Guide

## Overview
Baby Statistics is a simple mobile-friendly web app for tracking your baby's daily activity: sleep, milk intake, and nappy changes. Everything is logged with a timestamp and browsable by item, day, or week.

---

## Navigation
A bottom navigation bar is always visible with five sections:

| Icon | Label | Route |
|---|---|---|
| 🏠 | Home | `/` |
| 🧊 | Milk Saved | `/milk-saved` |
| 🍼 | Milk Drank | `/milk-drank` |
| 😴 | Sleep | `/sleep` |
| 💩 | Poop & Pee | `/poop-pee` |

---

## Home Page (`/`)

The Home page is your main action hub. All quick-log actions live here.

### 😴 Sleep Tracker
- A live timer shows how long the baby has been **asleep** or **awake**, counting up in real time.
- A status badge shows the current state: **Sleeping** or **Awake**.
- Tap **🌙 Start** to begin a sleep session.
- Tap **☀️ End** to stop the current sleep session.
- The timer automatically resumes on page reload if a session is active.

### 🍼 Milk — Store
Use this section to log milk that has been **expressed and stored**.

1. Enter the amount in ml in the **Amount (ml)** field.
2. Tap **🧊 Fridge** to store in the fridge (expires in 4 days automatically).
3. Tap **❄️ Freezer** to store in the freezer (expires in 6 months automatically).

> Overdue fridge/freezer records are automatically marked **EXPIRED** whenever a new entry is saved or updated.

### 🍼 Milk — Baby Drank
Use this section to log how much the baby actually drank during a feed.

1. Enter the amount in ml.
2. Tap **🧊 Fridge** if the milk came from the fridge, or **❄️ Freezer** if from the freezer.

> The app automatically deducts the consumed amount from the oldest matching stored-milk records. Records fully consumed are marked **USED**.

### 🍼 Milk — Waste
If some milk was prepared but not fully consumed (e.g., leftover in the bottle):

1. Enter the wasted amount in ml.
2. Tap **➖ Subtract waste**.

> This subtracts from the **most recent drank-milk log** only — it does not touch stored-milk stock.

### 🚽 Nappy
- Tap **Poop 💩** to log a poop event at the current time.
- Tap **Pee 💧** to log a pee event at the current time.

---

## Milk Saved Page (`/milk-saved`)

View and browse all stored milk records.

### Stats Bar
At the top, three chips always show the **current live totals**:
- 🥛 Fridge — ml currently in the fridge
- ❄️ Freezer — ml currently in the freezer
- 🧊 Total — combined ml across both

### Status Filter
Toggle which statuses are visible in the list:

| Badge | Meaning |
|---|---|
| 🥛 FRIDGE | Stored in the fridge, still valid |
| ❄️ FREEZER | Stored in the freezer, still valid |
| ✅ USED | Fully consumed |
| ⚠️ EXPIRED | Past expiry date |

Click a badge to show/hide records of that status.

### Date Range Filter
Narrow results to a specific date range using the **From** and **To** date pickers. Defaults to the last 3 months.

### View Modes
Switch between three views using the view selector:

- **Item** — flat list, newest first. Shows status, remaining/original amount, and timestamp.
- **Day** — grouped by day. Click a day row to expand it and see individual entries. Each day shows total ml.
- **Week** — grouped by calendar week. Click a week to expand into days. Each week shows total ml and average ml/day.

---

## Milk Drank Page (`/milk-drank`)

View the history of all feeding sessions.

### Date Range Filter
Defaults to the last 3 months. Change the **From** and **To** dates to narrow the period.

### Stats Bar
Shown **below** the filter — reflects the selected date range:
- 🍼 Total — total ml consumed in the period
- 📊 Avg/day — average ml per day (`total ÷ number of days that have records`)

### View Modes
Same Item / Day / Week views as Milk Saved. Each entry shows amount (ml) and time.

---

## Sleep Page (`/sleep`)
> 🌙 Coming soon — will display full sleep history, nap tracking, and night-sleep summaries.

---

## Poop & Pee Page (`/poop-pee`)
> 🚽 Coming soon — will display a full history of nappy changes.

---

## User Stories

### As a parent, I want to log when the baby falls asleep
1. Go to **Home**.
2. In the **Sleep** card, tap **🌙 Start**.
3. The badge switches to **Sleeping** and the timer counts up.

### As a parent, I want to record the end of a nap
1. Go to **Home**.
2. In the **Sleep** card, tap **☀️ End**.
3. The badge switches to **Awake** and the timer resets.

### As a parent, I want to store expressed milk
1. Go to **Home**.
2. In the **Store milk** section, type the amount (e.g. `120`).
3. Tap **🧊 Fridge** or **❄️ Freezer**.

### As a parent, I want to log a feed
1. Go to **Home**.
2. In the **Baby drank** section, type the amount (e.g. `80`).
3. Tap the source (**🧊 Fridge** or **❄️ Freezer**).
4. Stock is automatically deducted from storage.

### As a parent, I want to note that some milk was wasted
1. Go to **Home**.
2. In the **Waste** section, type the wasted amount (e.g. `10`).
3. Tap **➖ Subtract waste**.

### As a parent, I want to log a nappy change
1. Go to **Home**.
2. In the **Nappy** card, tap **Poop 💩** or **Pee 💧**.

### As a parent, I want to see how much milk is left in stock
1. Go to **Milk Saved** (`/milk-saved`).
2. The stats bar at the top shows current fridge and freezer totals.

### As a parent, I want to review this week's feeding history
1. Go to **Milk Drank** (`/milk-drank`).
2. Switch the view to **Week**.
3. Click the current week row to expand it.

### As a parent, I want to see expired milk entries
1. Go to **Milk Saved**.
2. Make sure the **⚠️ EXPIRED** filter button is active.
3. Expired records appear in the list with their original and remaining amounts.

