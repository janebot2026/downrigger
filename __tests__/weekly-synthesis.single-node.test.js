const os = require('os');
const path = require('path');
const fs = require('fs-extra');

const { setupScripts } = require('../lib/utils/scripts');

describe('weekly-synthesis.sh generation', () => {
  test('uses a single Node invocation (no per-entity loop spawning node)', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'downrigger-scripts-'));

    try {
      await setupScripts(tmpDir, { force: true, agentName: 'Jane' });

      const scriptPath = path.join(tmpDir, 'scripts', 'weekly-synthesis.sh');
      const content = await fs.readFile(scriptPath, 'utf8');

      const nodeHeredocs = (content.match(/node\s+<<\s+'NODE_EOF'/g) || []).length;
      expect(nodeHeredocs).toBe(1);
      expect(content).not.toContain('while read -r file; do');
      expect(content).not.toContain('process.env.FILE');
    } finally {
      await fs.remove(tmpDir);
    }
  });
});
