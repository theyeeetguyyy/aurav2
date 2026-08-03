import type { ParamDescriptor } from '@/types/params'

/** Display suffix per parameter unit. Shared so every readout — scrub fields, wire
 *  ranges, graph labels — spells a value the same way. */
export const UNIT_SUFFIX: Record<string, string> = {
  m: ' m',
  deg: '°',
  x: '×',
  '%': '%',
  hz: ' Hz',
  s: ' s',
}

export function unitSuffix(descriptor?: Pick<ParamDescriptor, 'unit'> | null): string {
  return UNIT_SUFFIX[descriptor?.unit ?? ''] ?? ''
}
