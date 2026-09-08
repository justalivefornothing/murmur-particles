import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import type { Engine } from '../engine/Engine.ts'
import { PALETTES } from '../gpgpu/palettes.ts'
import { TIERS, particlesForTier } from '../gpgpu/quality.ts'
import { SLIDERS, type SliderSpec } from '../store/settings.ts'
import { useStore } from '../store/useStore.ts'

/**
 * Collapsible right-hand drawer. Monochrome, hairline dividers, text-only
 * toggles; opens with the corner glyph or the C key.
 */
export function ControlPanel({ engineRef }: { engineRef: RefObject<Engine | null> }) {
  const open = useStore((s) => s.panelOpen)
  const setOpen = useStore((s) => s.setPanelOpen)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const resetSettings = useStore((s) => s.resetSettings)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) closeRef.current?.focus({ preventScroll: true })
  }, [open])

  const slider = (key: SliderSpec['key']): ReactNode => {
    const spec = SLIDERS.find((s) => s.key === key)
    if (!spec) return null
    return <Slider key={key} spec={spec} value={settings[key]} onChange={(v) => setSettings({ [key]: v })} />
  }

  return (
    <aside
      id="control-panel"
      data-open={open}
      aria-hidden={!open}
      aria-label="Controls"
      className="drawer fixed inset-y-0 right-0 z-30 flex w-[min(100vw,22rem)] flex-col bg-black/85 backdrop-blur-md hairline-l"
    >
      <div className="flex items-baseline justify-between px-7 pt-[max(1.25rem,3vh)] pb-5 hairline-b">
        <h2 className="font-serif text-2xl font-light italic text-ink">Controls</h2>
        <button
          ref={closeRef}
          type="button"
          onClick={() => setOpen(false)}
          className="text-toggle label-caps flex items-center gap-2 py-1"
        >
          Close <span className="text-ink-faint">esc</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-7 pb-10 [scrollbar-width:thin]">
        <Group title="Particles">
          <Row label="Count">
            <Choices
              options={TIERS.map((t) => ({ value: t, label: `${t}²` }))}
              value={settings.tier}
              onChange={(tier) => setSettings({ tier })}
            />
          </Row>
          <p className="label-caps -mt-2 mb-4 text-ink-faint">{particlesForTier(settings.tier).toLocaleString('en-US')} particles</p>
          <Row label="Auto quality">
            <Toggle value={settings.autoQuality} onChange={(autoQuality) => setSettings({ autoQuality })} />
          </Row>
          {slider('pointSize')}
          <Row label="Simulation">
            <Toggle
              value={!settings.paused}
              labels={['running', 'paused']}
              onChange={(running) => setSettings({ paused: !running })}
            />
          </Row>
          <Row label="Positions">
            <button type="button" onClick={() => engineRef.current?.resetPositions()} className="text-toggle label-caps py-1">
              Reset <span className="text-ink-faint">R</span>
            </button>
          </Row>
        </Group>

        <Group title="Flow field">
          {slider('noiseStrength')}
          {slider('noiseScale')}
          {slider('noiseSpeed')}
          {slider('attraction')}
          {slider('damping')}
        </Group>

        <Group title="Pointer">
          {slider('repelRadius')}
          {slider('repelStrength')}
        </Group>

        <Group title="Bloom">
          <Row label="Bloom">
            <Toggle value={settings.bloomEnabled} onChange={(bloomEnabled) => setSettings({ bloomEnabled })} />
          </Row>
          {slider('bloomIntensity')}
          {slider('bloomThreshold')}
        </Group>

        <Group title="Palette">
          <ul className="flex flex-col">
            {PALETTES.map((p) => {
              const active = p.id === settings.paletteId
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSettings({ paletteId: p.id })}
                    aria-pressed={active}
                    className="group flex w-full items-center justify-between py-2.5 text-left"
                  >
                    <span className={`label-caps transition-colors ${active ? 'text-ink' : 'text-ink-dim group-hover:text-ink'}`}>
                      {p.name}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`h-px w-16 transition-opacity ${active ? 'opacity-100' : 'opacity-50 group-hover:opacity-90'}`}
                      style={{ background: `linear-gradient(90deg, ${p.from}, ${p.to})` }}
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        </Group>

        <Group title="Motion">
          <Row label="Autopilot">
            <Toggle value={settings.autopilot} onChange={(autopilot) => setSettings({ autopilot })} />
          </Row>
          <p className="label-caps -mt-2 text-ink-faint">cycles shapes every 6 s when idle</p>
        </Group>

        <div className="flex items-center justify-between pt-6">
          <button type="button" onClick={resetSettings} className="text-toggle label-caps py-1">
            Reset all
          </button>
          <p className="label-caps text-ink-faint">saved locally</p>
        </div>
      </div>
    </aside>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pt-6 pb-2 hairline-b last:border-b-0">
      <h3 className="label-caps mb-4 text-ink-faint">{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <span className="label-caps text-ink-dim">{label}</span>
      {children}
    </div>
  )
}

function Toggle({
  value,
  onChange,
  labels = ['on', 'off'],
}: {
  value: boolean
  onChange: (next: boolean) => void
  labels?: [string, string]
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="label-caps flex items-center gap-3 py-1"
    >
      <span className={value ? 'text-ink' : 'text-ink-faint'}>{labels[0]}</span>
      <span className="h-3 w-px bg-hair" aria-hidden="true" />
      <span className={!value ? 'text-ink' : 'text-ink-faint'}>{labels[1]}</span>
    </button>
  )
}

function Choices<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div className="flex items-center gap-4" role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className="text-toggle label-caps py-1 tabular-nums"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Slider({ spec, value, onChange }: { spec: SliderSpec; value: number; onChange: (v: number) => void }) {
  const id = `slider-${spec.key}`
  const decimals = spec.step >= 1 ? 0 : spec.step >= 0.1 ? 1 : 2
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="label-caps text-ink-dim">
          {spec.label}
        </label>
        <span className="label-caps tabular-nums text-ink">{value.toFixed(decimals)}</span>
      </div>
      <input
        id={id}
        type="range"
        className="hair-range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
