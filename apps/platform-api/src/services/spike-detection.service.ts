// ---------------------------------------------------------------------------
// SpikeDetectionService — Daily check for anomalous AI usage spikes
// Business Rule BR-PLT-011: daily > 3x rolling 7-day average = spike
// Source: E13b-4 Task 2.4
//
// TODO: Wire as a BullMQ recurring daily job (AC#4 requirement).
// Platform-api currently has no BullMQ infrastructure. Once added,
// register a daily repeatable job that calls detectSpikes().
// Until then, spike detection is triggered manually via
// POST /admin/ai/spike-detection.
// ---------------------------------------------------------------------------

import { Prisma } from '../../generated/platform-prisma/client.js';
import type { PlatformPrismaClient } from '../client.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpikeDetectionResult {
  tenantsChecked: number;
  spikesDetected: number;
  alertsCreated: number;
}

interface TenantDailyUsage {
  tenant_id: string;
  daily_tokens: bigint;
  rolling_avg_tokens: number;
}

interface Logger {
  info: (obj: Record<string, unknown>, msg: string) => void;
  warn: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SpikeDetectionService {
  constructor(
    private readonly prisma: PlatformPrismaClient,
    private readonly logger: Logger,
  ) {}

  /**
   * Run spike detection for a given date (defaults to yesterday).
   *
   * For each tenant, compares the target day's total usage against
   * the rolling 7-day average (excluding the target day). If the
   * daily usage exceeds 3x the average, a USAGE_SPIKE alert is created.
   */
  async detectSpikes(targetDate?: Date): Promise<SpikeDetectionResult> {
    const checkDate = targetDate ?? new Date(Date.now() - 86_400_000); // yesterday
    const dateStr = checkDate.toISOString().slice(0, 10);

    this.logger.info({ date: dateStr }, 'spike-detection: starting daily check');

    // Query: for each tenant, get their usage on the target date and
    // their rolling 7-day average (7 days before the target date)
    const rows = await this.prisma.$queryRaw<TenantDailyUsage[]>(
      Prisma.sql`WITH daily AS (
          SELECT tenant_id,
                 SUM(total_tokens)::bigint AS daily_tokens
            FROM tenant_ai_usage
           WHERE DATE(timestamp AT TIME ZONE 'UTC') = ${dateStr}::date
           GROUP BY tenant_id
       ),
       rolling AS (
          SELECT tenant_id,
                 COALESCE(AVG(day_tokens), 0) AS rolling_avg_tokens
            FROM (
                SELECT tenant_id,
                       DATE(timestamp AT TIME ZONE 'UTC') AS day,
                       SUM(total_tokens) AS day_tokens
                  FROM tenant_ai_usage
                 WHERE DATE(timestamp AT TIME ZONE 'UTC') >= (${dateStr}::date - INTERVAL '7 days')
                   AND DATE(timestamp AT TIME ZONE 'UTC') < ${dateStr}::date
                 GROUP BY tenant_id, day
            ) sub
           GROUP BY tenant_id
       )
       SELECT d.tenant_id,
              d.daily_tokens,
              COALESCE(r.rolling_avg_tokens, 0)::float AS rolling_avg_tokens
         FROM daily d
         LEFT JOIN rolling r ON r.tenant_id = d.tenant_id
        WHERE d.daily_tokens > 0`,
    );

    let spikesDetected = 0;
    let alertsCreated = 0;

    const SPIKE_MULTIPLIER = 3;

    for (const row of rows) {
      const dailyTokens = Number(row.daily_tokens);
      const rollingAvg = row.rolling_avg_tokens;

      // Skip if no historical data (rolling average is 0 — can't detect spikes)
      if (rollingAvg <= 0) continue;

      if (dailyTokens > SPIKE_MULTIPLIER * rollingAvg) {
        spikesDetected++;

        // Check if a USAGE_SPIKE alert already exists for this tenant.
        // Widen the window by +1 day so that alerts created on day N+1
        // (when the job runs for day N) are found on re-runs.
        const dedupEnd = new Date(dateStr + 'T00:00:00.000Z');
        dedupEnd.setUTCDate(dedupEnd.getUTCDate() + 2);
        const existing = await this.prisma.platformAiAlert.findFirst({
          where: {
            tenantId: row.tenant_id,
            type: 'USAGE_SPIKE',
            createdAt: {
              gte: new Date(dateStr + 'T00:00:00.000Z'),
              lt: dedupEnd,
            },
          },
        });

        if (!existing) {
          const pct = Math.round((dailyTokens / rollingAvg) * 100);
          await this.prisma.platformAiAlert.create({
            data: {
              type: 'USAGE_SPIKE',
              tenantId: row.tenant_id,
              message: `Daily AI usage (${dailyTokens.toLocaleString('en-GB')} tokens) is ${Math.round(dailyTokens / rollingAvg)}x the 7-day rolling average (${Math.round(rollingAvg).toLocaleString('en-GB')} tokens)`,
              usagePct: pct,
              threshold: SPIKE_MULTIPLIER * 100,
              dailyTokens: BigInt(dailyTokens),
              rollingAvgTokens: BigInt(Math.round(rollingAvg)),
            },
          });
          alertsCreated++;

          this.logger.warn(
            {
              tenantId: row.tenant_id,
              dailyTokens,
              rollingAvg: Math.round(rollingAvg),
              multiplier: Math.round(dailyTokens / rollingAvg),
            },
            'tenant.usage_spike: daily usage exceeds 3x rolling average',
          );
        }
      }
    }

    this.logger.info(
      { date: dateStr, tenantsChecked: rows.length, spikesDetected, alertsCreated },
      'spike-detection: completed',
    );

    return {
      tenantsChecked: rows.length,
      spikesDetected,
      alertsCreated,
    };
  }
}
