import * as THREE from 'three'

/** DualCameraEngine — non-React state for the two cameras
 *  (docs/03-ARCHITECTURE.md HC-10).
 *
 *  Two genuinely distinct cameras exist at all times:
 *
 *    Scene Camera   — the ONLY camera that ever renders output. Its transform is
 *                     owned here and driven by the camera track during playback and
 *                     export. Preview controls must never touch it.
 *    Preview Camera — the free authoring camera. Fly or Orbit, mutually exclusive.
 *
 *  Flying the preview camera around and then exporting must produce the framing the
 *  camera track specifies, not wherever the user happened to leave the preview.
 *
 *  Input listeners are attached explicitly by the viewport rather than in the
 *  constructor, so they exist only while a preview camera is actually being flown. */

const DEFAULT_SCENE_POSITION = new THREE.Vector3(0, 0, 50)
const PITCH_LIMIT = Math.PI / 2 - 0.01
const LOOK_SENSITIVITY = 0.0025
/** Metres per second at base speed. Scene units are metres (HC-12). */
const BASE_SPEED = 25
const BOOST_MULTIPLIER = 3

export class DualCameraEngine {
  private static instance: DualCameraEngine

  /** Authoritative Scene Camera transform. Written by the camera track, never by controls. */
  public readonly scenePosition = DEFAULT_SCENE_POSITION.clone()
  public readonly sceneQuaternion = new THREE.Quaternion()
  public sceneFov = 45

  /** Preview Camera transform, persisted across control-mode and tab switches. */
  public readonly previewPosition = DEFAULT_SCENE_POSITION.clone()
  public readonly previewQuaternion = new THREE.Quaternion()
  public previewFov = 50

  private readonly keys = new Set<string>()
  private yaw = 0
  private pitch = 0
  private dragging = false
  private element: HTMLElement | null = null
  private attachCount = 0

  // Pre-allocated scratch — updateFlyMovement runs every frame and must not allocate.
  private readonly _forward = new THREE.Vector3()
  private readonly _right = new THREE.Vector3()
  private readonly _up = new THREE.Vector3(0, 1, 0)
  private readonly _euler = new THREE.Euler(0, 0, 0, 'YXZ')

  private constructor() {
    this.sceneQuaternion.setFromRotationMatrix(
      new THREE.Matrix4().lookAt(DEFAULT_SCENE_POSITION, new THREE.Vector3(), this._up),
    )
    this.previewQuaternion.copy(this.sceneQuaternion)
    this.syncAnglesFrom(this.previewQuaternion)
  }

  public static getInstance(): DualCameraEngine {
    if (!DualCameraEngine.instance) {
      DualCameraEngine.instance = new DualCameraEngine()
    }
    return DualCameraEngine.instance
  }

  // ─── Input lifecycle ───

  /** Begin listening for fly input. Reference-counted; returns a detach function. */
  public attach(element: HTMLElement): () => void {
    this.attachCount++
    if (this.attachCount === 1) {
      this.element = element
      window.addEventListener('keydown', this.onKeyDown)
      window.addEventListener('keyup', this.onKeyUp)
      window.addEventListener('blur', this.clearKeys)
      document.addEventListener('visibilitychange', this.clearKeys)
      element.addEventListener('pointerdown', this.onPointerDown)
      element.addEventListener('pointermove', this.onPointerMove)
      element.addEventListener('pointerup', this.onPointerUp)
      element.addEventListener('pointercancel', this.onPointerUp)
    }
    return () => this.detach()
  }

  private detach(): void {
    this.attachCount = Math.max(0, this.attachCount - 1)
    if (this.attachCount > 0) return

    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.clearKeys)
    document.removeEventListener('visibilitychange', this.clearKeys)

    const el = this.element
    if (el) {
      el.removeEventListener('pointerdown', this.onPointerDown)
      el.removeEventListener('pointermove', this.onPointerMove)
      el.removeEventListener('pointerup', this.onPointerUp)
      el.removeEventListener('pointercancel', this.onPointerUp)
    }
    this.element = null
    this.clearKeys()
  }

  // ─── Handlers ───

  /** Typing "wasd" into a text field must not fly the camera. */
  private static isEditable(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null
    if (!el || !el.tagName) return false
    return (
      el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable
    )
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (DualCameraEngine.isEditable(e.target)) return
    this.keys.add(e.code)
  }

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code)
  }

  /** Clear held keys when focus leaves, so a key held during Alt-Tab does not stick. */
  private readonly clearKeys = (): void => {
    this.keys.clear()
    this.dragging = false
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return
    this.dragging = true
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return
    this.yaw -= e.movementX * LOOK_SENSITIVITY
    this.pitch = clamp(this.pitch - e.movementY * LOOK_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT)
  }

  private readonly onPointerUp = (e: PointerEvent): void => {
    this.dragging = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  }

  // ─── Per-frame update ───

  /** Apply fly movement and look rotation to the preview camera.
   *  Delta-scaled so speed is frame-rate independent. Allocation-free. */
  public updateFlyMovement(camera: THREE.Camera, delta: number): void {
    this._euler.set(this.pitch, this.yaw, 0)
    camera.quaternion.setFromEuler(this._euler)

    if (this.keys.size === 0) return

    const boosted = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    const step = BASE_SPEED * (boosted ? BOOST_MULTIPLIER : 1) * delta

    this._forward.set(0, 0, -1).applyQuaternion(camera.quaternion)
    this._right.set(1, 0, 0).applyQuaternion(camera.quaternion)

    if (this.keys.has('KeyW')) camera.position.addScaledVector(this._forward, step)
    if (this.keys.has('KeyS')) camera.position.addScaledVector(this._forward, -step)
    if (this.keys.has('KeyA')) camera.position.addScaledVector(this._right, -step)
    if (this.keys.has('KeyD')) camera.position.addScaledVector(this._right, step)
    if (this.keys.has('KeyE') || this.keys.has('Space'))
      camera.position.addScaledVector(this._up, step)
    if (this.keys.has('KeyQ') || this.keys.has('ControlLeft') || this.keys.has('ControlRight'))
      camera.position.addScaledVector(this._up, -step)
  }

  /** Persist the preview camera's transform so it survives mode and tab switches. */
  public capturePreview(camera: THREE.Camera): void {
    this.previewPosition.copy(camera.position)
    this.previewQuaternion.copy(camera.quaternion)
  }

  /** Restore a camera object to the stored preview transform. */
  public restorePreview(camera: THREE.Camera): void {
    camera.position.copy(this.previewPosition)
    camera.quaternion.copy(this.previewQuaternion)
    this.syncAnglesFrom(this.previewQuaternion)
  }

  /** Move the preview camera to wherever the scene camera currently is
   *  ("Goto Scene Camera"). Does not modify the scene camera. */
  public snapPreviewToScene(camera: THREE.Camera): void {
    camera.position.copy(this.scenePosition)
    camera.quaternion.copy(this.sceneQuaternion)
    this.capturePreview(camera)
    this.syncAnglesFrom(this.sceneQuaternion)
  }

  /** Reset the scene camera to its documented default: (0,0,50) facing the origin. */
  public resetSceneCamera(): void {
    this.scenePosition.copy(DEFAULT_SCENE_POSITION)
    this.sceneQuaternion.setFromRotationMatrix(
      new THREE.Matrix4().lookAt(DEFAULT_SCENE_POSITION, new THREE.Vector3(), this._up),
    )
  }

  /** Keep yaw/pitch in step with an externally-set orientation (e.g. after Orbit),
   *  so switching back to Fly continues from where Orbit left off instead of snapping. */
  public syncAnglesFrom(quaternion: THREE.Quaternion): void {
    this._euler.setFromQuaternion(quaternion, 'YXZ')
    this.yaw = this._euler.y
    this.pitch = clamp(this._euler.x, -PITCH_LIMIT, PITCH_LIMIT)
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}
