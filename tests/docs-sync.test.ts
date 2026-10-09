// Frontend-facing docs must not ask for the removed neighbour NPC (historical notes live only in migration docs).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ACTIVE_DOCS = [
  'docs/frontend/FRONTEND_IMPLEMENTATION_BLUEPRINT.md', 'docs/frontend/FRONTEND_HANDOFF.md', 'docs/frontend/FRONTEND_BACKEND_INTEGRATION.md',
  'docs/frontend/UI_GAMEPLAY_REQUIREMENTS.md', 'docs/frontend/FRONTEND_GETTING_STARTED.md', 'docs/frontend/README.md',
  'docs/implementation/FRONTEND_BACKEND_CONTRACTS.md', 'docs/setup/LOCAL_STORAGE_SETUP.md',
];

describe('frontend docs after the Bayanihan revision', () => {
  it('request no asset, interaction, dialogue or event UI for the removed neighbour NPC', () => {
    for (const doc of ACTIVE_DOCS) expect(readFileSync(doc, 'utf8'), doc).not.toMatch(/nena|EV12__NEIGHBOR/i);
  });
  it('document both qualifying community actions and the badgeEarned event', () => {
    const bp = readFileSync('docs/frontend/FRONTEND_IMPLEMENTATION_BLUEPRINT.md', 'utf8');
    for (const id of ['SHARE_VERIFIED_ADVISORY', 'HELP_COMMUNITY_PREPARATION', 'badgeEarned', 'routeClosureMinute', 'householdLocation']) expect(bp).toContain(id);
  });
});
