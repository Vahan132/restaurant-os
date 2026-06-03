import { AuditActorType } from '../enums';

export interface AuditLogProps {
  organizationId: string | null;
  restaurantId: string | null;
  actorType: AuditActorType;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown | null;
  newValue: unknown | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface CreateAuditLogInput {
  id: string;
  organizationId?: string | null;
  restaurantId?: string | null;
  actorType: AuditActorType;
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown | null;
  newValue?: unknown | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** AuditLog — append-only, immutable record of an audited action. No mutators. */
export class AuditLog {
  private constructor(
    private readonly _id: string,
    private readonly props: AuditLogProps,
  ) {}

  static create(input: CreateAuditLogInput): AuditLog {
    return new AuditLog(input.id, {
      organizationId: input.organizationId ?? null,
      restaurantId: input.restaurantId ?? null,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: new Date(),
    });
  }

  static reconstitute(id: string, props: AuditLogProps): AuditLog {
    return new AuditLog(id, props);
  }

  get id(): string {
    return this._id;
  }
  get organizationId(): string | null {
    return this.props.organizationId;
  }
  get restaurantId(): string | null {
    return this.props.restaurantId;
  }
  get actorType(): AuditActorType {
    return this.props.actorType;
  }
  get actorId(): string | null {
    return this.props.actorId;
  }
  get actorName(): string | null {
    return this.props.actorName;
  }
  get action(): string {
    return this.props.action;
  }
  get entityType(): string {
    return this.props.entityType;
  }
  get entityId(): string {
    return this.props.entityId;
  }
  get oldValue(): unknown | null {
    return this.props.oldValue;
  }
  get newValue(): unknown | null {
    return this.props.newValue;
  }
  get ip(): string | null {
    return this.props.ip;
  }
  get userAgent(): string | null {
    return this.props.userAgent;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
