import { EventEmitter } from 'node:events';

// ---------------------------------------------------------------------------
// Event payload types (extend as events are added)
// ---------------------------------------------------------------------------

export interface UserLoginEvent {
  userId: string;
  loginMethod: string;
  ipAddress?: string;
}

export interface MfaSetupEvent {
  userId: string;
}

export interface MfaEnabledEvent {
  userId: string;
}

export interface MfaResetEvent {
  targetUserId: string;
  resetByUserId: string;
}

export interface AccessGroupCreatedEvent {
  groupId: string;
  companyId: string;
  code: string;
  name: string;
  createdBy: string;
}

export interface AccessGroupUpdatedEvent {
  groupId: string;
  companyId: string;
  changedBy: string;
}

export interface AccessGroupDeletedEvent {
  groupId: string;
  companyId: string;
  deletedBy: string;
}

export interface UserAccessGroupsAssignedEvent {
  userId: string;
  companyId: string;
  groupIds: string[];
  assignedBy: string;
}

/* eslint-disable @typescript-eslint/naming-convention -- domain event names use dotted notation */
export interface AppEventMap {
  'user.login': UserLoginEvent;
  'user.mfa.setup': MfaSetupEvent;
  'user.mfa.enabled': MfaEnabledEvent;
  'user.mfa.reset': MfaResetEvent;
  'accessGroup.created': AccessGroupCreatedEvent;
  'accessGroup.updated': AccessGroupUpdatedEvent;
  'accessGroup.deleted': AccessGroupDeletedEvent;
  'user.accessGroups.assigned': UserAccessGroupsAssignedEvent;
}
/* eslint-enable @typescript-eslint/naming-convention */

// ---------------------------------------------------------------------------
// Typed EventEmitter wrapper
// ---------------------------------------------------------------------------

/** @deprecated Use EventBus from event-bus.ts instead */
class TypedEventEmitter {
  private emitter = new EventEmitter();

  emit<K extends keyof AppEventMap>(event: K, payload: AppEventMap[K]): boolean {
    return this.emitter.emit(event, payload);
  }

  on<K extends keyof AppEventMap>(event: K, listener: (payload: AppEventMap[K]) => void): this {
    this.emitter.on(event, listener);
    return this;
  }

  off<K extends keyof AppEventMap>(event: K, listener: (payload: AppEventMap[K]) => void): this {
    this.emitter.off(event, listener);
    return this;
  }

  once<K extends keyof AppEventMap>(event: K, listener: (payload: AppEventMap[K]) => void): this {
    this.emitter.once(event, listener);
    return this;
  }

  removeAllListeners(event?: keyof AppEventMap): this {
    this.emitter.removeAllListeners(event);
    return this;
  }
}

/** @deprecated Use EventBus from event-bus.ts instead. Will be removed after all usages are confirmed migrated. */
// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional: retained for migration safety
export const appEvents = new TypedEventEmitter();
