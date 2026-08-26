/** The tabbed views of a series, in the order they appear.
 *
 *  Kept out of Tabs.tsx so that file exports only its component — a mixed
 *  module breaks fast refresh, and on Windows a lowercase tabs.ts would also
 *  collide with Tabs.tsx on a case-insensitive filesystem.
 */

export type TabId = 'run-overview' | 'daily-counts' | 'timing' | 'compare-sites' | 'statistics'

export const TABS: { id: TabId; label: string }[] = [
  { id: 'run-overview', label: 'Run Overview' },
  { id: 'daily-counts', label: 'Daily Counts' },
  { id: 'timing', label: 'Timing' },
  { id: 'compare-sites', label: 'Compare Sites' },
  { id: 'statistics', label: 'Statistics' },
]
