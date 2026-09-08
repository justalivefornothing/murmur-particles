import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useStore } from '../store/useStore.ts'
import { SECTIONS, type SectionContent } from './content.ts'

/**
 * Six full-height editorial sections. Each one flags itself `section-in-view`
 * through an IntersectionObserver, which lets the headline's letter-spacing
 * and opacity ease into place as it enters.
 */
export function Sections() {
  return (
    <main className="relative z-10">
      {SECTIONS.map((section, i) => (
        <Section key={section.index} content={section} index={i} />
      ))}
    </main>
  )
}

function Section({ content, index }: { content: SectionContent; index: number }) {
  const ref = useRef<HTMLElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.intersectionRatio > 0.45)
      },
      { threshold: [0, 0.45, 0.6, 1] },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const right = content.align === 'right'

  return (
    <section
      ref={ref}
      id={`section-${content.index}`}
      aria-labelledby={`headline-${content.index}`}
      className={`pointer-events-none relative flex min-h-screen flex-col justify-end px-[6vw] pb-[14vh] pt-[18vh] sm:pb-[12vh] ${
        inView ? 'section-in-view' : ''
      } ${right ? 'items-end text-right' : 'items-start text-left'}`}
    >
      <div className={`section-block flex w-full flex-col gap-6 ${right ? 'items-end' : 'items-start'}`}>
        <p className="label-caps section-label text-ink-dim">
          {content.index}
          <span className="mx-3 inline-block h-px w-6 translate-y-[-2px] bg-hair-strong align-middle" aria-hidden="true" />
          {content.label}
          <span className="hidden text-ink-faint sm:inline"> · {content.technique}</span>
        </p>
        <h2 id={`headline-${content.index}`} className="headline max-w-[7.6em] text-ink">
          {content.headline[0]}
          <em>{content.headline[1]}</em>
          {content.headline[2]}
        </h2>
        <p className="section-copy max-w-[40ch] text-[0.9375rem] leading-relaxed sm:text-base">{content.copy}</p>
        {index === 4 && <TextInput />}
        {index === 5 && <ArtworkStatus />}
      </div>
    </section>
  )
}

/** Inline field for the text shape: submit to re-rasterise. */
function TextInput() {
  const text = useStore((s) => s.settings.text)
  const setSettings = useStore((s) => s.setSettings)
  const [draft, setDraft] = useState(text)

  useEffect(() => setDraft(text), [text])

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    setSettings({ text: draft.trim().slice(0, 24) || 'JAFN' })
  }

  return (
    <form onSubmit={submit} className="section-copy pointer-events-auto mt-2 flex w-full max-w-[22rem] items-end gap-3 hairline-b pb-2">
      <label htmlFor="shape-text" className="label-caps text-ink-faint">
        Type
      </label>
      <input
        id="shape-text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={24}
        spellCheck={false}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent font-serif text-2xl font-light tracking-tight text-ink outline-none placeholder:text-ink-faint"
        placeholder="JAFN"
        aria-label="Text to render as particles"
      />
      <button type="submit" className="text-toggle label-caps pb-1">
        Set
      </button>
    </form>
  )
}

function ArtworkStatus() {
  const artworkName = useStore((s) => s.artworkName)
  return (
    <p className="section-copy label-caps text-ink-faint">
      {artworkName ? `Showing ${artworkName}` : 'Nothing dropped yet · showing the house emblem'}
    </p>
  )
}
