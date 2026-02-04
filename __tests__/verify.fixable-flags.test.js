const os = require('os');
const path = require('path');
const fs = require('fs-extra');

describe('verify --fix UX', () => {
  test('core file issues are not marked fixable without an implementation', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'janebot-cli-verify-core-'));

    try {
      const { _test } = require('../lib/commands/verify');
      const result = await _test.checkCoreFiles(tmpDir);
      expect(result.ok).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      for (const issue of result.issues) {
        expect(issue.fixable).toBe(false);
        expect(issue.fix).toBeUndefined();
      }
    } finally {
      await fs.remove(tmpDir);
    }
  });

  test('script issues are not marked fixable without an implementation', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'janebot-cli-verify-scripts-'));

    try {
      const { _test } = require('../lib/commands/verify');
      const result = await _test.checkScripts(tmpDir);
      expect(result.ok).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      for (const issue of result.issues) {
        expect(issue.fixable).toBe(false);
        expect(issue.fix).toBeUndefined();
      }
    } finally {
      await fs.remove(tmpDir);
    }
  });
});
