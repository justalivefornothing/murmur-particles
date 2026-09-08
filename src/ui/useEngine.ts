import { useEffect, useRef, type RefObject } from 'react'
import { Engine, IMAGE_SHAPE_INDEX } from '../engine/Engine.ts'
import { decodeHash, encodeHash, type Settings } from '../store/settings.ts'
import { useStore } from '../store/useStore.ts'

const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

/**
 * Creates the engine on the canvas, wires DOM input to it, mirrors store
 * settings into it and keeps the URL hash in sync. Returns a ref so UI
 * controls can call engine methods directly.
 */
export function useEngine(canvasRef: RefObject<HTMLCanvasElement | null>): RefObject<Engine | null> {
  const engineRef = useRef<Engine | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const store = useStore.getState()

    const reason = Engine.unsupportedReason()
    if (reason) {
      store.setSupport('unsupported', reason)
      return
    }

    // Deep link first so the engine boots at the requested resolution/palette.
    const hash = decodeHash(window.location.hash)
    const patch: Partial<Settings> = {}
    if (hash.palette) patch.paletteId = hash.palette
    if (hash.count) patch.tier = hash.count
    if (Object.keys(patch).length > 0) store.setSettings(patch)

    let engine: Engine
    try {
      engine = new Engine(canvas, useStore.getState().settings, {
        onStats: (stats) => useStore.getState().setStats(stats),
        onSection: (section) => useStore.getState().setSection(section),
        onAutoTier: (tier) => useStore.getState().applyAutoTier(tier),
        onRepelling: (active) => useStore.getState().setRepelling(active),
        onAutopilot: (active) => useStore.getState().setAutopilotActive(active),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'WebGL2 with float textures not supported'
      store.setSupport('unsupported', message)
      return
    }
    engineRef.current = engine
    store.setSupport('ok')

    if (hash.shape !== undefined) engine.scrollToSection(hash.shape, false)
    engine.start()

    // Settings -> engine.
    const unsubscribeSettings = useStore.subscribe((state, prev) => {
      if (state.settings !== prev.settings) engine.updateSettings(state.settings)
    })

    // Section / palette / count -> URL hash (replaceState so history stays clean).
    let hashTimer = 0
    const syncHash = (): void => {
      window.clearTimeout(hashTimer)
      hashTimer = window.setTimeout(() => {
        const s = useStore.getState()
        const next = encodeHash({ shape: s.section, palette: s.settings.paletteId, count: s.settings.tier })
        if (next !== window.location.hash) {
          window.history.replaceState(null, '', next || window.location.pathname + window.location.search)
        }
      }, 150)
    }
    const unsubscribeHash = useStore.subscribe((state, prev) => {
      if (
        state.section !== prev.section ||
        state.settings.paletteId !== prev.settings.paletteId ||
        state.settings.tier !== prev.settings.tier
      ) {
        syncHash()
      }
    })
    syncHash()

    // Pointer.
    const onPointerMove = (e: PointerEvent): void => engine.setPointer(e.clientX, e.clientY)
    const onPointerLeave = (): void => engine.setPointer(null, null)
    const onTouchInput = (): void => engine.notifyUserInput()
    const onWheel = (): void => engine.notifyUserInput()
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (NAV_KEYS.has(e.key) && !typing) engine.notifyUserInput()
      if (typing) return
      if (e.key === 'c' || e.key === 'C') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault()
          useStore.getState().togglePanel()
        }
      } else if (e.key === 'Escape') {
        useStore.getState().setPanelOpen(false)
      } else if (e.key === 'r' || e.key === 'R') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) engine.resetPositions()
      }
    }

    // Drag and drop artwork anywhere.
    const isFileDrag = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onDragOver = (e: DragEvent): void => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      useStore.getState().setDropHover(true)
    }
    const onDragLeave = (e: DragEvent): void => {
      if (e.relatedTarget === null || (e.clientX === 0 && e.clientY === 0)) useStore.getState().setDropHover(false)
    }
    const onDrop = (e: DragEvent): void => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      useStore.getState().setDropHover(false)
      const file = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'))
      if (!file) {
        useStore.getState().setAutoStepNotice('Drop a PNG or JPG image to sculpt it')
        return
      }
      engine.notifyUserInput()
      void engine
        .loadImage(file)
        .then((coverage) => {
          useStore.getState().setArtworkName(`${file.name} · ${coverage.toLocaleString('en-US')} px`)
          engine.scrollToSection(IMAGE_SHAPE_INDEX, true)
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Could not read that image'
          useStore.getState().setAutoStepNotice(message)
        })
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('blur', onPointerLeave)
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchInput, { passive: true })
    window.addEventListener('touchmove', onTouchInput, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)

    return () => {
      unsubscribeSettings()
      unsubscribeHash()
      window.clearTimeout(hashTimer)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('blur', onPointerLeave)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchInput)
      window.removeEventListener('touchmove', onTouchInput)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
      engine.dispose()
      engineRef.current = null
    }
  }, [canvasRef])

  return engineRef
}
