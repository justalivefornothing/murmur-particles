export interface SectionContent {
  index: string
  label: string
  /** Sub-label shown after the shape name. */
  technique: string
  /** Headline parts: the middle part is set in italic. */
  headline: [string, string, string]
  copy: string
  /** Which side of the viewport the text sits on. */
  align: 'left' | 'right'
}

export const SECTIONS: readonly SectionContent[] = [
  {
    index: '01',
    label: 'Sphere',
    technique: 'Fibonacci lattice',
    headline: ['A murmur of ', 'light', '.'],
    copy:
      'Every particle is one texel in a float texture. Positions live in one, velocities in another, and two shader passes rewrite them every frame. Nothing here is a mesh.',
    align: 'left',
  },
  {
    index: '02',
    label: 'Knot',
    technique: '(3, 7) torus knot',
    headline: ['Knotted, ', 'never', ' tangled.'],
    copy:
      'A torus knot winds three times around the axis and seven around the tube. Its rope is filled by a seeded random walk; the particles find it on their own, pulled by a spring and stirred by curl noise.',
    align: 'right',
  },
  {
    index: '03',
    label: 'Shell',
    technique: 'Superformula',
    headline: ['Grown from ', 'one', ' equation.'],
    copy:
      'Gielis’s superformula, swept twice: once around, once from pole to pole. Change six numbers and the same code grows a starfish, a seed pod, a shell.',
    align: 'left',
  },
  {
    index: '04',
    label: 'Galaxy',
    technique: 'Noisy spiral arms',
    headline: ['A galaxy in a ', 'texture', '.'],
    copy:
      'Three frayed arms, a dense bulge, and value noise in the spine so nothing lines up too neatly. The flow field keeps the whole disc breathing.',
    align: 'right',
  },
  {
    index: '05',
    label: 'Type',
    technique: 'Canvas raster',
    headline: ['Say it in ', 'particles', '.'],
    copy:
      'Type anything. The glyphs are set in Fraunces on an offscreen canvas, thresholded by alpha, and extruded into a slab of points the camera can orbit.',
    align: 'left',
  },
  {
    index: '06',
    label: 'Yours',
    technique: 'Drop an image',
    headline: ['Now, ', 'yours', '.'],
    copy:
      'Drop a PNG or JPG anywhere on this page. Ink on paper, a cut-out, a photograph: the drawing is sampled by luminance or alpha and the cloud reassembles into it.',
    align: 'right',
  },
]
