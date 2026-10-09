import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SaveStore } from '../../src/main/persistence/saveStore';
import { newGame } from '../helpers';

const store = () => new SaveStore(mkdtempSync(join(tmpdir(), 'signalno5-save-')));

describe('SaveStore', () => {
  it('writes and reads back a validated game state', async () => {
    const s = store();
    const st = newGame().getState();
    await s.writeGame('slot-1', st);
    expect(await s.readGame('slot-1')).toEqual(st);
    expect(await s.listGames()).toEqual(['slot-1']);
  });

  it('returns null for a missing slot', async () => {
    expect(await store().readGame('nothing')).toBeNull();
  });

  it('rejects unsafe slot names (no path traversal)', async () => {
    const s = store();
    await expect(s.writeGame('../../evil', newGame().getState())).rejects.toThrow(/slot/i);
    await expect(s.readGame('a/b')).rejects.toThrow(/slot/i);
  });

  it('refuses to write invalid state', async () => {
    await expect(store().writeGame('x', { schemaVersion: 2 } as never)).rejects.toThrow();
  });

  it('treats a corrupted save file as missing instead of crashing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'signalno5-save-'));
    const s = new SaveStore(dir);
    await s.writeGame('ok', newGame().getState());
    writeFileSync(join(dir, 'games', 'ok.json'), '{"broken":');
    expect(await s.readGame('ok')).toBeNull();
  });

  it('writes atomically (no temp files left behind)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'signalno5-save-'));
    const s = new SaveStore(dir);
    await s.writeGame('a', newGame().getState());
    expect(readdirSync(join(dir, 'games'))).toEqual(['a.json']);
  });

  it('deletes a slot', async () => {
    const s = store();
    await s.writeGame('a', newGame().getState());
    await s.deleteGame('a');
    expect(await s.readGame('a')).toBeNull();
  });

  it('persists earned badges across runs and merges new ones', async () => {
    const s = store();
    await s.addBadges(['B01', 'B05']);
    await s.addBadges(['B05', 'B07']);
    expect(await s.readBadges()).toEqual(['B01', 'B05', 'B07']);
  });

  it('stores and deletes the household profile (privacy: user-controlled retention)', async () => {
    const s = store();
    const p = newGame().getProfile();
    await s.writeProfile(p);
    expect(await s.readProfile()).toEqual(p);
    await s.deleteProfile();
    expect(await s.readProfile()).toBeNull();
  });
});
