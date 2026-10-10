import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { AchievementsScreen } from '../../src/renderer/ui/achievements/AchievementsScreen';
import { ACHIEVEMENT_CATALOG } from '../../src/core/content/achievements';
import { BADGE_CATALOG } from '../../src/core/content/badges';

it('achievements screen lists all 10 achievements and all 12 badges from the backend catalogs', () => {
  const h = renderToStaticMarkup(createElement(AchievementsScreen));
  for (const a of ACHIEVEMENT_CATALOG) expect(h).toContain(a.name);
  for (const b of BADGE_CATALOG) expect(h).toContain(b.name);
  expect(h).toContain('Loading your progress');
  expect(h).not.toMatch(/autofocus/i); // a bottom button with focus would open the screen scrolled down
  expect(h).toMatch(/tabindex="-1"/);
});
