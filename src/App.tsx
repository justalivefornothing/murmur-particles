import { useRef } from 'react'
import { useStore } from './store/useStore.ts'
import { ControlPanel } from './ui/ControlPanel.tsx'
import { Cursor, DropOverlay, Fallback, Notice, SectionIndex, TopBar, Wordmark } from './ui/Chrome.tsx'
import { Sections } from './ui/Sections.tsx'
import { useEngine } from './ui/useEngine.ts'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useEngine(canvasRef)
  const support = useStore((s) => s.support)

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 h-full w-full bg-black"
        aria-label="A cloud of hundreds of thousands of particles morphing between shapes"
        role="img"
      />
      {support === 'unsupported' ? (
        <Fallback />
      ) : (
        <div className={support === 'ok' ? 'fade-in' : 'opacity-0'}>
          <TopBar />
          <Sections />
          <SectionIndex engineRef={engineRef} />
          <Wordmark />
          <ControlPanel engineRef={engineRef} />
          <DropOverlay />
          <Notice />
          <Cursor />
        </div>
      )}
    </>
  )
}
