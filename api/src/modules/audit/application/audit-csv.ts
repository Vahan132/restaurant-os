import { AuditLog } from '../domain/entities/audit-log';

/** Column order for the audit-log CSV export. */
const COLUMNS = [
  'id',
  'createdAt',
  'restaurantId',
  'branchId',
  'actorType',
  'actorId',
  'actorName',
  'actorRoleCode',
  'action',
  'entityType',
  'entityId',
  'ip',
  'userAgent',
  'oldValue',
  'newValue',
] as const;

/** RFC-4180 field escaping: quote when the value contains `,`, `"`, CR or LF. */
function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCells(log: AuditLog): Record<(typeof COLUMNS)[number], unknown> {
  return {
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    restaurantId: log.restaurantId,
    branchId: log.branchId,
    actorType: log.actorType,
    actorId: log.actorId,
    actorName: log.actorName,
    actorRoleCode: log.actorRoleCode,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    ip: log.ip,
    userAgent: log.userAgent,
    oldValue: log.oldValue,
    newValue: log.newValue,
  };
}

/** Serialize audit logs to a CSV string (header row + one row per log). */
export function auditLogsToCsv(logs: AuditLog[]): string {
  const header = COLUMNS.join(',');
  const rows = logs.map((log) => {
    const cells = toCells(log);
    return COLUMNS.map((col) => escapeCsv(cells[col])).join(',');
  });
  return [header, ...rows].join('\r\n');
}
