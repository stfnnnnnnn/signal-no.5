// Shutdown helpers for the Electron main process. Node-only types (no Electron import) so they are unit-testable.

/** The parts of a BrowserWindow that status pushes need. */
export interface StatusTarget {
  isDestroyed(): boolean;
  webContents: { isDestroyed(): boolean; send(channel: string, ...args: unknown[]): void };
}

/** Send an IPC message only to a live window; closing the window never turns a status push into an exception. */
export function sendToWindow(win: StatusTarget | null, channel: string, ...args: unknown[]): boolean {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return false;
  try { win.webContents.send(channel, ...args); return true; } catch { return false; }
}

/** Wrap a server stop so it runs at most once and never rejects (the app must always be able to exit). */
export function onceShutdown(stop: () => Promise<unknown>): () => Promise<void> {
  let done: Promise<void> | null = null;
  return () => (done ??= stop().then(() => undefined, () => undefined));
}
