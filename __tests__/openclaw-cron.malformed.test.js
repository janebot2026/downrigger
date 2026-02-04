const os = require('os');
const path = require('path');
const fs = require('fs-extra');

const { setupOpenClawCron } = require('../lib/utils/openclaw-cron');

describe('openclaw-cron malformed jobs.json safety', () => {
  test('does not overwrite malformed ~/.openclaw/cron/jobs.json when force=false', async () => {
    const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'janebot-cli-home-'));
    const tmpTarget = await fs.mkdtemp(path.join(os.tmpdir(), 'janebot-cli-target-'));

    const prevHome = process.env.HOME;
    process.env.HOME = tmpHome;

    try {
      const cronDir = path.join(tmpHome, '.openclaw', 'cron');
      await fs.ensureDir(cronDir);
      const jobsPath = path.join(cronDir, 'jobs.json');
      const malformed = '{"version": 1, "jobs": [}';
      await fs.writeFile(jobsPath, malformed);

      await expect(setupOpenClawCron(tmpTarget, { agentName: 'Jane', force: false })).rejects.toThrow(
        /Failed to parse OpenClaw cron file/
      );

      // Original file remains unchanged.
      await expect(fs.readFile(jobsPath, 'utf8')).resolves.toBe(malformed);

      // Backup created.
      const entries = await fs.readdir(cronDir);
      const backups = entries.filter((n) => n.startsWith('jobs.json.bak-'));
      expect(backups.length).toBe(1);
      await expect(fs.readFile(path.join(cronDir, backups[0]), 'utf8')).resolves.toBe(malformed);
    } finally {
      process.env.HOME = prevHome;
      await fs.remove(tmpHome);
      await fs.remove(tmpTarget);
    }
  });
});
