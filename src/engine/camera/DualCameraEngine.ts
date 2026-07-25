import * as THREE from 'three'

/** Non-React imperative camera engine managing WASD fly movement.
 *  Pre-allocates reusable vectors to avoid per-frame GC pressure. */
export class DualCameraEngine {
  private static instance: DualCameraEngine

  public scenePosition = new THREE.Vector3(0, 0, 50)
  public sceneQuaternion = new THREE.Quaternion()

  public previewPosition = new THREE.Vector3(0, 0, 50)
  public previewQuaternion = new THREE.Quaternion()

  private keysPressed: Set<string> = new Set()

  // Pre-allocated scratch vectors — reused every frame, never GC'd
  private readonly _forward = new THREE.Vector3()
  private readonly _right = new THREE.Vector3()
  private readonly _up = new THREE.Vector3(0, 1, 0)

  private readonly handleKeyDown = (e: KeyboardEvent) => {
    this.keysPressed.add(e.code)
  }
  private readonly handleKeyUp = (e: KeyboardEvent) => {
    this.keysPressed.delete(e.code)
  }

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown)
      window.addEventListener('keyup', this.handleKeyUp)
    }
  }

  public static getInstance(): DualCameraEngine {
    if (!DualCameraEngine.instance) {
      DualCameraEngine.instance = new DualCameraEngine()
    }
    return DualCameraEngine.instance
  }

  /** Clean up event listeners (call on app teardown) */
  public dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown)
      window.removeEventListener('keyup', this.handleKeyUp)
    }
  }

  /** Update preview camera position based on WASD keys.
   *  Called from useFrame — must be allocation-free. */
  public updateFlyMovement(camera: THREE.Camera, speed = 0.5): void {
    if (this.keysPressed.size === 0) return

    this._forward.set(0, 0, -1).applyQuaternion(camera.quaternion)
    this._right.set(1, 0, 0).applyQuaternion(camera.quaternion)

    if (this.keysPressed.has('KeyW')) camera.position.addScaledVector(this._forward, speed)
    if (this.keysPressed.has('KeyS')) camera.position.addScaledVector(this._forward, -speed)
    if (this.keysPressed.has('KeyA')) camera.position.addScaledVector(this._right, -speed)
    if (this.keysPressed.has('KeyD')) camera.position.addScaledVector(this._right, speed)
    if (this.keysPressed.has('ShiftLeft') || this.keysPressed.has('ShiftRight'))
      camera.position.addScaledVector(this._up, speed)
    if (this.keysPressed.has('ControlLeft') || this.keysPressed.has('ControlRight'))
      camera.position.addScaledVector(this._up, -speed)

    this.previewPosition.copy(camera.position)
    this.previewQuaternion.copy(camera.quaternion)
  }

  /** Snap preview camera to match scene camera position */
  public snapPreviewToScene(camera: THREE.Camera): void {
    camera.position.copy(this.scenePosition)
    camera.quaternion.copy(this.sceneQuaternion)
    this.previewPosition.copy(this.scenePosition)
    this.previewQuaternion.copy(this.sceneQuaternion)
  }
}
