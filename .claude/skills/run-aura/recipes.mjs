import * as B from './build.mjs'

/** Ten projects, one stem set, deliberately different in KIND rather than in degree.
 *
 *  Routing is the same everywhere, as asked: main_bass · Onset fires discrete triggers, and
 *  kick_snare · Envelope and cymbals · Envelope drive continuous parameters. Source rows are
 *  addressed by their metric text — 'Onset' is the bass (the only stem carrying it), and
 *  Envelope #0 / #1 are kick_snare and cymbals in rack order. */

// bass onset, kick envelope, cymbal envelope
export const BASS = ['Onset', 0]
export const KICK = ['Envelope', 0]
export const CYM = ['Envelope', 1]

export const RECIPES = [
  {
    file: '01-dust-collapse.mp4',
    note: 'A sphere drawn as a cloud of its own vertices. The kick breathes it, the bass bursts it, the cymbals roughen it.',
    async build(page, s) {
      await B.tab(page, 'scene-shapes')
      await s('shape', () => B.addShape(page, 'Sphere'))
      await s('select', () => B.selectObject(page, 0))
      await s('points', () => B.setBackend(page, 'Points'))
      await s('size', () => B.setField(page, 'Point Size', 0.35))
      await s('explode', () => B.addEffect(page, 'Explode'))
      await s('noise', () => B.addEffect(page, 'Noise'))
      await s('palette', () => B.setPalette(page, 'Ultraviolet'))
      await s('bloom', () => B.addPost(page, 'Bloom'))
      await s('grade', () => B.addPost(page, 'Colour Grade'))
      await s('orbit', () => B.addBehaviour(page, 'Orbit'))
      await s('w:bass→explode', () => B.wire(page, ...BASS, '/strength'))
      await s('w:kick→scale', () => B.wire(page, ...KICK, 'scale.uniform'))
      await s('w:cym→noise', () => B.wire(page, ...CYM, '/amount'))
    },
  },
  {
    file: '02-lattice-flow.mp4',
    note: 'A grid of 200 icosahedra pushed through a curl-noise current. The lattice dissolves into a stream on the kick.',
    async build(page, s) {
      await B.tab(page, 'scene-shapes')
      await s('shape', () => B.addShape(page, 'Icosahedron'))
      await s('select', () => B.selectObject(page, 0))
      await s('cloner', () => B.addEffect(page, 'Grid Cloner'))
      await s('flow', () => B.addEffect(page, 'Flow Effector'))
      await s('palette', () => B.setPalette(page, 'Ember'))
      await s('bloom', () => B.addPost(page, 'Bloom'))
      await s('kaleido', () => B.addPost(page, 'Kaleidoscope'))
      await s('sway', () => B.addBehaviour(page, 'Sway'))
      await s('w:kick→flow', () => B.wire(page, ...KICK, '/strength'))
      await s('w:cym→hue', () => B.wire(page, ...CYM, 'material.hueShift'))
      await s('w:bass→scale', () => B.wire(page, ...BASS, 'scale.uniform'))
    },
  },
  {
    file: '03-oscilloscope.mp4',
    note: 'Six Lissajous strands, additive, so brightness gathers where they cross. Feedback trails smear the past across the frame.',
    async build(page, s) {
      await B.tab(page, 'scene-shapes')
      await s('shape', () => B.addShape(page, 'Lissajous'))
      await s('select', () => B.selectObject(page, 0))
      await s('strands', () => B.setField(page, 'Strands', 10))
      await s('twist', () => B.addEffect(page, 'Twist'))
      await s('explode', () => B.addEffect(page, 'Explode'))
      await s('palette', () => B.setPalette(page, 'Chlorine'))
      await s('bloom', () => B.addPost(page, 'Bloom'))
      await s('trails', () => B.addPost(page, 'Feedback Trails'))
      await s('dolly', () => B.addBehaviour(page, 'Dolly'))
      await s('w:cym→twist', () => B.wire(page, ...CYM, '/angle'))
      await s('w:bass→explode', () => B.wire(page, ...BASS, '/strength'))
      await s('w:kick→scale', () => B.wire(page, ...KICK, 'scale.uniform'))
    },
  },
  {
    file: '04-constellation.mp4',
    note: 'Scattered nodes linked to their neighbours — a network rather than an object. Grey palette, so it reads as structure, not colour.',
    async build(page, s) {
      await B.tab(page, 'scene-shapes')
      await s('shape', () => B.addShape(page, 'Web'))
      await s('select', () => B.selectObject(page, 0))
      await s('nodes', () => B.setField(page, 'Nodes', 420))
      await s('noise', () => B.addEffect(page, 'Noise'))
      await s('shockwave', () => B.addEffect(page, 'Shockwave'))
      await s('palette', () => B.setPalette(page, 'Mono'))
      await s('bloom', () => B.addPost(page, 'Bloom'))
      await s('grain', () => B.addPost(page, 'Film Grain'))
      await s('orbit', () => B.addBehaviour(page, 'Orbit'))
      await s('w:cym→noise', () => B.wire(page, ...CYM, '/amount'))
      await s('w:bass→shock', () => B.wire(page, ...BASS, '/amplitude'))
      await s('w:kick→scale', () => B.wire(page, ...KICK, 'scale.uniform'))
    },
  },
  {
    file: '05-ribbon-tower.mp4',
    note: 'A swept metal band, lit by a spot. The one project here that is a lit OBJECT rather than a drawing.',
    async build(page, s) {
      await B.tab(page, 'scene-shapes')
      await s('shape', () => B.addShape(page, 'Ribbon Coil'))
      await s('select', () => B.selectObject(page, 0))
      await s('material', () => B.setMaterial(page, 'Physical'))
      await s('bend', () => B.addEffect(page, 'Bend'))
      await s('bulge', () => B.addEffect(page, 'Bulge'))
      await s('light', () => B.addShape(page, 'Spot'))
      await s('palette', () => B.setPalette(page, 'Bone'))
      await s('bloom', () => B.addPost(page, 'Bloom'))
      await s('dolly', () => B.addBehaviour(page, 'Dolly'))
      await s('select-ribbon', () => B.selectObject(page, 1))
      await s('w:kick→bend', () => B.wire(page, ...KICK, '/angle'))
      await s('w:cym→bulge', () => B.wire(page, ...CYM, '/amount'))
      await s('w:bass→scale', () => B.wire(page, ...BASS, 'scale.uniform'))
    },
  },
  {
    file: '06-storm-field.mp4',
    note: 'A flat field of 12,000 points, rolled by a wave and pulled by an attractor. Fog gives it depth.',
    async build(page, s) {
      await B.tab(page, 'scene-shapes')
      await s('shape', () => B.addShape(page, 'Point Field'))
      await s('select', () => B.selectObject(page, 0))
      await s('wave', () => B.addEffect(page, 'Wave'))
      await s('attract', () => B.addEffect(page, 'Attract'))
      await s('palette', () => B.setPalette(page, 'Indigo'))
      await s('bloom', () => B.addPost(page, 'Bloom'))
      await s('zoom', () => B.addPost(page, 'Zoom Blur'))
      await s('shake', () => B.addBehaviour(page, 'Handheld Shake'))
      await s('w:kick→wave', () => B.wire(page, ...KICK, '/amplitude'))
      await s('w:bass→attract', () => B.wire(page, ...BASS, '/strength'))
      await s('w:cym→hue', () => B.wire(page, ...CYM, 'material.hueShift'))
    },
  },
  {
    file: '07-surface-studs.mp4',
    note: 'Five hundred copies placed on the sphere\'s own deformed surface, so the array follows the shape as it spikes.',
    async build(page, s) {
      await B.tab(page, 'scene-shapes')
      await s('shape', () => B.addShape(page, 'Sphere'))
      await s('select', () => B.selectObject(page, 0))
      await s('material', () => B.setMaterial(page, 'Toon'))
      await s('cloner', () => B.addEffect(page, 'Surface Cloner'))
      await s('random', () => B.addEffect(page, 'Random Effector'))
      await s('spike', () => B.addEffect(page, 'Spike'))
      await s('palette', () => B.setPalette(page, 'Ember'))
      await s('bloom', () => B.addPost(page, 'Bloom'))
      await s('mirror', () => B.addPost(page, 'Mirror'))
      await s('orbit', () => B.addBehaviour(page, 'Orbit'))
      await s('w:bass→spike', () => B.wire(page, ...BASS, '/amount'))
      await s('w:kick→scale', () => B.wire(page, ...KICK, 'scale.uniform'))
      await s('w:cym→hue', () => B.wire(page, ...CYM, 'material.hueShift'))
    },
  },
  {
    file: '08-rosette-neon.mp4',
    note: 'A spirograph in neon, split into colour fringes and folded by a kaleidoscope.',
    async build(page, s) {
      await B.tab(page, 'scene-shapes')
      await s('shape', () => B.addShape(page, 'Rosette'))
      await s('select', () => B.selectObject(page, 0))
      await s('petals', () => B.setField(page, 'Petals', 7))
      await s('vortex', () => B.addEffect(page, 'Vortex'))
      await s('palette', () => B.setPalette(page, 'Ultraviolet'))
      await s('bloom', () => B.addPost(page, 'Bloom'))
      await s('chroma', () => B.addPost(page, 'Chromatic Aberration'))
      await s('kaleido', () => B.addPost(page, 'Kaleidoscope'))
      await s('sway', () => B.addBehaviour(page, 'Sway'))
      await s('w:cym→vortex', () => B.wire(page, ...CYM, '/angle'))
      await s('w:kick→scale', () => B.wire(page, ...KICK, 'scale.uniform'))
      await s('w:bass→hue', () => B.wire(page, ...BASS, 'material.hueShift'))
    },
  },
  {
    file: '09-flow-smoke.mp4',
    note: 'Forty streamlines of a curl-noise field. No symmetry anywhere — the opposite of every other project here.',
    async build(page, s) {
      await B.tab(page, 'scene-shapes')
      await s('shape', () => B.addShape(page, 'Flow Lines'))
      await s('select', () => B.selectObject(page, 0))
      await s('strands', () => B.setField(page, 'Strands', 90))
      await s('noise', () => B.addEffect(page, 'Noise'))
      await s('melt', () => B.addEffect(page, 'Melt'))
      await s('palette', () => B.setPalette(page, 'Chlorine'))
      await s('bloom', () => B.addPost(page, 'Bloom'))
      await s('trails', () => B.addPost(page, 'Feedback Trails'))
      await s('dolly', () => B.addBehaviour(page, 'Dolly'))
      await s('w:cym→noise', () => B.wire(page, ...CYM, '/amount'))
      await s('w:kick→melt', () => B.wire(page, ...KICK, '/amount'))
      await s('w:bass→scale', () => B.wire(page, ...BASS, 'scale.uniform'))
    },
  },
  {
    file: '10-sequenced.mp4',
    note: 'Three backends in one scene, cut across a timeline — surfaces, a cloud and strokes, with the edit itself driven by the song.',
    async build(page, s) {
      await B.tab(page, 'scene-shapes')
      await s('sphere', () => B.addShape(page, 'Sphere'))
      await s('select0', () => B.selectObject(page, 0))
      await s('points', () => B.setBackend(page, 'Points'))
      await s('spiral', () => B.addShape(page, 'Spiral'))
      await s('torus', () => B.addShape(page, 'Torus Knot'))
      await s('select-knot', () => B.selectObject(page, 0))
      await s('twist', () => B.addEffect(page, 'Twist'))
      await s('palette', () => B.setPalette(page, 'Ember'))
      await s('bloom', () => B.addPost(page, 'Bloom'))
      await s('flash', () => B.addPost(page, 'Cut Flash'))
      await s('orbit', () => B.addBehaviour(page, 'Orbit'))
      await s('w:cym→twist', () => B.wire(page, ...CYM, '/angle'))
      await s('w:kick→scale', () => B.wire(page, ...KICK, 'scale.uniform'))
      await s('w:bass→hue', () => B.wire(page, ...BASS, 'material.hueShift'))
      // The timeline is the point of this one: derive sections and lay them across the song.
      await s('auto-sequence', async () => {
        await B.tab(page, 'timeline')
        const auto = page.locator('button:has-text("Auto")').first()
        if (await auto.count()) { await auto.click(); await B.wait(page, 2500) }
      })
    },
  },
]
