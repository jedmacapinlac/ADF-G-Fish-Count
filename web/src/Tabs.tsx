import { TABS, type TabId } from './seriesTabs'

type Props = {
  active: TabId
  onChange: (tab: TabId) => void
}

export default function Tabs({ active, onChange }: Props) {
  return (
    <div role="tablist" className="flex w-full border-b border-stone-400">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          type="button"
          aria-selected={id === active}
          onClick={() => onChange(id)}
          /* flex-1 with a shared basis divides the row evenly however wide the
             panel is; -mb-px pulls the active tab's bottom edge over the
             tablist's border so it reads as joined to its panel. */
          className={`-mb-px flex-1 basis-0 rounded-t-lg border-b-2 px-2 py-2.5 text-center text-sm font-semibold whitespace-nowrap focus:outline-none ${
            id === active
              ? 'border-sage-600 bg-sage-100 text-stone-900'
              : 'border-transparent text-stone-700 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
