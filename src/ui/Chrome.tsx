import { useEffect, useRef, type RefObject } from 'react'
import type { Engine } from '../engine/Engine.ts'
import { useStore } from '../store/useStore.ts'
import { SECTIONS } from './content.ts'

/** Fixed right-edge section index with a sliding hairline indicator. */
export function SectionIndex({ engineRef }: { engineRef: RefObject<Engine | null> }) {
  const section = useStore((s) => s.section)
  const itemHeight = 2.75 // rem

  return (
    <nav
      aria-label="Sections"
      className="fixed top-1/2 right-[max(1.25rem,3vw)] z-20 hidden -translate-y-1/2 sm:block"
    >
      <div className="relative pl-5">
        <div className="absolute top-0 bottom-0 left-0 w-px bg-hair" aria-hidden="true" />
        <div
          className="index-track"
          aria-hidden="true"
          style={{ height: `${itemHeight}rem`, transform: `translateY(${section * itemHeight}rem)` }}
        />
        <ol className="flex flex-col">
          {SECTIONS.map((s, i) => (
            <li key={s.index} style={{ height: `${itemHeight}rem` }} className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  engineRef.current?.notifyUserInput()
                  engineRef.current?.scrollToSection(i, true)
                }}
                aria-current={i === section ? 'true' : undefined}
                aria-label={`Go to section ${s.index}, ${s.label}`}
                className="text-toggle label-caps group flex items-baseline gap-3 py-2"
              >
                <span className="font-serif text-base font-light tabular-nums tracking-normal not-italic normal-case">{s.index}</span>
                <span
                  className={`hidden transition-opacity duration-500 lg:inline ${
                    i === section ? 'opacity-100' : 'opacity-0 group-hover:opacity-70 group-focus-visible:opacity-70'
                  }`}
                >
                  {s.label}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  )
}

/** Bottom-left wordmark plus the live performance readout. */
export function Wordmark() {
  const stats = useStore((s) => s.stats)
  const autopilot = useStore((s) => s.autopilotActive)
  const paused = useStore((s) => s.settings.paused)

  return (
    <div className="fixed bottom-[max(1.25rem,3vh)] left-[max(1.25rem,3vw)] z-20 flex flex-col gap-2">
      <p className="font-serif text-[1.375rem] leading-none font-light italic text-ink">murmur</p>
      <p className="label-caps flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-faint" aria-live="off">
        <span className="tabular-nums text-ink-dim">{stats.fps > 0 ? Math.round(stats.fps) : '--'} fps</span>
        <span className="tabular-nums">{stats.frameMs > 0 ? stats.frameMs.toFixed(1) : '--'} ms</span>
        <span className="tabular-nums">{stats.count > 0 ? stats.count.toLocaleString('en-US') : '--'} pts</span>
        <span>{stats.format}</span>
        {paused && <span className="text-ink">paused</span>}
        {autopilot && !paused && <span className="text-ink-dim">autopilot</span>}
      </p>
    </div>
  )
}

/** Top bar: author label on the left, controls glyph on the right. */
export function TopBar() {
  const panelOpen = useStore((s) => s.panelOpen)
  const togglePanel = useStore((s) => s.togglePanel)

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between px-[max(1.25rem,3vw)] pt-[max(1.25rem,3vh)]">
      <p className="label-caps text-ink-faint">
        <span className="text-ink-dim">Jafn</span>
        <span className="hidden sm:inline"> · Software Engineer &amp; Creative Technologist</span>
      </p>
      <button
        type="button"
        onClick={togglePanel}
        aria-expanded={panelOpen}
        aria-controls="control-panel"
        className="text-toggle label-caps pointer-events-auto flex items-center gap-3 py-1"
      >
        <span>Controls</span>
        <span className="font-serif text-base leading-none font-light normal-case tracking-normal" aria-hidden="true">
          {panelOpen ? '×' : '+'}
        </span>
        <span className="hidden text-ink-faint md:inline">C</span>
      </button>
    </header>
  )
}

/** Small ring that follows the pointer and swells while it is pushing particles. */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null)
  const repelling = useStore((s) => s.repelling)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (!window.matchMedia('(pointer: fine)').matches) return
    document.documentElement.classList.add('custom-cursor')

    let x = window.innerWidth / 2
    let y = window.innerHeight / 2
    let tx = x
    let ty = y
    let visible = false
    let frame = 0

    const tick = (): void => {
      x += (tx - x) * 0.35
      y += (ty - y) * 0.35
      node.style.translate = `${x}px ${y}px`
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    const onMove = (e: PointerEvent): void => {
      tx = e.clientX
      ty = e.clientY
      if (!visible) {
        visible = true
        node.style.opacity = '1'
      }
      const target = e.target as HTMLElement | null
      const interactive = target?.closest('button, a, input, label, [role="button"]') !== null
      node.dataset.hover = interactive ? 'true' : 'false'
    }
    const onLeave = (): void => {
      visible = false
      node.style.opacity = '0'
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      document.documentElement.classList.remove('custom-cursor')
    }
  }, [])

  return (
    <div
      ref={ref}
      className="cursor-ring"
      aria-hidden="true"
      style={{ opacity: 0, transform: repelling ? 'scale(1.9)' : 'scale(1)' }}
    />
  )
}

/** Full-window hairline frame shown while a file is dragged over the page. */
export function DropOverlay() {
  const hover = useStore((s) => s.dropHover)
  return (
    <div
      aria-hidden={!hover}
      className={`pointer-events-none fixed inset-0 z-40 flex items-center justify-center transition-opacity duration-300 ${
        hover ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute inset-4 border border-ink/60 sm:inset-6" />
      <div className="flex flex-col items-center gap-4 bg-black/70 px-8 py-6 backdrop-blur-sm">
        <p className="font-serif text-4xl font-light italic text-ink sm:text-5xl">Drop to sculpt</p>
        <p className="label-caps text-ink-dim">PNG or JPG · sampled by luminance or alpha</p>
      </div>
    </div>
  )
}

/** Transient text-only notice (quality step-down, drop errors). */
export function Notice() {
  const notice = useStore((s) => s.autoStepNotice)
  const clear = useStore((s) => s.setAutoStepNotice)

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => clear(null), 4500)
    return () => window.clearTimeout(t)
  }, [notice, clear])

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed bottom-[max(1.25rem,3vh)] left-1/2 z-30 -translate-x-1/2 transition-opacity duration-500 ${
        notice ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {notice && <p className="label-caps hairline-t pt-3 text-center text-ink-dim">{notice}</p>}
    </div>
  )
}

/** Shown instead of the experience when float render targets are unavailable. */
export function Fallback() {
  const reason = useStore((s) => s.supportReason)
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-start justify-end bg-black px-[6vw] pb-[12vh]">
      <p className="label-caps mb-6 text-ink-faint">murmur · fallback</p>
      <h1 className="headline section-in-view text-ink" style={{ opacity: 1, transform: 'none', letterSpacing: '-0.03em' }}>
        WebGL2 with float textures <em>not supported</em>.
      </h1>
      <p className="mt-8 max-w-[44ch] text-base leading-relaxed text-ink-dim">
        This piece keeps a quarter of a million particles in floating-point render targets, which needs WebGL2 and
        either <code className="font-sans text-ink">EXT_color_buffer_float</code> or{' '}
        <code className="font-sans text-ink">EXT_color_buffer_half_float</code>. Your browser or GPU driver did not
        offer one. Try a current Chrome, Edge, Firefox or Safari with hardware acceleration turned on.
      </p>
      {reason && <p className="label-caps mt-6 text-ink-faint">{reason}</p>}
    </div>
  )
}
