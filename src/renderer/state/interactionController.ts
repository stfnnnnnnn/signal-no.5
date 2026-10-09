import { ui } from './uiStore';
export function interactWith(id: string, label: string): void { ui.toast({ kind: 'info', title: `${label} (${id})` }); }
