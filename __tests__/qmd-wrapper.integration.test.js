const os = require('os');
const path = require('path');
const fs = require('fs-extra');

const { writeQmdWrapper } = require('../lib/utils/qmd');

describe('qmd wrapper (integration)', () => {
  test('writeQmdWrapper creates an executable scripts/qmd.sh referencing vendored QMD', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'janebot-cli-qmd-'));

    try {
      const wrapperPath = await writeQmdWrapper(tmpDir, { force: true });

      expect(wrapperPath).toBe(path.join(tmpDir, 'scripts', 'qmd.sh'));
      expect(await fs.pathExists(wrapperPath)).toBe(true);

      const stat = await fs.stat(wrapperPath);
      // Executable by owner/group/other
      expect(stat.mode & 0o111).toBeTruthy();

      const content = await fs.readFile(wrapperPath, 'utf8');

      // Wrapper should be relocatable (no hard-coded absolute workspace paths)
      expect(content).toContain('.tools/qmd');
      expect(content).toContain('bun run qmd');
      expect(content).toContain('QMD_INDEX=');

      expect(content).toContain('BASH_SOURCE');
      expect(content).not.toContain(tmpDir);

      // No legacy assumptions
      expect(content).not.toContain('/tmp/qmd');
      expect(content).not.toContain('/home/jane');
    } finally {
      await fs.remove(tmpDir);
    }
  });
});
