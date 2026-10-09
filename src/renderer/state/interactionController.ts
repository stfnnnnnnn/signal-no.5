// Glue between the world (who is near what) and the engine (what can be done). No rules here:
// availability, reasons, labels and costs all come from the engine.
import type { ActionOption, CommandResult } from '../../core/engine';
import { ITEM_LABELS } from '../../core/content/items';
import { missingGoBagItems } from '../../core/selectors';
import type { ItemId } from '../../shared/contracts/ids';
import type { ShopItemId } from '../../shared/contracts/state';
import { store } from './engineStore';
import { ui } from './uiStore';

export function interactWith(id: string, label: string): void {
  if (id === 'SHOP_COUNTER') { // the counter is UI only: the shop panel (prices and stock come from the engine)
    if (store.state?.activeEvent) { ui.toast({ kind: 'error', title: 'Respond to the current event first.' }); return; }
    store.dispatch((e) => e.pause('shop'));
    ui.open({ kind: 'shop' });
    return;
  }
  const r = store.interact(id);
  if (!r.ok) { ui.toast({ kind: 'error', title: r.error.message, body: r.error.reasons?.join(' ') }); return; }
  if (r.events.some((e) => e.type === 'eventTriggered')) return; // EventDialog opens from state.activeEvent
  if (r.actions.length === 0) { ui.toast({ kind: 'info', title: `${label}: nothing to do here right now.` }); return; }
  store.dispatch((e) => e.pause('menu'));
  ui.open({ kind: 'menu', interactableId: id, label, actions: r.actions });
}

export function closeMenu(): void {
  ui.close();
  for (const reason of ['menu', 'shop'] as const) if (store.state?.clock.pauseReasons.includes(reason)) store.dispatch((e) => e.resume(reason));
}

/** Inventory / objectives panels pause the clock like a menu. */
export function openPanel(kind: 'inventory' | 'objectives'): void {
  if (!store.state || store.state.activeEvent) return;
  if (ui.overlay.kind !== 'none') closeMenu();
  store.dispatch((e) => e.pause('menu'));
  ui.open({ kind });
}

/** Buy through the engine; its error message is shown as is. Returns true when bought. */
export function buy(item: ShopItemId, quantity: number): boolean {
  const r = store.dispatch((e) => e.purchase(item, quantity));
  if (!r.ok) ui.toast({ kind: 'error', title: r.error.message, body: r.error.reasons?.join(' ') });
  return r.ok;
}

export function runMenuAction(option: ActionOption): CommandResult | null {
  if (!option.available) return null;
  const r = store.dispatch((e) => e.executeAction(option.actionId));
  if (!r.ok) {
    ui.toast({ kind: 'error', title: r.error.message, body: r.error.reasons?.join(' ') });
    return r;
  }
  closeMenu();
  if (option.kind === 'discovery') ui.open({ kind: 'discovery', title: option.label, lines: discoveryLines(option.actionId) });
  else ui.toast({ kind: 'info', title: option.label, body: option.timeCostMinutes ? `Took ${option.timeCostMinutes} min.` : undefined });
  return r;
}

/** Built from engine state only (blueprint §6.3; copy pending content review, BK-3). */
function discoveryLines(actionId: string): string[] {
  const s = store.state!;
  if (actionId === 'INSPECT_GO_BAG') {
    const missing = missingGoBagItems(s);
    return missing.length === 0 ? ['The go-bag has everything it needs.']
      : ['Still missing:', ...missing.map((alts) => `• ${alts.map((i) => ITEM_LABELS[i]).join(' or ')}`)];
  }
  const counts = (Object.entries(s.house) as [ItemId, number | undefined][]).filter(([, n]) => (n ?? 0) > 0);
  return counts.length === 0 ? ['Nothing stored here yet.'] : counts.map(([id, n]) => `• ${ITEM_LABELS[id]}: ${n}`);
}
