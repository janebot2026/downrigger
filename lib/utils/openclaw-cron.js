const fs = require('fs-extra');
const path = require('path');

/**
 * Setup OpenClaw cron jobs
 * Uses OpenClaw's internal cron system (jobs.json) instead of system crontab
 * 
 * Two types of jobs:
 * - systemEvent: Lightweight, runs scripts directly (logging, observational)
 * - agentTurn: Creates agent session, can do actual work (analysis, improvements)
 */
async function setupOpenClawCron(targetDir, options = {}) {
  const { agentName = 'Jane', force = false } = options;

  const home = (process.env.HOME || '').trim();
  if (!home) {
    throw new Error('HOME is not set; cannot locate ~/.openclaw to configure cron jobs.');
  }

  const openclawDir = path.join(home, '.openclaw');
  const cronDir = path.join(openclawDir, 'cron');
  const jobsPath = path.join(cronDir, 'jobs.json');
  
  // Ensure OpenClaw directories exist
  await fs.ensureDir(cronDir);
  
  // Generate job definitions
  const jobs = generateCronJobs(targetDir, agentName);
  
  // Check if jobs.json exists
  let existingJobs = { version: 1, jobs: [] };
  if (await fs.pathExists(jobsPath)) {
    try {
      existingJobs = await fs.readJson(jobsPath);
    } catch {
      // Malformed. Never overwrite without explicit force.
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
  
  // Write jobs.json
  await fs.writeJson(jobsPath, mergedDoc, { spaces: 2 });
  
  // Also write a reference file in targetDir
  const cronRefPath = path.join(targetDir, 'openclaw-cron-jobs.json');
  await fs.writeJson(cronRefPath, jobs, { spaces: 2 });
  
  return {
    created,
    replaced,
    warnings: [
      'OpenClaw docs recommend using `openclaw cron add/edit` for changes; manual edits to ~/.openclaw/cron/jobs.json are only safe when the Gateway is stopped.'
    ],
    total: Array.isArray(mergedDoc.jobs) ? mergedDoc.jobs.length : 0,
    restartRequired: created.length > 0 || replaced.length > 0
  };
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

function generateCronJobs(targetDir, _agentName) {
  const now = Date.now();
  const agentName = (_agentName || 'Jane').trim() || 'Jane';
  
  return [
    // Weekly Synthesis - isolated agent turn (standalone)
    {
      jobId: '9a7b3a2d-7c15-4e45-9e69-4ed6d7d3750b',
      id: '9a7b3a2d-7c15-4e45-9e69-4ed6d7d3750b',
      name: 'Weekly Synthesis',
      enabled: true,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: {
        kind: 'cron',
        expr: '0 9 * * 1'
      },
      sessionTarget: 'isolated',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'agentTurn',
        message: `Agent: ${agentName}. Weekly Synthesis: Run ${targetDir}/scripts/weekly-synthesis.sh to apply memory decay and regenerate entity summaries. Use the exec tool to run the script. Only modify workspace files; do not send any external messages. Then write a short [weekly-synthesis] note into today's memory file.`
      },
      isolation: {
        postToMainPrefix: 'Cron',
        postToMainMode: 'summary',
        postToMainMaxChars: 8000
      }
    },
    
    // Daily Memory Distill - agentTurn (requires agent analysis)
    {
      jobId: '64e59bfe-8f38-4bad-8def-29449d957d34',
      id: '64e59bfe-8f38-4bad-8def-29449d957d34',
      name: 'Daily Memory Distill',
      enabled: true,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: {
        kind: 'cron',
        expr: '55 23 * * *'
      },
      sessionTarget: 'main',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'agentTurn',
        message: `Agent: ${agentName}. Daily Memory Distill: Read today's ${targetDir}/memory/YYYY-MM-DD.md. Append a structured [summary] block with: key-events, decisions, todos, promote-to-memory. Only edit the memory file; do not chat.`
      }
    },
    
    // Nightly Improvement - agentTurn (requires agent work)
    {
      jobId: 'c5e53f94-5ee8-476f-a1e6-e29160f57a7b',
      id: 'c5e53f94-5ee8-476f-a1e6-e29160f57a7b',
      name: 'Nightly Improvement',
      enabled: true,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: {
        kind: 'cron',
        expr: '15 22 * * *'
      },
      sessionTarget: 'isolated',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'agentTurn',
        message: `Agent: ${agentName}. Nightly Improvement: Read today's ${targetDir}/memory/YYYY-MM-DD.md logs. Analyze for patterns, friction, or opportunities. Implement ONE concrete improvement (fix bug, add script, improve workflow). Only local changes; no external APIs. Log with [task] id=cron/nightly-improvement. Do not chat.`
      },
      isolation: {
        postToMainPrefix: 'Cron',
        postToMainMode: 'summary',
        postToMainMaxChars: 8000
      }
    },
    
    // Cost Savings Searcher - agentTurn (requires agent analysis)
    {
      jobId: '8816f6a6-6ad8-40e2-a340-5557ad00601d',
      id: '8816f6a6-6ad8-40e2-a340-5557ad00601d',
      name: 'Cost Savings Searcher',
      enabled: true,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: {
        kind: 'cron',
        expr: '15 23 * * *'
      },
      sessionTarget: 'isolated',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'agentTurn',
        message: `Agent: ${agentName}. Cost Savings Searcher: Analyze recent ${targetDir}/memory/*.md logs and OpenClaw usage patterns for token optimization opportunities. Look for: over-verbose replies, redundant context, inefficient schedules. Propose and implement safe local changes (workspace-only). Record changes as [experiment] entries in MEMORY.md or memory logs. Log with [task] id=cron/cost-savings. Do not chat.`
      },
      isolation: {
        postToMainPrefix: 'Cron',
        postToMainMode: 'summary',
        postToMainMaxChars: 8000
      }
    },
    
    // Weekly Experiment Review - agentTurn (requires agent analysis)
    {
      jobId: 'cf2950a3-7197-49c0-91e3-847bb912e405',
      id: 'cf2950a3-7197-49c0-91e3-847bb912e405',
      name: 'Weekly Experiment Review',
      enabled: false,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: {
        kind: 'cron',
        expr: '0 9 * * 1'
      },
      sessionTarget: 'isolated',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'agentTurn',
        message: `Agent: ${agentName}. Weekly Experiment Review: Scan recent ${targetDir}/memory/*.md for [experiment] entries without [experiment-result]. For each, analyze outcome, write result block, update MEMORY.md rules where appropriate. Only edit memory files and MEMORY.md; no code changes. Write a short summary into today's memory file.`
      },
      isolation: {
        postToMainPrefix: 'Cron',
        postToMainMode: 'summary',
        postToMainMaxChars: 8000
      }
    },
    
    // Weekly Bug Sweep - agentTurn (requires agent analysis)
    {
      jobId: '51c9003f-bc7d-4ea0-8228-bc4faa7e0d6d',
      id: '51c9003f-bc7d-4ea0-8228-bc4faa7e0d6d',
      name: 'Weekly Bug Sweep',
      enabled: false,
      deleteAfterRun: false,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: {
        kind: 'cron',
        expr: '30 9 * * 1'
      },
      sessionTarget: 'isolated',
      wakeMode: 'next-heartbeat',
      payload: {
        kind: 'agentTurn',
        message: `Agent: ${agentName}. Weekly Bug Sweep: Scan recent ${targetDir}/memory/*.md for [bug] and [incident] entries. Ensure each has root cause and fix documented; update MEMORY.md rules where patterns emerge. Only edit memory/*.md and MEMORY.md; no code changes. Write a short summary into today's memory file.`
      },
      isolation: {
        postToMainPrefix: 'Cron',
        postToMainMode: 'summary',
        postToMainMaxChars: 8000
      }
    }
  ];
}

module.exports = { setupOpenClawCron, generateCronJobs, mergeCronJobs };
