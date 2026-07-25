import { Music, Shapes, GitBranch, Camera, Film } from 'lucide-react'
import { useUIStore, type WorkspacePage } from '@/store/useUIStore'

const TABS: { page: WorkspacePage; label: string; icon: typeof Music; shortLabel: string }[] = [
  { page: 'media-stems', label: 'Media & Stems', icon: Music, shortLabel: '1' },
  { page: 'scene-shapes', label: 'Scene & Shapes', icon: Shapes, shortLabel: '2' },
  { page: 'routing', label: 'Routing', icon: GitBranch, shortLabel: '3' },
  { page: 'camera', label: 'Camera', icon: Camera, shortLabel: '4' },
  { page: 'deliver', label: 'Deliver', icon: Film, shortLabel: '5' },
]

export function WorkspaceNavBar() {
  const activePage = useUIStore((s) => s.activePage)
  const setActivePage = useUIStore((s) => s.setActivePage)

  return (
    <nav
      id="workspace-navbar"
      className="h-8 bg-aura-base border-t border-aura-line flex items-center justify-center gap-1 px-2 select-none shrink-0"
    >
      {TABS.map(({ page, label, icon: Icon, shortLabel }) => {
        const isActive = activePage === page
        return (
          <button
            key={page}
            id={`tab-${page}`}
            onClick={() => setActivePage(page)}
            className={`
              flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium
              transition-colors duration-150
              ${isActive
                ? 'bg-aura-surface text-aura-accent'
                : 'text-slate-500 hover:text-slate-300 hover:bg-aura-surface/50'
              }
            `}
            title={`${label} (Tab ${shortLabel})`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
