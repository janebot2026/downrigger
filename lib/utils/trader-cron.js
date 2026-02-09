const fs = require('fs-extra');
const path = require('path');

/**
 * Setup OpenClaw cron jobs for trading bot
 * Uses OpenClaw's internal cron system (jobs.json)
 * 
 * Minimal trader set (5 jobs max):
 * 1. Health check (every 2-5 min)
 * 2. Reconcile backup (every 5 min)
 * 3. Report wallet (on boot + daily)
 * 4. Daily recap (11:55pm)
 * 5. Weekly synthesis (Monday 9am)
 */
async function setupTraderCron(targetDir, options = {}) {
  const { agentName = 'Jane', force = false } = options;

  const home = (process.env.HOME || '').trim();
  if (!home) {
    throw new Error('HOME is not set; cannot locate ~/.openclaw to configure cron jobs.');
  }

  const openclawDir = path.join(home, '.openclaw');
  const cronDir = path.join(openclawDir, 'cron');
  const jobsPath = path.join(cronDir, 'jobs.json');
  
  await fs.ensureDir(cronDir);
  
  const jobs = generateTraderCronJobs(targetDir, agentName);
  
  let existingJobs = { version: 1, jobs: [] };
  if (await fs.pathExists(jobsPath)) {
    try {
      existingJobs = await fs.readJson(jobsPath);
    } catch {
      if (!force) {
        const backupPath = `${jobsPath}.bak-${Date.now()}`;
        await fs.copy(jobsPath, backupPath);
        throw new Error(
          `Failed to parse OpenClaw cron file: ${jobsPath}. Backed up to: ${backupPath}. ` +
          'Fix the JSON and re-run, or re-run with --force to overwrite.'
        );
      }
    }
  }

  const { mergedDoc, created, replaced } = mergeCronJobs(existingJobs, jobs, { force });
  
  await fs.writeJson(jobsPath, mergedDoc, { spaces: 2 });
  
  const cronRefPath = path.join(targetDir, 'openclaw-cron-jobs.json');
  await fs.writeJson(cronRefPath, jobs, { spaces: 2 });
  
  return {
    created,
    replaced,
    total: Array.isArray(mergedDoc.jobs) ? mergedDoc.jobs.length : 0,
    restartRequired: created.length > 0 || replaced.length > 0
  };
}

function generateTraderCronJobs(targetDir, _agentName) {
  const now = Date.now();
  const agentName = (_agentName || 'Jane').trim() || 'Jane';
  
  return [
    // 1. Health Check - every 3 minutes (verify runner, claw-trader, disk, time)
    // FIXED: Use text instead of command for systemEvent
    {
      jobId: 'trader-health-check',
      id: 'trader-health-check',
      name: 'Trader Health Check',
      enabled: true,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: {
        kind: 'cron',
        expr: '*/3 * * * *'  // Every 3 minutes
      },
      sessionTarget: 'main',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'systemEvent',
        text: `Run ${targetDir}/scripts/health_check.sh to verify bot-runner process, claw-trader availability, disk space, and NTP sync. Log results to state files.`
      }
    },
    
    // 2. Reconcile Backup - every 5 minutes (runner is primary, this is backup)
    // FIXED: Use text instead of command for systemEvent
    {
      jobId: 'trader-reconcile-backup',
      id: 'trader-reconcile-backup',
      name: 'Trader Reconcile Backup',
      enabled: true,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: {
        kind: 'cron',
        expr: '*/5 * * * *'  // Every 5 minutes
      },
      sessionTarget: 'main',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'systemEvent',
        text: `Run ${targetDir}/scripts/reconcile_now.sh as backup to bot-runner's primary reconciliation. Only proceeds if bot-runner hasn't reconciled recently.`
      }
    },
    
    // 3. Report Wallet - daily (was weekly, now daily per requirements)
    // Note: On-boot execution is handled by systemd/cloud-init, not cron
    // FIXED: Use text instead of command for systemEvent
    {
      jobId: 'trader-report-wallet',
      id: 'trader-report-wallet',
      name: 'Trader Report Wallet',
      enabled: true,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: {
        kind: 'cron',
        expr: '0 6 * * *'  // Daily at 6am (after boot settles)
      },
      sessionTarget: 'main',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'systemEvent',
        text: `Run ${targetDir}/scripts/report_wallet.sh to get wallet address from claw-trader and report to control plane if configured.`
      }
    },
    
    // 4. Daily Recap - midnight (agentTurn for synthesis work)
    {
      jobId: 'trader-daily-recap',
      id: 'trader-daily-recap',
      name: 'Trader Daily Recap',
      enabled: true,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: {
        kind: 'cron',
        expr: '0 0 * * *'  // Midnight daily
      },
      sessionTarget: 'isolated',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'agentTurn',
        message: `Agent: ${agentName}. Daily Recap Synthesis: Read journal/trades/ and journal/decisions/ for today. Write journal/recaps/YYYY-MM-DD.md with: 1) What happened (trades, blocks, errors), 2) What worked/didn't, 3) Top 3 learnings, 4) 1-3 suggested tweaks (small + reversible). Run ${targetDir}/scripts/daily_recap.sh first to create template if needed. Write any suggestions to suggestions/pending.json for human approval. Only edit journal files and suggestions/pending.json.`,
        channel: 'last'
      },
      isolation: {
        postToMainPrefix: 'Trader',
        postToMainMode: 'summary',
        postToMainMaxChars: 4000
      }
    },
    
    // 5. Weekly Synthesis - Monday 9am (light)
    {
      jobId: 'trader-weekly-synthesis',
      id: 'trader-weekly-synthesis',
      name: 'Trader Weekly Synthesis',
      enabled: true,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: {
        kind: 'cron',
        expr: '0 9 * * 1'  // Monday 9am
      },
      sessionTarget: 'isolated',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'agentTurn',
        message: `Agent: ${agentName}. Weekly Synthesis (light): Read all daily recaps from last week. Write journal/recaps/WEEK-YYYY-WW.md with: 1) What changed in behavior across the week, 2) Which market conditions hurt/helped, 3) Confirmed rules to pin, 4) Rules to delete. Update knowledge/tacit/ with confirmed patterns. Keep it short and focused. Run ${targetDir}/scripts/weekly_synthesis.sh first to create template if needed. Only edit journal and knowledge/tacit/ files.`,
        channel: 'last'
      },
      isolation: {
        postToMainPrefix: 'Trader',
        postToMainMode: 'summary',
        postToMainMaxChars: 4000
      }
    }
  ];
}

function mergeCronJobs(existingDoc, desiredJobs, options = {}) {
  const { force = false } = options;

  const existingJobs = Array.isArray(existingDoc?.jobs) ? existingDoc.jobs : [];
  const version = typeof existingDoc?.version === 'number' ? existingDoc.version : 1;

  const desiredById = new Map((desiredJobs || []).map(j => [getJobKey(j), j]));
  const consumedDesiredIds = new Set();
  const created = [];
  const replaced = [];

  const merged = [];

  for (const job of existingJobs) {
    const key = getJobKey(job);
    if (!job || typeof key !== 'string') {
      merged.push(job);
      continue;
    }

    const desired = desiredById.get(key);
    if (!desired) {
      merged.push(job);
      continue;
    }

    consumedDesiredIds.add(key);
    if (force) {
      merged.push(normalizeJobIds(desired));
      replaced.push(desired.name || key);
    } else {
      merged.push(job);
    }
  }

  for (const desired of desiredJobs || []) {
    const key = getJobKey(desired);
    if (!desired || typeof key !== 'string') continue;
    if (consumedDesiredIds.has(key)) continue;
    merged.push(normalizeJobIds(desired));
    created.push(desired.name || key);
  }

  return {
    mergedDoc: { version, jobs: merged },
    created,
    replaced
  };
}

function getJobKey(job) {
  if (!job) return null;
  if (typeof job.jobId === 'string') return job.jobId;
  if (typeof job.id === 'string') return job.id;
  return null;
}

function normalizeJobIds(job) {
  const key = getJobKey(job);
  if (!key) return job;
  return { ...job, jobId: key, id: key };
}

module.exports = { setupTraderCron, generateTraderCronJobs, mergeCronJobs };
