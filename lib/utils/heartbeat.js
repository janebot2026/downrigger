const fs = require('fs-extra');
const path = require('path');

async function setupHeartbeat(targetDir, options = {}) {
  const { force = false, agentName = 'Jane' } = options;

  await fs.ensureDir(targetDir);

  // OpenClaw heartbeats are configured in OpenClaw config and (by default)
  // read HEARTBEAT.md if it exists in the workspace.
  // Keep this file tiny so it doesn't bloat the heartbeat prompt.
  const heartbeatMd = `# HEARTBEAT.md

This file is read by OpenClaw during heartbeat runs (main session).

Response contract:

- If nothing needs attention, reply with \`HEARTBEAT_OK\`.
- If something needs attention, reply with the alert text (do not include HEARTBEAT_OK).

## Checklist

- Scan: anything urgent or blocked?
- If blocked: write what is missing + the next unblock step.
- If you need to notify the owner: send a concise alert.

## Notes

- Keep this file short; it becomes part of the heartbeat prompt.
- Do not put secrets (API keys, tokens) here.
- Agent: ${agentName}
`;

  const heartbeatMdPath = path.join(targetDir, 'HEARTBEAT.md');
  if (!await fs.pathExists(heartbeatMdPath) || force) {
    await fs.writeFile(heartbeatMdPath, heartbeatMd);
  }

  return ['HEARTBEAT.md'];
}

module.exports = { setupHeartbeat };
