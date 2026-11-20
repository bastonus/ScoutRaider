/**
 * Templier Module — Standard v2.0
 * Templar cross cipher (pigpen variant) with font mapping.
 */
import { normalizeAccents } from '../utils';

export function encodeTemplier(text: string): { encoded_text: string; font_family: string } {
  const normalized = normalizeAccents(text).toLowerCase().replace(/[^a-z0-9 ]/g, '');
  return {
    encoded_text: normalized,
    font_family: 'TemplarsCipherPlus'
  };
}

export default {
  id: 'templier',
  name: 'Croix des Templiers',
  capability: 'symbolic_visual',
  transform: (text: string) => encodeTemplier(text).encoded_text,
  encode: encodeTemplier
};
