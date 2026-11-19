import { spawnSync } from 'node:child_process';
import { blockingFindings, DEV_ONLY_AUDIT_EXCEPTIONS, isCompletedAuditReport } from './audit-full-policy.ts';

const result = spawnSync('npm', ['audit', '--json'], {
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout || '{}');
} catch {
  console.error(result.stderr || result.stdout);
  console.error('npm audit did not return JSON');
  process.exit(result.status || 1);
}

if (!isCompletedAuditReport(report)) {
  console.error(result.stderr || JSON.stringify(report.error ?? report));
  console.error('npm audit did not complete');
  process.exit(result.status || 1);
}

const { blocking, acknowledged } = blockingFindings(report);

if (acknowledged.length > 0) {
  console.log('Accepted dev-only high advisories:');
  for (const entry of DEV_ONLY_AUDIT_EXCEPTIONS) {
    console.log(`- ${entry.id} (${entry.packageName} ${entry.range})`);
    console.log(`  ${entry.reachability}`);
    console.log(`  owner ${entry.owner}; remove by ${entry.removeBy}`);
  }
  console.log(`Acknowledged ${acknowledged.length} high/critical package nodes caused only by those advisories.`);
}

if (blocking.length > 0) {
  console.error('Blocking high or critical audit findings:');
  for (const finding of blocking) {
    console.error(`- ${finding.name} [${finding.severity}] ${finding.ids.join(', ')}`);
  }
  process.exit(1);
}

const counts = report.metadata.vulnerabilities;
console.log(`No blocking high or critical findings (moderate: ${counts.moderate ?? 0}, low: ${counts.low ?? 0}).`);
