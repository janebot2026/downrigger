const os = require('os');
const path = require('path');
const fs = require('fs-extra');

jest.mock('ora', () => {
  return () => ({
    start: () => ({
      succeed: () => {},
      fail: () => {},
      warn: () => {}
    })
  });
});

const { initCommand } = require('../lib/commands/init');

describe('init command', () => {
  test('respects --skip-heartbeat (does not create HEARTBEAT.md)', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'janebot-cli-init-'));
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await initCommand({
        dir: tmpDir,
        dryRun: false,
        force: false,
        yes: true,
        agentName: 'Jane',
        ownerName: 'Owner',
        skipQmd: true,
        skipCron: true,
        skipGit: true,
        skipHeartbeat: true
      });

      await expect(fs.pathExists(path.join(tmpDir, 'HEARTBEAT.md'))).resolves.toBe(false);
      await expect(fs.pathExists(path.join(tmpDir, 'MEMORY.md'))).resolves.toBe(true);
    } finally {
      logSpy.mockRestore();
      await fs.remove(tmpDir);
    }
  });
});
