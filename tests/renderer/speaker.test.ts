import { expect, it } from 'vitest';
import { speakerLabel } from '../../src/renderer/ui/format';

it('shows readable speaker names, never raw NPC ids', () => {
  expect(speakerLabel('NARRATOR')).toBe('Narrator');
  expect(speakerLabel('NPC_NEIGHBOR')).toBe('A neighbour (message)');
  expect(speakerLabel('NPC_CENTER_STAFF')).toBe('Evacuation centre staff');
  expect(speakerLabel('NPC_M2')).toBe('A household member');
  expect(speakerLabel('SOMETHING_NEW')).toBe('Someone nearby');
});
