import type { IDailyMeasures } from '../stats/stats-database'

/** Bounded daily counts, without repository, model or error metadata. */
export type AssistedCommitMeasure = Extract<
  keyof IDailyMeasures,
  | `copilotAssistedCommit${string}`
  | `commitMode${string}`
  | 'manualCommitWorkflowCount'
>

/** The existing daily stats owner supplies persistence. */
export type AssistedCommitMetricRecorder = (
  measure: AssistedCommitMeasure,
  count?: number
) => Promise<void>

/** Usage failures must never change commit, cancellation or recovery behavior. */
export async function recordAssistedCommitMetric(
  record: AssistedCommitMetricRecorder | undefined,
  measure: AssistedCommitMeasure,
  count = 1
): Promise<void> {
  try {
    await record?.(measure, count)
  } catch (error) {
    log.error('Could not record assisted commit usage statistics', error)
  }
}
