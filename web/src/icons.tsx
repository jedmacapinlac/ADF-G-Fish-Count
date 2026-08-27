type IconProps = {
  className?: string
}

/** Shared stroke styling so every stat-card icon reads as one family. Color
 *  comes from `currentColor` — set it via the className's text-* utility at
 *  the call site, same as the rest of this app's icon-less styling. */
function IconBase({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

/** Dropdown affordance for a styled <select> — the native arrow is hidden via
 *  appearance-none, so every select needs one of these drawn back in. */
export function ChevronDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 9l6 6 6-6" />
    </IconBase>
  )
}

/** Total run: an upward trend line. */
export function TrendingUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </IconBase>
  )
}

/** Peak day: a single peak. */
export function PeakIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 20L10 8l3 5 2-3 6 10H3z" />
    </IconBase>
  )
}

/** Peak date: a calendar with the day circled. */
export function CalendarCheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M9 14l2 2 4-4" />
    </IconBase>
  )
}

/** Days counted: a calendar with days marked. */
export function CalendarDaysIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <circle cx="8.5" cy="14.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="14.5" r="0.75" fill="currentColor" stroke="none" />
    </IconBase>
  )
}

/** Season span: a range between two points. */
export function SpanIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12h18" />
      <path d="M7 8l-4 4 4 4" />
      <path d="M17 8l4 4-4 4" />
    </IconBase>
  )
}

/** Rank: a medal. */
export function MedalIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="9" r="5" />
      <path d="M9 13l-2 8 5-3 5 3-2-8" />
    </IconBase>
  )
}
