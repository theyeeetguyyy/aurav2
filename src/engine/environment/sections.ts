import type { ParamDescriptor, ParamValue } from '@/types/params'

/** The world around the objects (docs/10-ELEMENTS.md §E).
 *
 *  Until now the background, fog, grid and lights were literals inside a React component,
 *  which had two consequences: the frame always looked like a 3D editor, and none of it
 *  could be driven by the music. The brief asked for a routable background colour on the
 *  first page and there was nowhere to put it.
 *
 *  Environment is a FIXED set of sections rather than an open stack — a scene has exactly
 *  one background and one fog, not a list of them. But each section addresses itself
 *  exactly like an effect does, with a reserved owner id and the section as the effect id,
 *  so lighting intensity is wired in the patchbay the same way a deformer is (HC-5). */

export const ENV_STACK_ID = '@env'

export interface EnvSection {
  id: string
  label: string
  hint: string
  /** Whether the section can be switched off entirely. */
  toggleable: boolean
  descriptors: ParamDescriptor[]
}

function knob(
  key: string,
  label: string,
  min: number,
  max: number,
  defaultValue: number,
  options: Partial<ParamDescriptor> = {},
): ParamDescriptor {
  return {
    key,
    label,
    type: 'float',
    min,
    max,
    step: (max - min) / 200,
    defaultValue,
    group: 'World',
    exposed: true,
    realtime: true,
    ...options,
  }
}

function colour(key: string, label: string, defaultValue: string): ParamDescriptor {
  return {
    key,
    label,
    type: 'color',
    min: 0,
    max: 0,
    step: 1,
    defaultValue,
    group: 'World',
    exposed: false,
    realtime: false,
  }
}

function choice(
  key: string,
  label: string,
  defaultValue: ParamValue,
  options?: { value: string; label: string }[],
): ParamDescriptor {
  return {
    key,
    label,
    type: options ? 'enum' : 'bool',
    min: 0,
    max: options ? options.length - 1 : 1,
    step: 1,
    defaultValue,
    options,
    group: 'World',
    exposed: false,
    realtime: false,
  }
}

export const ENV_SECTIONS: EnvSection[] = [
  {
    id: 'background',
    label: 'Background',
    hint: 'Solid or vertical gradient behind everything. Intensity is modulatable.',
    toggleable: false,
    descriptors: [
      choice('mode', 'Mode', 'gradient', [
        { value: 'gradient', label: 'Gradient' },
        { value: 'solid', label: 'Solid' },
      ]),
      colour('topColor', 'Top', '#1a1a2e'),
      colour('bottomColor', 'Bottom', '#05050a'),
      // A background that brightens on the downbeat is one wire, and it reads as a
      // deliberate lighting cue rather than as a colour change.
      knob('intensity', 'Intensity', 0, 3, 1, { unit: 'x' }),
    ],
  },
  {
    id: 'fog',
    label: 'Fog',
    hint: 'Depth haze. The cheapest way to make a scene read as deep rather than flat.',
    toggleable: true,
    descriptors: [
      choice('mode', 'Falloff', 'exp2', [
        { value: 'exp2', label: 'Exponential' },
        { value: 'linear', label: 'Linear' },
      ]),
      colour('color', 'Colour', '#05050a'),
      knob('density', 'Density', 0, 0.06, 0.008, { step: 0.0002 }),
      knob('near', 'Near', 0, 500, 20, { unit: 'm' }),
      knob('far', 'Far', 1, 1000, 220, { unit: 'm' }),
    ],
  },
  {
    id: 'lighting',
    label: 'Lighting',
    hint: 'Three-point rig. Every intensity and the key light angle can be driven.',
    toggleable: false,
    descriptors: [
      knob('ambient', 'Ambient', 0, 3, 0.6),
      knob('keyIntensity', 'Key', 0, 10, 2.2, { curve: 'exp' }),
      colour('keyColor', 'Key Colour', '#ffffff'),
      // Azimuth and elevation rather than a position vector: sweeping a light around the
      // scene is one wire this way, and three coupled wires the other.
      knob('keyAzimuth', 'Key Azimuth', -180, 180, 40, { unit: 'deg' }),
      knob('keyElevation', 'Key Elevation', -89, 89, 45, { unit: 'deg' }),
      knob('fillIntensity', 'Fill', 0, 10, 0.6, { curve: 'exp' }),
      colour('fillColor', 'Fill Colour', '#06b6d4'),
      knob('rimIntensity', 'Rim', 0, 10, 1.1, { curve: 'exp' }),
      colour('rimColor', 'Rim Colour', '#6366f1'),
      choice('shadows', 'Shadows', true),
    ],
  },
  {
    id: 'reflections',
    label: 'Reflections',
    hint: 'Procedural studio environment. Metal and glass stop looking like grey plastic.',
    toggleable: true,
    descriptors: [knob('intensity', 'Intensity', 0, 3, 1, { unit: 'x' })],
  },
  {
    id: 'grid',
    label: 'Grid',
    hint: 'Floor reference. Authoring furniture — switch it off before rendering.',
    toggleable: true,
    descriptors: [
      knob('height', 'Height', -200, 200, -10, { unit: 'm', realtime: true }),
      knob('cellSize', 'Cell', 0.1, 20, 1, { unit: 'm', realtime: false }),
      knob('sectionSize', 'Section', 1, 100, 5, { unit: 'm', realtime: false }),
      knob('fadeDistance', 'Fade', 10, 1000, 250, { unit: 'm', realtime: false }),
      colour('cellColor', 'Cell Colour', '#3f3f46'),
      colour('sectionColor', 'Section Colour', '#6366f1'),
    ],
  },
]

export function getEnvSection(id: string): EnvSection | null {
  return ENV_SECTIONS.find((section) => section.id === id) ?? null
}

export function envDefaults(): Record<string, Record<string, ParamValue>> {
  const out: Record<string, Record<string, ParamValue>> = {}
  for (const section of ENV_SECTIONS) {
    const params: Record<string, ParamValue> = {}
    for (const descriptor of section.descriptors) params[descriptor.key] = descriptor.defaultValue
    out[section.id] = params
  }
  return out
}
