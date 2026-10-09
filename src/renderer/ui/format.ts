const pad = (n: number) => String(n).padStart(2, '0');

/** Game minutes → "Day N · hh:mm" (blueprint §5.11). */
export function formatClock(gameMinutes: number): string {
  const m = Math.floor(gameMinutes);
  const day = Math.floor(m / 1440) + 1, inDay = m % 1440;
  return `Day ${day} · ${pad(Math.floor(inDay / 60))}:${pad(inDay % 60)}`;
}

const SPEAKERS: Record<string, string> = { NARRATOR: 'Narrator', NPC_NEIGHBOR: 'A neighbour (message)', NPC_CENTER_STAFF: 'Evacuation centre staff' };

/** Dialog speaker ID (blueprint §5.10) → display name. Household members (NPC_M<n>) have no names in the profile. */
export function speakerLabel(speaker: string): string {
  return SPEAKERS[speaker] ?? (/^NPC_M\d+$/.test(speaker) ? 'A household member' : 'Someone nearby');
}
