const fs = require('fs-extra');
const path = require('path');

/**
 * Setup OpenClaw cron jobs for trading bot
 * Uses OpenClaw's internal cron system (jobs.json)
 * 
 * Jobs are designed for "always-on trader that can explain itself":
 * - Frequent health checks (systemEvent)
 * - Periodic synthesis (agentTurn for learning/reflection)
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
    // Health Check - frequent systemEvent (lightweight)
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
        expr: '*/5 * * * *'  // Every 5 minutes
      },
      sessionTarget: 'main',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'systemEvent',
        command: `${targetDir}/scripts/health_check.sh`
      }
    },
    
    // Restart Runner - every minute (systemEvent)
    {
      jobId: 'trader-restart-runner',
      id: 'trader-restart-runner',
      name: 'Trader Restart Runner',
      enabled: true,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: {
        kind: 'cron',
        expr: '* * * * *'  // Every minute
      },
      sessionTarget: 'main',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'systemEvent',
        command: `${targetDir}/scripts/restart_runner.sh`
      }
    },
    
    // Report Wallet - weekly (systemEvent)
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
        expr: '0 0 * * 0'  // Weekly on Sunday
      },
      sessionTarget: 'main',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'systemEvent',
        command: `${targetDir}/scripts/report_wallet.sh`
      }
    },
    
    // Daily Recap Template - 11:55pm (systemEvent)
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
        expr: '55 23 * * *'  // 11:55pm daily
      },
      sessionTarget: 'main',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'systemEvent',
        command: `${targetDir}/scripts/summarize_day.sh`
      }
    },
    
    // Daily Synthesis - agentTurn (reflection and learning)
    {
      jobId: 'trader-daily-synthesis',
      id: 'trader-daily-synthesis',
      name: 'Trader Daily Synthesis',
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
        message: `Agent: ${agentName}. Daily Trading Synthesis: Read today's journal/trades/ and journal/decisions/. Analyze what worked, what didn't, what patterns emerged. Update journal/recaps/ with learnings. Review state/portfolio_snapshot.json and state/config_effective.json. Write a [synthesis] entry in knowledge/tacit/ with operational insights. Focus on: 1) What the bot learned today, 2) What changed (config/strategy/risk), 3) What it recommends tomorrow with rationale.`
      },
      isolation: {
        postToMainPrefix: 'Trader',
        postToMainMode: 'summary',
        postToMainMaxChars: 4000
      }
    },
    
    // Weekly Deep Synthesis - agentTurn (comprehensive review)
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
        message: `Agent: ${agentName}. Weekly Trading Review: Analyze full week of journal/trades/, journal/decisions/, reports/daily_pnl/, and reports/incidents/. Synthesize patterns across the week. Update knowledge/pinned/ with any new risk rules or user preferences discovered. Create knowledge/packs/strategy/ entry if new strategy insights emerged. Focus on explainability: what would you tell a human about this week's performance?`
      },
      isolation: {
        postToMainPrefix: 'Trader',
        postToMainMode: 'summary',
        postToMainMaxChars: 8000
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
