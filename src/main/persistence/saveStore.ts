// Local JSON persistence in the app's userData folder (no cloud). Atomic writes, schema-validated reads.
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { BadgeId } from '../../shared/contracts/ids';
import { HouseholdProfile } from '../../shared/contracts/household';
import { GameState } from '../../shared/contracts/state';

const SLOT = /^[a-z0-9][a-z0-9-]{0,31}$/;
const Badges = z.object({ schemaVersion: z.literal(1), badgeIds: z.array(BadgeId) });

function checkSlot(slot: string) {
  if (!SLOT.test(slot)) throw new Error(`invalid save slot name: ${slot}`);
}

export class SaveStore {
  constructor(private readonly root: string) {}

  private async atomicWrite(file: string, data: unknown) {
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(data), 'utf8');
    await rename(tmp, file);
  }

  private async readJson(file: string): Promise<unknown | null> {
    if (!existsSync(file)) return null;
    try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
  }

  private gameFile(slot: string) { checkSlot(slot); return path.join(this.root, 'games', `${slot}.json`); }

  async writeGame(slot: string, state: GameState): Promise<void> {
    const file = this.gameFile(slot);
    await this.atomicWrite(file, GameState.parse(state));
  }

  async readGame(slot: string): Promise<GameState | null> {
    const raw = await this.readJson(this.gameFile(slot));
    const parsed = GameState.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  async listGames(): Promise<string[]> {
    const dir = path.join(this.root, 'games');
    if (!existsSync(dir)) return [];
    return (await readdir(dir)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).filter((s) => SLOT.test(s)).sort();
  }

  async deleteGame(slot: string): Promise<void> { await rm(this.gameFile(slot), { force: true }); }

  async readBadges(): Promise<string[]> {
    const parsed = Badges.safeParse(await this.readJson(path.join(this.root, 'badges.json')));
    return parsed.success ? parsed.data.badgeIds : [];
  }

  async addBadges(ids: string[]): Promise<string[]> {
    const merged = [...new Set([...(await this.readBadges()), ...ids])].sort();
    await this.atomicWrite(path.join(this.root, 'badges.json'), Badges.parse({ schemaVersion: 1, badgeIds: merged }));
    return merged;
  }

  async writeProfile(p: HouseholdProfile): Promise<void> { await this.atomicWrite(path.join(this.root, 'profile.json'), HouseholdProfile.parse(p)); }
  async readProfile(): Promise<HouseholdProfile | null> {
    const parsed = HouseholdProfile.safeParse(await this.readJson(path.join(this.root, 'profile.json')));
    return parsed.success ? parsed.data : null;
  }
  /** Privacy: the player can delete their stored household profile at any time. */
  async deleteProfile(): Promise<void> { await rm(path.join(this.root, 'profile.json'), { force: true }); }
}
