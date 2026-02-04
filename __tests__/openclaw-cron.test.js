const { mergeCronJobs, generateCronJobs } = require('../lib/utils/openclaw-cron');

describe('openclaw-cron', () => {
  test('mergeCronJobs preserves existing unmanaged jobs and does not delete managed jobs on re-run', () => {
    const existing = {
      version: 1,
      jobs: [
        { id: 'unmanaged-1', name: 'User Job', enabled: true },
        { jobId: 'managed-1', name: 'Managed Job (old)', enabled: false }
      ]
    };

    const desired = [{ jobId: 'managed-1', name: 'Managed Job (new)', enabled: true }];

    const { mergedDoc, created, replaced } = mergeCronJobs(existing, desired, { force: false });

    expect(mergedDoc.jobs).toHaveLength(2);
    expect(mergedDoc.jobs[0]).toEqual(existing.jobs[0]);
    // Without force, keep the existing managed job definition
    expect(mergedDoc.jobs[1]).toEqual(existing.jobs[1]);
    expect(created).toEqual([]);
    expect(replaced).toEqual([]);
  });

  test('mergeCronJobs replaces managed jobs when force=true', () => {
    const existing = {
      version: 1,
      jobs: [{ jobId: 'managed-1', name: 'Managed Job (old)', enabled: false }]
    };
    const desired = [{ jobId: 'managed-1', name: 'Managed Job (new)', enabled: true }];

    const { mergedDoc, created, replaced } = mergeCronJobs(existing, desired, { force: true });
    expect(mergedDoc.jobs).toHaveLength(1);
    expect(mergedDoc.jobs[0]).toEqual({ ...desired[0], id: 'managed-1' });
    expect(created).toEqual([]);
    expect(replaced).toEqual(['Managed Job (new)']);
  });

  test('mergeCronJobs appends missing desired jobs and reports created', () => {
    const existing = { version: 1, jobs: [{ id: 'unmanaged-1', name: 'User Job' }] };
    const desired = [
      { jobId: 'managed-1', name: 'Managed One' },
      { jobId: 'managed-2', name: 'Managed Two' }
    ];

    const { mergedDoc, created, replaced } = mergeCronJobs(existing, desired, { force: false });
    expect(mergedDoc.jobs.map(j => j.jobId || j.id)).toEqual(['unmanaged-1', 'managed-1', 'managed-2']);
    expect(created).toEqual(['Managed One', 'Managed Two']);
    expect(replaced).toEqual([]);
  });

  test('generateCronJobs uses stable IDs (no random UUIDs)', () => {
    const jobs = generateCronJobs('/tmp/clawd', 'Jane');
    const weekly = jobs.find(j => j.name === 'Weekly Synthesis');
    expect(weekly).toBeTruthy();
    expect(weekly.jobId).toBe('9a7b3a2d-7c15-4e45-9e69-4ed6d7d3750b');
    expect(weekly.payload.message).toContain('Agent: Jane.');
  });

  test('generateCronJobs no longer includes very frequent systemEvent monitors', () => {
    const jobs = generateCronJobs('/tmp/clawd', 'Jane');
    const names = jobs.map(j => j.name);
    expect(names).not.toContain('Time Sync');
    expect(names).not.toContain('Env Snapshot');
    expect(names).not.toContain('Models & Cron Check');
  });
});
