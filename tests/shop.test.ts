import { describe, expect, it } from 'vitest';
import type { GameEngine } from '../src/core/engine';
import { aloneSurvey, familySurvey } from './fixtures/households';
import { minutes, newGame, resolveFirst } from './helpers';

const water = (e: GameEngine) => (e.getState().house.WATER ?? 0) + (e.getState().goBag.WATER ?? 0);
function atShop(s = familySurvey()) {
  const e = newGame(s); e.resolveEvent('DEFER');
  const r = e.executeAction('SHOP_TRIP');
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return e;
}

describe('shop trip', () => {
  it('costs two simulated hours for the round trip', () => {
    const e = atShop();
    expect(e.getState().scene).toBe('SHOP');
    expect(e.executeAction('RETURN_HOME').ok).toBe(true);
    expect(minutes(e)).toBe(120);
    expect(e.getState().scene).toBe('HOUSE');
    expect(e.getState().shop.visitCount).toBe(1);
  });

  it('offers the shop counter and exit only inside the shop', () => {
    const e = atShop();
    expect(e.getAvailableActions().map((a) => a.actionId)).toEqual(['RETURN_HOME']);
  });
});

describe('shop catalog for the UI', () => {
  it('lists only stocked items with engine-computed current prices and stock', () => {
    const e = atShop(aloneSurvey());
    const cat = e.getShopCatalog();
    expect(cat.some((i) => i.shopItemId === 'PET_SUPPLIES')).toBe(false);
    const jug = cat.find((i) => i.shopItemId === 'WATER_JUG')!;
    expect(jug).toMatchObject({ label: 'Water jug (20 L)', basePrice: 100, price: 100, stock: 6, grants: { item: 'WATER', quantity: 20 }, affordable: true });
    e.purchase('WATER_JUG', 1);
    expect(e.getShopCatalog().find((i) => i.shopItemId === 'WATER_JUG')!.stock).toBe(5);
  });

  it('marks items the household cannot afford', () => {
    const e = atShop(); // ₱800
    expect(e.getShopCatalog().find((i) => i.shopItemId === 'POWER_BANK')!.affordable).toBe(true);
    e.purchase('POWER_BANK', 1); // ₱350 left
    expect(e.getShopCatalog().find((i) => i.shopItemId === 'POWER_BANK')!.affordable).toBe(false);
  });
});

describe('purchasing', () => {
  it('updates cash, inventory, stock and history together', () => {
    const e = atShop();
    const cash = e.getState().cash;
    const w = water(e);
    const stock = e.getState().shop.stock.WATER_JUG!;
    const r = e.purchase('WATER_JUG', 2);
    expect(r.ok).toBe(true);
    const st = e.getState();
    expect(st.cash).toBe(cash - 200);
    expect(water(e)).toBe(w + 40);
    expect(st.shop.stock.WATER_JUG).toBe(stock - 2);
    expect(st.shop.purchases).toEqual([{ shopItemId: 'WATER_JUG', quantity: 2, unitPrice: 100, atMinute: 60 }]);
    expect(st.shop.totalSpent).toBe(200);
  });

  it('rejects a purchase with insufficient funds and leaves state unchanged', () => {
    const e = atShop(); // limited budget ₱800
    const before = e.getState();
    const r = e.purchase('POWER_BANK', 2); // ₱900
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INSUFFICIENT_FUNDS');
    expect(e.getState()).toEqual(before);
  });

  it('rejects quantities beyond stock', () => {
    const e = atShop(aloneSurvey());
    const r = e.purchase('FLASHLIGHT', 4);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('OUT_OF_STOCK');
  });

  it('rejects invalid quantities', () => {
    const e = atShop();
    for (const q of [0, -1, 1.5]) {
      const r = e.purchase('FOOD_PACK', q);
      expect(r.ok).toBe(false);
    }
  });

  it('rejects purchases outside the shop', () => {
    const e = newGame(); e.resolveEvent('DEFER');
    const r = e.purchase('WATER_JUG', 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_IN_SHOP');
  });

  it('only stocks household-relevant items', () => {
    const alone = atShop(aloneSurvey());
    const r = alone.purchase('PET_SUPPLIES', 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNKNOWN_ITEM');
    expect(atShop().purchase('PET_SUPPLIES', 1).ok).toBe(true);
  });

  it('applies the late price after hour 24 and records the finding', () => {
    const e = newGame(aloneSurvey()); e.resolveEvent('DEFER');
    e.setSpeed(32);
    while (minutes(e) < 24 * 60) {
      if (e.getState().activeEvent) { resolveFirst(e, ['DEFER']); continue; }
      e.tick(60_000);
    }
    if (e.getState().activeEvent) resolveFirst(e, ['DEFER']);
    expect(e.executeAction('SHOP_TRIP').ok).toBe(true);
    expect(e.priceOf('WATER_JUG')).toBe(150);
    expect(e.purchase('WATER_JUG', 1).ok).toBe(true);
    expect(e.getState().flags.BOUGHT_AFTER_PRICE_INCREASE).toBe(true);
  });

  it('closes the shop late in the preparation window', () => {
    const e = newGame(aloneSurvey()); e.resolveEvent('DEFER');
    e.setSpeed(32);
    while (e.getState().environment.shopOpen) {
      if (e.getState().activeEvent) { resolveFirst(e, ['DEFER']); continue; }
      e.tick(2_000); // ~16 game minutes per tick at 32×
    }
    if (e.getState().activeEvent) resolveFirst(e, ['DEFER']);
    expect(e.getState().scene).toBe('HOUSE');
    const opt = e.getAvailableActions('ENTRANCE_DOOR').find((a) => a.actionId === 'SHOP_TRIP')!;
    expect(opt.available).toBe(false);
  });
});
