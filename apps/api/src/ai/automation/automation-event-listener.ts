// ---------------------------------------------------------------------------
// AutomationEventListener — Event bus subscriber for event-triggered automations
// E5c-1 Task 7: AC #3 (Event-triggered automation execution)
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { EventBus } from '../../core/events/event-bus.js';
import type { BusinessEvents, EventHandler } from '../../core/events/event-bus.types.js';
import type { AutomationExecutor } from './automation-executor.js';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Tracks a registered listener for cleanup */
interface RegisteredListener {
  automationId: string;
  eventType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic handler reference for off()
  handler: EventHandler<any>;
}

// ─── AutomationEventListener ────────────────────────────────────────────────

export class AutomationEventListener {
  /** Map of automationId → registered listener info (for unsubscription) */
  private listeners = new Map<string, RegisteredListener>();
  private started = false;

  constructor(
    private readonly db: PrismaClient,
    private readonly automationExecutor: AutomationExecutor,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
  ) {}

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  /**
   * Start the event listener: load all active EVENT-triggered automations
   * and subscribe to their configured event types on the event bus.
   */
  async start(): Promise<void> {
    if (this.started) {
      this.logger.warn('AutomationEventListener: already started');
      return;
    }

    await this.refreshListeners();

    this.started = true;
    this.logger.info('AutomationEventListener: started');
  }

  /**
   * Stop the event listener: unsubscribe all registered handlers.
   */
  stop(): void {
    if (!this.started) return;

    for (const [automationId, listener] of this.listeners) {
      this.eventBus.off(listener.eventType as keyof BusinessEvents, listener.handler);
      this.logger.debug(
        { automationId, eventType: listener.eventType },
        'AutomationEventListener: unsubscribed',
      );
    }

    this.listeners.clear();
    this.started = false;
    this.logger.info('AutomationEventListener: stopped');
  }

  // ─── Listener Management ──────────────────────────────────────────────

  /**
   * Reload all event listeners from the database: unsubscribe existing,
   * then re-subscribe active EVENT automations.
   */
  async refreshListeners(): Promise<void> {
    // Unsubscribe all existing listeners
    for (const [, listener] of this.listeners) {
      this.eventBus.off(listener.eventType as keyof BusinessEvents, listener.handler);
    }
    this.listeners.clear();

    // Load all active EVENT-triggered automations
    const automations = await this.db.aiAutomation.findMany({
      where: {
        triggerType: 'EVENT',
        isActive: true,
      },
      select: {
        id: true,
        companyId: true,
        eventType: true,
      },
    });

    let registered = 0;
    for (const automation of automations) {
      if (!automation.eventType) {
        this.logger.warn(
          { automationId: automation.id },
          'AutomationEventListener: EVENT automation missing eventType — skipping',
        );
        continue;
      }

      this.subscribe(automation.id, automation.eventType);
      registered++;
    }

    this.logger.info(
      { totalEventAutomations: automations.length, registered },
      'AutomationEventListener: listeners refreshed',
    );
  }

  /**
   * Subscribe to a specific event for an automation.
   * Called when a new EVENT automation is created or reactivated.
   */
  subscribe(automationId: string, eventType: string): void {
    // Don't double-subscribe
    if (this.listeners.has(automationId)) {
      this.unsubscribe(automationId);
    }

    const handler: EventHandler<keyof BusinessEvents> = (data) => {
      this.logger.info(
        { automationId, eventType },
        'AutomationEventListener: event received — triggering automation',
      );

      // Fire-and-forget: execute asynchronously, don't block the event bus
      this.automationExecutor
        .execute({
          automationId,
          input: data as Record<string, unknown>,
          triggeredBy: 'event',
        })
        .catch((err) => {
          this.logger.error(
            { automationId, eventType, error: (err as Error).message },
            'AutomationEventListener: automation execution failed',
          );
        });
    };

    this.eventBus.on(eventType as keyof BusinessEvents, handler);

    this.listeners.set(automationId, {
      automationId,
      eventType,
      handler,
    });

    this.logger.debug({ automationId, eventType }, 'AutomationEventListener: subscribed');
  }

  /**
   * Unsubscribe an automation from its event.
   * Called when an EVENT automation is deactivated or deleted.
   */
  unsubscribe(automationId: string): void {
    const listener = this.listeners.get(automationId);
    if (!listener) return;

    this.eventBus.off(listener.eventType as keyof BusinessEvents, listener.handler);
    this.listeners.delete(automationId);

    this.logger.debug(
      { automationId, eventType: listener.eventType },
      'AutomationEventListener: unsubscribed',
    );
  }

  /**
   * Update the event subscription for an automation.
   * Called when an automation's eventType changes.
   * Unsubscribes from the old event, subscribes to the new one.
   */
  updateSubscription(automationId: string, newEventType: string): void {
    this.unsubscribe(automationId);
    this.subscribe(automationId, newEventType);

    this.logger.debug(
      { automationId, newEventType },
      'AutomationEventListener: subscription updated',
    );
  }

  /**
   * Check if an automation currently has an active listener registered.
   */
  hasListener(automationId: string): boolean {
    return this.listeners.has(automationId);
  }

  /**
   * Get the count of currently registered listeners.
   */
  get listenerCount(): number {
    return this.listeners.size;
  }
}
