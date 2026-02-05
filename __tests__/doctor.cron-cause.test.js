const os = require('os');
const path = require('path');
const fs = require('fs-extra');

jest.mock('child_process', () => ({
  execSync: jest.fn(() => {
    throw new Error('boom');
  })
}));

describe('doctor cron diagnostics', () => {
  test('includes cause when openclaw cron list fails and jobs.json exists', async () => {
    const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'downrigger-home-'));
    const prevHome = process.env.HOME;
    process.env.HOME = tmpHome;

    jest.resetModules();

    try {
      const cronDir = path.join(tmpHome, '.openclaw', 'cron');
      await fs.ensureDir(cronDir);
      await fs.writeFile(path.join(cronDir, 'jobs.json'), '{"version":1,"jobs":[]}');

      const { _test } = require('../lib/commands/doctor');
      const res = await _test.checkOpenClawCron();
      expect(res.status).toBe('warn');
      expect(res.message).toMatch(/Cause: boom/);
    } finally {
      process.env.HOME = prevHome;
      await fs.remove(tmpHome);
    }
  });
});
