describe('HOME validation', () => {
  test('verify checkOpenClawCron reports missing HOME', async () => {
    const prevHome = process.env.HOME;
    delete process.env.HOME;

    jest.resetModules();
    const { _test } = require('../lib/commands/verify');

    try {
      const result = await _test.checkOpenClawCron();
      expect(result.ok).toBe(false);
      expect(result.issues[0].message).toMatch(/HOME is not set/i);
    } finally {
      process.env.HOME = prevHome;
    }
  });

  test('doctor checkOpenClawCron warns when HOME missing', async () => {
    const prevHome = process.env.HOME;
    delete process.env.HOME;

    jest.resetModules();
    const { _test } = require('../lib/commands/doctor');

    try {
      const result = await _test.checkOpenClawCron();
      expect(result.status).toBe('warn');
      expect(result.message).toMatch(/HOME is not set/i);
    } finally {
      process.env.HOME = prevHome;
    }
  });
});
