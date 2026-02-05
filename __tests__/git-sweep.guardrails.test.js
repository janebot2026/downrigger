const os = require('os');
const path = require('path');
const fs = require('fs-extra');

const { setupScripts } = require('../lib/utils/scripts');

describe('git_workspace_sweep.sh generation', () => {
  test('includes guardrails for autocommit and quotes repo paths', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'downrigger-scripts-'));

    try {
      await setupScripts(tmpDir, { force: true, agentName: 'Jane' });

      const scriptPath = path.join(tmpDir, 'scripts', 'git_workspace_sweep.sh');
      const content = await fs.readFile(scriptPath, 'utf8');

      expect(content).toContain('is_secret_path()');
      expect(content).toContain('git status --porcelain -z');
      expect(content).toContain('autocommit skipped (potential secret file');
      expect(content).toContain('repo_name="$(basename "$repo_path")"');
    } finally {
      await fs.remove(tmpDir);
    }
  });
});
