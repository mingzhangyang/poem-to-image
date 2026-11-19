export interface AuditException {
  id: string;
  packageName: string;
  range: string;
  reachability: string;
  owner: string;
  removeBy: string;
}

export interface AuditVia {
  source?: number;
  name?: string;
  title?: string;
  url?: string;
  severity?: string;
}

export interface AuditVulnerability {
  severity?: string;
  via?: Array<string | AuditVia>;
}

export interface AuditReport {
  vulnerabilities?: Record<string, AuditVulnerability>;
  metadata?: { vulnerabilities?: Record<string, number> };
  error?: unknown;
}

/**
 * `npm audit` exits non-zero whenever any advisory exists, including
 * moderate ones, so its exit status cannot tell a failed audit from a
 * completed one. A completed audit returns a report with vulnerability
 * metadata and no `error`.
 */
export function isCompletedAuditReport(report: AuditReport): boolean {
  return report.error === undefined
    && typeof report.vulnerabilities === 'object' && report.vulnerabilities !== null
    && typeof report.metadata?.vulnerabilities === 'object' && report.metadata.vulnerabilities !== null;
}

export interface BlockingFinding {
  name: string;
  severity: string;
  ids: string[];
  unknown: string[];
  expired: string[];
}

/** Dev-only audit exceptions. Production `npm audit --omit=dev` is not filtered. */
export const DEV_ONLY_AUDIT_EXCEPTIONS: readonly AuditException[] = [
  {
    id: 'GHSA-fc5q-39xc-vjpf',
    packageName: 'picomatch',
    range: '<=4.0.7',
    reachability: 'vite and vitest only; not a production dependency',
    owner: 'mingzhangyang',
    // Latest npm release is 4.0.7, which is inside the advisory range.
    // Drop this entry once a picomatch release outside the range is installed.
    removeBy: '2026-12-17',
  },
];

function ghsaId(via: AuditVia): string {
  const match = String(via.url || '').match(/GHSA-[0-9a-z-]+/i);
  return match ? match[0].toUpperCase() : `source:${via.source ?? via.title ?? 'unknown'}`;
}

function highAdvisoryIds(
  name: string,
  vulnerabilities: Record<string, AuditVulnerability>,
  seen = new Set<string>(),
): string[] {
  if (seen.has(name)) return [];
  const info = vulnerabilities[name];
  if (!info) return [`unresolved:${name}`];
  const next = new Set(seen);
  next.add(name);
  const ids: string[] = [];
  for (const via of info.via ?? []) {
    if (typeof via === 'string') {
      const nested = vulnerabilities[via];
      if (nested && (nested.severity === 'high' || nested.severity === 'critical')) {
        ids.push(...highAdvisoryIds(via, vulnerabilities, next));
      }
      continue;
    }
    if (via.severity === 'high' || via.severity === 'critical') ids.push(ghsaId(via));
  }
  return ids;
}

export function blockingFindings(report: AuditReport, options: { today?: string; exceptions?: readonly AuditException[] } = {}) {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const exceptions = options.exceptions ?? DEV_ONLY_AUDIT_EXCEPTIONS;
  const allowed = new Map(exceptions.map((entry) => [entry.id.toUpperCase(), entry]));
  const vulnerabilities = report.vulnerabilities ?? {};
  const blocking: BlockingFinding[] = [];
  const acknowledged: Array<{ name: string; severity: string; ids: string[] }> = [];

  for (const [name, info] of Object.entries(vulnerabilities)) {
    if (info.severity !== 'high' && info.severity !== 'critical') continue;
    const ids = [...new Set(highAdvisoryIds(name, vulnerabilities))];
    const causes = ids.length > 0 ? ids : [`unresolved:${name}`];
    const unknown: string[] = [];
    const expired: string[] = [];
    const accepted: string[] = [];
    for (const id of causes) {
      const exception = allowed.get(id.toUpperCase());
      if (!exception) unknown.push(id);
      else if (exception.removeBy <= today) expired.push(exception.id);
      else accepted.push(exception.id);
    }
    if (unknown.length > 0 || expired.length > 0 || accepted.length === 0) {
      blocking.push({ name, severity: info.severity ?? 'high', ids: causes, unknown, expired });
    } else {
      acknowledged.push({ name, severity: info.severity ?? 'high', ids: accepted });
    }
  }

  return { blocking, acknowledged };
}
