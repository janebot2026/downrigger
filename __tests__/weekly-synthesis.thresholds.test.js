const os = require('os');
const path = require('path');
const fs = require('fs-extra');

const { setupScripts } = require('../lib/utils/scripts');

describe('weekly-synthesis.sh tiering logic', () => {
  test('uses >= thresholds and avoids repeated getTier calls', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'downrigger-scripts-'));

    try {
      await setupScripts(tmpDir, { force: true, agentName: 'Jane' });

      const scriptPath = path.join(tmpDir, 'scripts', 'weekly-synthesis.sh');
      const content = await fs.readFile(scriptPath, 'utf8');

      expect(content).toContain('accessCount >= 10');
      expect(content).toContain('accessCount >= 5');

      // Ensure tier is computed once per fact.
      expect(content).toContain('const withTier = activeItems.map');
      expect(content).not.toContain('sorted.filter(f => getTier(f)');
    } finally {
      await fs.remove(tmpDir);
    }
  });
});
