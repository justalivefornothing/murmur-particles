import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Tier } from '../gpgpu/quality.ts'
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from './settings.ts'

export type SupportState = 'pending' | 'ok' | 'unsupported'

export interface Stats {
  fps: number
  frameMs: number
  count: number
  format: string
  filtered: boolean
}

export interface StoreState {
  settings: Settings
  /** Section whose headline is active, 0-based. */
  section: number
  panelOpen: boolean
  stats: Stats
  support: SupportState
  supportReason: string
  /** True while the pointer is actively pushing particles. */
  repelling: boolean
  /** True while the visitor is dragging a file over the window. */
  dropHover: boolean
  /** File name of the dropped artwork, if any. */
  artworkName: string | null
  /** Set briefly after the governor lowers the tier. */
  autoStepNotice: string | null
  autopilotActive: boolean

  setSettings: (patch: Partial<Settings>) => void
  resetSettings: () => void
  setSection: (section: number) => void
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
  setStats: (stats: Stats) => void
  setSupport: (support: SupportState, reason?: string) => void
  setRepelling: (repelling: boolean) => void
  setDropHover: (hover: boolean) => void
  setArtworkName: (name: string | null) => void
  setAutoStepNotice: (notice: string | null) => void
  setAutopilotActive: (active: boolean) => void
  /** Tier change coming from the quality governor rather than the panel. */
  applyAutoTier: (tier: Tier) => void
}

export const STORAGE_KEY = 'murmur:settings:v1'

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      section: 0,
      panelOpen: false,
      stats: { fps: 0, frameMs: 0, count: 0, format: '-', filtered: false },
      support: 'pending',
      supportReason: '',
      repelling: false,
      dropHover: false,
      artworkName: null,
      autoStepNotice: null,
      autopilotActive: false,

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetSettings: () => set(() => ({ settings: { ...DEFAULT_SETTINGS } })),
      setSection: (section) => set({ section }),
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
      setStats: (stats) => set({ stats }),
      setSupport: (support, reason = '') => set({ support, supportReason: reason }),
      setRepelling: (repelling) => set((s) => (s.repelling === repelling ? s : { repelling })),
      setDropHover: (dropHover) => set((s) => (s.dropHover === dropHover ? s : { dropHover })),
      setArtworkName: (artworkName) => set({ artworkName }),
      setAutoStepNotice: (autoStepNotice) => set({ autoStepNotice }),
      setAutopilotActive: (autopilotActive) => set((s) => (s.autopilotActive === autopilotActive ? s : { autopilotActive })),
      applyAutoTier: (tier) =>
        set((s) => ({
          settings: { ...s.settings, tier },
          autoStepNotice: `Quality stepped down to ${tier} x ${tier} to hold 40 fps`,
        })),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }),
      merge: (persisted, current) => {
        const stored = (persisted as { settings?: unknown } | undefined)?.settings
        return { ...current, settings: sanitizeSettings(stored) }
      },
    },
  ),
)
