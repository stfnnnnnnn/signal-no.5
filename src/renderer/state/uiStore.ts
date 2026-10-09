// Presentation-only UI state (which overlay is open, the prompt, toasts). Never holds game state.
import type { ActionOption } from '../../core/engine';
import { store } from './engineStore';

export type Overlay =
  | { kind: 'none' }
  | { kind: 'menu'; interactableId: string; label: string; actions: ActionOption[] }
  | { kind: 'discovery'; title: string; lines: string[] };
export interface Toast { id: number; kind: 'badge' | 'error' | 'info'; title: string; body?: string; icon?: string }
const TOAST_MS: Record<Toast['kind'], number> = { badge: 6000, error: 3500, info: 3500 };

export class UiStore {
  overlay: Overlay = { kind: 'none' };
  prompt: string | null = null;
  toasts: Toast[] = [];
  version = 0;
  private nextId = 1;
  private readonly listeners = new Set<() => void>();

  /** Clear everything presentational between runs. */
  reset() { this.overlay = { kind: 'none' }; this.prompt = null; this.toasts = []; this.emit(); }
  setPrompt(p: string | null) { if (p !== this.prompt) { this.prompt = p; this.emit(); } }
  open(o: Overlay) { this.overlay = o; this.emit(); }
  close() { this.overlay = { kind: 'none' }; this.emit(); }
  /** Adds a toast that expires on its own timer (independent of other toasts). */
  toast(t: Omit<Toast, 'id'>): number {
    const id = this.nextId++;
    this.toasts = [...this.toasts, { ...t, id }];
    this.emit();
    setTimeout(() => this.dismiss(id), TOAST_MS[t.kind]);
    return id;
  }
  dismiss(id: number) { if (this.toasts.some((t) => t.id === id)) { this.toasts = this.toasts.filter((t) => t.id !== id); this.emit(); } }
  /** True while the world must not take input: an overlay is open or the engine is waiting on an event choice. */
  isBlocking(): boolean { return this.overlay.kind !== 'none' || !!store.state?.activeEvent; }
  subscribe(l: () => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  private emit() { this.version++; for (const l of this.listeners) l(); }
}

export const ui = new UiStore();
