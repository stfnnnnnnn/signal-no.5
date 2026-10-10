/** World interact key (E/Space): only a fresh press, and only while no overlay or event is waiting for the player. */
export function acceptsInteractKey(event: { repeat?: boolean } | undefined, blocked: boolean): boolean {
  return !event?.repeat && !blocked;
}
