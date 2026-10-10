import { useEffect, useRef, useState } from 'react';
import { ITEM_LABELS } from '../../core/content/items';
import { missingGoBagItems } from '../../core/selectors';
import type { ItemId } from '../../shared/contracts/ids';
import type { ShopItemId } from '../../shared/contracts/state';
import { ITEM_URLS } from '../game/assets';
import { store } from '../state/engineStore';
import { useEngineState, useUi } from '../state/hooks';
import { buy, closeMenu, runMenuAction } from '../state/interactionController';
import { objectivesView } from './hud/hudModel';

/** Processed item art for the items that have it (others show the label only). */
const ITEM_ICON: Partial<Record<ItemId, string>> = {
  WATER: 'water', FOOD: 'cannedfood', FLASHLIGHT: 'flashlight', BATTERIES: 'batteries', POWER_BANK: 'powerbank', RADIO: 'radio',
  FIRST_AID_KIT: 'first_aid_kit', MEDICATION: 'medicines', DOCUMENTS: 'document', WHISTLE: 'whistle', CLOTHES: 'raincot', PHONE: 'phone',
};
export function ItemIcon({ id }: { id: ItemId }) {
  const name = ITEM_ICON[id];
  return name && ITEM_URLS[name] ? <img className="item-icon" src={ITEM_URLS[name]} alt="" width={24} height={24} /> : <span className="item-icon blank" aria-hidden="true" />;
}

/** Esc closes; focus goes to the panel itself, never a button (a key released after E/Space must not click it). */
function useEscapeToClose() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return ref;
}

const entries = (counts: Partial<Record<ItemId, number>>) => (Object.entries(counts) as [ItemId, number][]).filter(([, n]) => n > 0);

export function InventoryPanel() {
  const ref = useEscapeToClose();
  const s = useEngineState()!;
  const missing = missingGoBagItems(s);
  return (
    <section ref={ref} tabIndex={-1} className="panel side-panel" role="dialog" aria-label="Supplies">
      <h2>Supplies</h2>
      <div className="two-col">
        <div>
          <h3>At home</h3>
          <ul className="items">{entries(s.house).map(([id, n]) => <li key={id}><ItemIcon id={id} />{ITEM_LABELS[id]}<b>{n}</b></li>)}</ul>
          {entries(s.house).length === 0 && <p className="hint">Nothing stored yet.</p>}
        </div>
        <div>
          <h3>In the go-bag</h3>
          <ul className="items">{entries(s.goBag).map(([id, n]) => <li key={id}><ItemIcon id={id} />{ITEM_LABELS[id]}<b>{n}</b></li>)}</ul>
          {entries(s.goBag).length === 0 && <p className="hint">The go-bag is empty.</p>}
          {missing.length > 0 && (<>
            <h3>Still missing from the go-bag</h3>
            <ul className="missing">{missing.map((alts) => <li key={alts.join()}>{alts.map((i) => ITEM_LABELS[i]).join(' or ')}</li>)}</ul>
          </>)}
        </div>
      </div>
      <button className="ghost" onClick={closeMenu}>Close (Esc)</button>
    </section>
  );
}

export function ObjectivesPanel() {
  const ref = useEscapeToClose();
  const s = useEngineState()!;
  const list = objectivesView(s);
  return (
    <section ref={ref} tabIndex={-1} className="panel side-panel" role="dialog" aria-label="Preparedness checklist">
      <h2>Preparedness checklist</h2>
      <p className="hint">What the debrief looks at for this household. Some items are judged when the storm arrives.</p>
      <ul className="checklist">{list.map((o) => <li key={o.id} className={o.met ? 'done' : ''}><span aria-hidden="true">{o.met ? '■' : '□'}</span> {o.text}</li>)}</ul>
      <button className="ghost" onClick={closeMenu}>Close (Esc)</button>
    </section>
  );
}

export function ShopPanel() {
  const ref = useEscapeToClose();
  const s = useEngineState()!;
  const catalog = store.engine.getShopCatalog();
  const [qty, setQty] = useState<Record<string, number>>({});
  const back = () => {
    closeMenu();
    const home = store.engine.getAvailableActions('SHOP_EXIT').find((a) => a.actionId === 'RETURN_HOME');
    if (home) runMenuAction(home);
  };
  return (
    <section ref={ref} tabIndex={-1} className="panel side-panel shop" role="dialog" aria-label="Community shop">
      <h2>Community shop</h2>
      <p className="hint">Money: ₱{s.cash.toLocaleString()}. Prices are fictional and set by the shop.</p>
      <ul className="shop-list">
        {catalog.map((c) => {
          const n = qty[c.shopItemId] ?? 1;
          return (
            <li key={c.shopItemId}>
              <ItemIcon id={c.grants.item} />
              <span className="name">{c.label}</span>
              <span className="price">₱{c.price}{c.price !== c.basePrice && <s> ₱{c.basePrice}</s>}</span>
              <span className="stock">{c.stock > 0 ? `${c.stock} left` : 'Sold out'}</span>
              <input type="number" min={1} max={Math.max(1, c.stock)} value={n} aria-label={`How many ${c.label}`}
                onChange={(e) => setQty((q) => ({ ...q, [c.shopItemId]: Math.max(1, Number(e.target.value) || 1) }))} />
              <button disabled={c.stock === 0} onClick={() => buy(c.shopItemId as ShopItemId, n)}>Buy</button>
            </li>
          );
        })}
      </ul>
      <div className="row-actions">
        <button className="ghost" onClick={closeMenu}>Keep browsing the room</button>
        <button onClick={back}>Go home</button>
      </div>
    </section>
  );
}

export function Panels() {
  const ui = useUi();
  if (ui.overlay.kind === 'inventory') return <InventoryPanel />;
  if (ui.overlay.kind === 'objectives') return <ObjectivesPanel />;
  if (ui.overlay.kind === 'shop') return <ShopPanel />;
  return null;
}
