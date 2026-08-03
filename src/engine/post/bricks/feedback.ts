import { CopyMaterial, Pass } from 'postprocessing'
import {
  HalfFloatType,
  LinearFilter,
  ShaderMaterial,
  Uniform,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three'
import { num, postParam, type PostBrick, type PostHandle } from '../types'

/** Feedback trails — the previous output frame, transformed and blended back under the
 *  current one.
 *
 *  This is the one post effect that cannot be a merged `Effect`: it needs memory of the
 *  last frame, which means render targets of its own. Zoom-feedback alone turns any
 *  content into an infinite tunnel, and rotation feedback into a spiral — enormous
 *  character for two texture reads.
 *
 *  Frame history makes it the only STATEFUL thing in the render path, so it is also the
 *  only thing that must be explicitly reset when the clock jumps. Without that, scrubbing
 *  backwards would leave trails drawn from a future that has not happened in the new
 *  timeline (HC-3). */

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}`

const FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D inputBuffer;
uniform sampler2D historyBuffer;
uniform float amount;
uniform float zoom;
uniform float rotate;
uniform float fade;
uniform float hueShift;
uniform float aspect;
uniform vec2 offset;
varying vec2 vUv;

/** Rodrigues rotation of the colour vector about the grey axis — a hue shift with no
 *  RGB↔HSV round trip, so it stays cheap enough to run on every trail sample. */
vec3 hueRotate(const in vec3 colour, const in float angle) {
  const vec3 axis = vec3(0.5773502691896258);
  float c = cos(angle);
  return colour * c + cross(axis, colour) * sin(angle) + axis * dot(axis, colour) * (1.0 - c);
}

void main() {
  vec4 current = texture2D(inputBuffer, vUv);

  vec2 p = vUv - 0.5;
  p.x *= aspect;
  float s = sin(rotate);
  float c = cos(rotate);
  p = mat2(c, -s, s, c) * p;
  p /= max(0.01, zoom);
  p.x /= aspect;

  vec3 history = texture2D(historyBuffer, p + 0.5 + offset).rgb;
  history = hueRotate(history, hueShift) * fade;

  // Screen blend, not add: trails brighten toward white and stop, rather than clipping
  // into a flat blown-out smear after a few dozen frames.
  vec3 trail = history * amount;
  gl_FragColor = vec4(current.rgb + trail - current.rgb * trail, current.a);
}`

class FeedbackPass extends Pass {
  private readonly blendMaterial: ShaderMaterial
  private readonly copyMaterial: CopyMaterial
  private historyRead: WebGLRenderTarget
  private historyWrite: WebGLRenderTarget
  /** Cleared on the next render. Set when the clock jumps, so trails do not survive a seek. */
  private pendingClear = true

  constructor() {
    super('Feedback')
    this.needsSwap = true

    this.blendMaterial = new ShaderMaterial({
      name: 'FeedbackBlendMaterial',
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        inputBuffer: new Uniform(null),
        historyBuffer: new Uniform(null),
        amount: new Uniform(0.75),
        zoom: new Uniform(1.01),
        rotate: new Uniform(0),
        fade: new Uniform(0.96),
        hueShift: new Uniform(0),
        aspect: new Uniform(1),
        offset: new Uniform(new Vector2(0, 0)),
      },
    })

    this.copyMaterial = new CopyMaterial()
    this.historyRead = createTarget()
    this.historyWrite = createTarget()
  }

  get uniforms(): { [name: string]: { value: unknown } } {
    return this.blendMaterial.uniforms
  }

  /** Drop accumulated history. Called on any clock jump. */
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

    // Pass 1 — blend current + transformed history into the write target. Rendering
    // into history first (rather than into the output) is what keeps this correct when
    // this pass is last in the stack and `outputBuffer` is the screen, which cannot be
    // read back.
    this.blendMaterial.uniforms.inputBuffer.value = inputBuffer?.texture ?? null
    this.blendMaterial.uniforms.historyBuffer.value = this.historyRead.texture
    this.fullscreenMaterial = this.blendMaterial
    renderer.setRenderTarget(this.historyWrite)
    renderer.render(this.scene, this.camera)

    // Pass 2 — publish the result downstream.
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
    this.blendMaterial.uniforms.aspect.value = width / Math.max(1, height)
    // Resized targets hold garbage from the old resolution; keeping it would smear one
    // stretched frame across the first frame at the new size.
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
    // Half float, so a long trail decays smoothly instead of banding into steps once
    // the accumulated value drops below 1/255.
    type: HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
  })
  target.texture.name = 'Feedback.History'
  return target
}

export const feedbackBrick: PostBrick = {
  id: 'post-feedback',
  label: 'Feedback Trails',
  hint: 'Blends the last frame back in, zoomed or spun. Infinite tunnels from anything.',
  group: 'Time',
  standalone: true,
  descriptors: [
    postParam('amount', 'Amount', 0, 1, 0.7),
    postParam('decay', 'Decay', 0.5, 1, 0.96),
    postParam('zoom', 'Zoom', 0.9, 1.1, 1.012, { step: 0.0005, unit: 'x' }),
    postParam('rotate', 'Rotate', -20, 20, 0, { unit: 'deg' }),
    postParam('offsetX', 'Drift X', -0.05, 0.05, 0),
    postParam('offsetY', 'Drift Y', -0.05, 0.05, 0),
    postParam('hueShift', 'Hue Shift', -0.5, 0.5, 0),
  ],
  create(): PostHandle {
    const pass = new FeedbackPass()
    const DEG = Math.PI / 180
    let lastTime = Number.NaN

    return {
      node: pass,
      update(params, ctx) {
        // A backwards or large jump is a seek, not playback — the same threshold the
        // modulation matrix uses. Trails from the old playhead must not survive it.
        const jumped = !Number.isFinite(lastTime) || ctx.time < lastTime || ctx.time - lastTime > 0.25
        if (jumped) pass.clearHistory()
        lastTime = ctx.time

        const uniforms = pass.uniforms
        uniforms.amount.value = num(params, 'amount', 0.7)
        uniforms.fade.value = num(params, 'decay', 0.96)
        uniforms.zoom.value = num(params, 'zoom', 1.012)
        uniforms.rotate.value = num(params, 'rotate', 0) * DEG
        uniforms.hueShift.value = num(params, 'hueShift', 0)
        ;(uniforms.offset.value as Vector2).set(
          num(params, 'offsetX', 0),
          num(params, 'offsetY', 0),
        )
      },
      dispose: () => pass.dispose(),
    }
  },
}
