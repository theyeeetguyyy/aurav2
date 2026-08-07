import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  CAMERA_TRANSFORM_DEFAULTS,
  CAMERA_TRANSFORM_DESCRIPTORS,
  CAMERA_TRANSFORM_KEYS,
  cameraQuaternionFrom,
  cameraTransformFromQuaternion,
  getCameraTransformDescriptor,
} from './cameraTransform'

describe('camera transform descriptors', () => {
  it('describes every key, and only those keys', () => {
    expect(CAMERA_TRANSFORM_DESCRIPTORS.map((d) => d.key).sort()).toEqual(
      [...CAMERA_TRANSFORM_KEYS].sort(),
    )
  })

  it('is wireable — every parameter is exposed and realtime', () => {
    // If either flag were false the patchbay would filter it out, and "keyframe the camera"
    // would silently not be offered.
    for (const descriptor of CAMERA_TRANSFORM_DESCRIPTORS) {
      expect(descriptor.exposed, descriptor.key).toBe(true)
      expect(descriptor.realtime, descriptor.key).toBe(true)
    }
  })

  it('agrees with its defaults', () => {
    for (const descriptor of CAMERA_TRANSFORM_DESCRIPTORS) {
      expect(descriptor.defaultValue, descriptor.key).toBe(
        CAMERA_TRANSFORM_DEFAULTS[descriptor.key as keyof typeof CAMERA_TRANSFORM_DEFAULTS],
      )
    }
  })

  it('resolves a key to its descriptor and rejects anything else', () => {
    expect(getCameraTransformDescriptor('fov')?.unit).toBe('deg')
    expect(getCameraTransformDescriptor('scale.uniform')).toBeNull()
  })
})

describe('camera rotation', () => {
  const quaternion = new THREE.Quaternion()

  it('starts level and looking down -Z, so the default framing sees the origin', () => {
    cameraQuaternionFrom(0, 0, 0, quaternion)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion)
    expect(forward.z).toBeCloseTo(-1)
  })

  it('round-trips through a quaternion, which is what Align to this view relies on', () => {
    cameraQuaternionFrom(-20, 35, 8, quaternion)
    const back = cameraTransformFromQuaternion(quaternion)
    expect(back['rotation.x']).toBeCloseTo(-20)
    expect(back['rotation.y']).toBeCloseTo(35)
    expect(back['rotation.z']).toBeCloseTo(8)
  })

  it('yaws without tilting the horizon when pitched', () => {
    // The reason the order is YXZ. Under the default XYZ, yawing a pitched camera rolls it,
    // which reads as a bug rather than as a rotation.
    cameraQuaternionFrom(-30, 90, 0, quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion)
    expect(right.y).toBeCloseTo(0)
  })

  it('is a pure function of its inputs', () => {
    // Shared scratch Euler inside — two calls with the same angles must still agree.
    const first = cameraQuaternionFrom(12, -48, 3, new THREE.Quaternion()).clone()
    cameraQuaternionFrom(90, 90, 90, quaternion)
    const second = cameraQuaternionFrom(12, -48, 3, new THREE.Quaternion())
    expect(second.angleTo(first)).toBeCloseTo(0)
  })
})
