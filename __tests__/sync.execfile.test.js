const os = require('os');
const path = require('path');
const fs = require('fs-extra');

jest.mock('child_process', () => ({
  execFileSync: jest.fn()
}));

const { execFileSync } = require('child_process');
const { syncCommand } = require('../lib/commands/sync');

describe('sync command', () => {
  test('uses execFileSync with script paths (safe for spaces)', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'downrigger sync -'));
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const scriptsDir = path.join(tmpDir, 'scripts');
      await fs.ensureDir(scriptsDir);

      const qmd = path.join(scriptsDir, 'qmd.sh');
      const synth = path.join(scriptsDir, 'weekly-synthesis.sh');
      const sweep = path.join(scriptsDir, 'git_workspace_sweep.sh');
      await fs.writeFile(qmd, '#!/usr/bin/env bash\nexit 0\n');
      await fs.writeFile(synth, '#!/usr/bin/env bash\nexit 0\n');
      await fs.writeFile(sweep, '#!/usr/bin/env bash\nexit 0\n');

      await syncCommand({ dir: tmpDir });

      expect(execFileSync).toHaveBeenCalledWith(qmd, ['update'], expect.any(Object));
      expect(execFileSync).toHaveBeenCalledWith(synth, [], expect.any(Object));
      expect(execFileSync).toHaveBeenCalledWith(sweep, [], expect.any(Object));
    } finally {
      logSpy.mockRestore();
      await fs.remove(tmpDir);
    }
  });
});
