const path = require('path');

function getHomeDir() {
  const home = (process.env.HOME || '').trim();
  return home || null;
}

function getOpenClawCronJobsPath() {
  const home = getHomeDir();
  if (!home) return null;
  return path.join(home, '.openclaw', 'cron', 'jobs.json');
}

module.exports = {
  getHomeDir,
  getOpenClawCronJobsPath
};
