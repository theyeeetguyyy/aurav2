import { CopyMaterial, Pass } from 'postprocessing'
import {
  HalfFloatType,
  LinearFilter,
  ShaderMaterial,
  Uniform,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three'
import { num, postParam, type PostBrick, type PostHandle } from '../types'

/** RGB Delay — each colour channel lags the picture by a different amount.
 *
 *  **Temporal** chromatic aberration, and the distinction from the spatial one already in the
 *  catalogue is the whole reason this exists. `Chromatic Aberration` offsets the channels in
 *  *space*, so a still frame shows fringing and a moving one shows the same fringing sliding
 *  around. This offsets them in *time*: red is showing you where the object was a moment ago and
 *  blue is showing you where it is now, so a still frame is untouched and a moving one tears into
 *  colour. Nothing in the stack produces that, and no setting of the spatial version approximates
 *  it — one is a lens defect, the other is a display that cannot keep up.
 *
 *  ### One buffer, three decay rates
 *
 *  The obvious implementation keeps N frames of history and samples three of them. That is N render
 *  targets at full resolution, and the delay is quantised to whole frames — so it changes character
 *  with the frame rate, which means the preview and a 60 fps export would not match.
 *
 *  Instead one history buffer decays **per channel**: `history = mix(current, history, lag)` with a
 *  different `lag` per channel. A channel with a high lag takes many frames to catch up and
 *  therefore trails; one with zero lag is instantaneous. Same look, one buffer, and the amount of
 *  lag is a continuous value rather than a frame count.
 *
 *  ### Why it is stateful, and what that costs
 *
 *  Like Feedback Trails, this is memory of previous frames, which makes it one of the two things in
 *  the render path that are not pure functions of `t`. The same discipline applies: history is
 *  cleared on any clock jump, or scrubbing backwards would leave colour trails drawn from a future
 *  that has not happened in the new timeline (HC-3). A forward render — which is what an export
 *  always is — reproduces exactly. */

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}`

const FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D inputBuffer;
uniform sampler2D historyBuffer;
uniform vec3 lag;
uniform float amount;
varying vec2 vUv;

void main() {
  vec4 current = texture2D(inputBuffer, vUv);
  vec3 history = texture2D(historyBuffer, vUv).rgb;

  // Per channel: how much of the OLD value survives. At 0 the channel is the live picture; near 1
  // it takes many frames to catch up, so it lags behind everything moving.
  vec3 trailed = mix(current.rgb, history, lag);

  gl_FragColor = vec4(mix(current.rgb, trailed, amount), current.a);
}`

class RgbDelayPass extends Pass {
  private readonly blendMaterial: ShaderMaterial
  private readonly copyMaterial: CopyMaterial
  private historyRead: WebGLRenderTarget
  private historyWrite: WebGLRenderTarget
  private pendingClear = true

  constructor() {
    super('RgbDelay')
    this.needsSwap = true

    this.blendMaterial = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        inputBuffer: new Uniform(null),
        historyBuffer: new Uniform(null),
        lag: new Uniform(new Vector3(0, 0, 0)),
        amount: new Uniform(0),
      },
    })

    this.copyMaterial = new CopyMaterial()
    this.historyRead = createTarget()
    this.historyWrite = createTarget()
  }

  get uniforms(): { [name: string]: { value: unknown } } {
    return this.blendMaterial.uniforms
  }

  clearHistory(): void {
    this.pendingClear = true
  }

  override render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget | null,
    outputBuffer: WebGLRenderTarget | null,
  ): void {
    if (this.pendingClear) {
      for (const target of [this.historyRead, this.historyWrite]) {
        renderer.setRenderTarget(target)
        renderer.clear(true, false, false)
      }
      this.pendingClear = false
    }

    // Into history first, then published downstream — the same two-step Feedback Trails uses, and
    // for the same reason: when this pass is last in the stack the output is the screen, which
    // cannot be read back on the following frame.
    this.blendMaterial.uniforms.inputBuffer.value = inputBuffer?.texture ?? null
    this.blendMaterial.uniforms.historyBuffer.value = this.historyRead.texture
    this.fullscreenMaterial = this.blendMaterial
    renderer.setRenderTarget(this.historyWrite)
    renderer.render(this.scene, this.camera)

    this.copyMaterial.inputBuffer = this.historyWrite.texture
    this.fullscreenMaterial = this.copyMaterial
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer)
    renderer.render(this.scene, this.camera)

    const previous = this.historyRead
    this.historyRead = this.historyWrite
    this.historyWrite = previous
  }

  override setSize(width: number, height: number): void {
    this.historyRead.setSize(width, height)
    this.historyWrite.setSize(width, height)
    // Resized targets hold garbage from the old resolution, and one stretched frame smeared across
    // the first frame at the new size is exactly the artefact this is meant to produce deliberately.
    this.pendingClear = true
  }

  override dispose(): void {
    this.historyRead.dispose()
    this.historyWrite.dispose()
    this.blendMaterial.dispose()
    this.copyMaterial.dispose()
    super.dispose()
  }
}

function createTarget(): WebGLRenderTarget {
  const target = new WebGLRenderTarget(1, 1, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    // Half float for the same reason Feedback Trails needs it: a long lag decays through values
    // below 1/255, and at 8 bits those quantise into visible steps.
    type: HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
  })
  target.texture.name = 'RgbDelay.History'
  return target
}

export const rgbDelayBrick: PostBrick = {
  id: 'post-rgb-delay',
  label: 'RGB Delay',
  hint: 'Each colour channel lags by a different amount. A still frame is untouched; a moving one tears into colour.',
  group: 'Time',
  standalone: true,
  descriptors: [
    postParam('amount', 'Amount', 0, 1, 0),
    // Defaults spread across the channels rather than sitting equal: equal lag on all three is
    // Feedback Trails with no transform, and a fresh RGB Delay should show what it is for.
    postParam('red', 'Red Lag', 0, 0.98, 0.9),
    postParam('green', 'Green Lag', 0, 0.98, 0.6),
    postParam('blue', 'Blue Lag', 0, 0.98, 0),
  ],
  create(): PostHandle {
    const pass = new RgbDelayPass()
    let lastTime = Number.NaN

    return {
      node: pass,
      update(params, ctx) {
        // A backwards or large jump is a seek, not playback — the same threshold Feedback Trails
        // and the modulation matrix use. Colour trails from the old playhead must not survive it.
        const jumped = !Number.isFinite(lastTime) || ctx.time < lastTime || ctx.time - lastTime > 0.25
        if (jumped) pass.clearHistory()
        lastTime = ctx.time

        const uniforms = pass.uniforms
        uniforms.amount.value = num(params, 'amount', 0)
        ;(uniforms.lag.value as Vector3).set(
          num(params, 'red', 0.9),
          num(params, 'green', 0.6),
          num(params, 'blue', 0),
        )
      },
      dispose: () => pass.dispose(),
    }
  },
}
