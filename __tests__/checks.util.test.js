describe('checks utils', () => {
  test('getOpenClawCronJobsPath returns null when HOME missing', () => {
    const prevHome = process.env.HOME;
    delete process.env.HOME;

    jest.resetModules();
    const { getOpenClawCronJobsPath } = require('../lib/utils/checks');

    try {
      expect(getOpenClawCronJobsPath()).toBeNull();
    } finally {
      process.env.HOME = prevHome;
    }
  });
});
