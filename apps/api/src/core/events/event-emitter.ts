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

/* eslint-disable @typescript-eslint/naming-convention -- domain event names use dotted notation */
export interface AppEventMap {
  'user.login': UserLoginEvent;
  'user.mfa.setup': MfaSetupEvent;
  'user.mfa.enabled': MfaEnabledEvent;
  'user.mfa.reset': MfaResetEvent;
}
/* eslint-enable @typescript-eslint/naming-convention */

// ---------------------------------------------------------------------------
// Typed EventEmitter wrapper
// ---------------------------------------------------------------------------

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

// Singleton instance — placeholder until E3 event bus
export const appEvents = new TypedEventEmitter();
