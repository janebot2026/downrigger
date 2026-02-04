const path = require('path');

jest.mock('../lib/utils/para', () => ({
  setupParaStructure: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../lib/utils/qmd', () => ({
  installQmd: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../lib/utils/scripts', () => ({
  setupScripts: jest.fn().mockResolvedValue([])
}));

jest.mock('../lib/utils/openclaw-cron', () => ({
  setupOpenClawCron: jest.fn().mockResolvedValue({ created: [], replaced: [], warnings: [], restartRequired: false })
}));

jest.mock('../lib/utils/heartbeat', () => ({
  setupHeartbeat: jest.fn().mockResolvedValue(['HEARTBEAT.md'])
}));

const { setupParaStructure } = require('../lib/utils/para');
const { installCommand } = require('../lib/commands/install');

describe('install command', () => {
  test('resolves target dir to an absolute path', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await installCommand('pkm', { dir: 'relative/path', force: false, agentName: 'Jane' });
      expect(setupParaStructure).toHaveBeenCalledWith(path.resolve('relative/path'), { force: false });
    } finally {
      logSpy.mockRestore();
    }
  });
});
