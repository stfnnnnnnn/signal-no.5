import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/renderer/state/appStore';
import { Title } from '../../src/renderer/ui/screens/Title';
import { ModeSelect } from '../../src/renderer/ui/onboarding/ModeSelect';
import { OnboardingFlow } from '../../src/renderer/ui/onboarding/OnboardingFlow';
import { Customize } from '../../src/renderer/ui/onboarding/Customize';
import { emptyRandom } from '../../src/renderer/ui/onboarding/onboardingModel';

const html = (c: unknown, props: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(c as never, props as never));
beforeEach(() => { app.setup = null; });

describe('M5 screens render from real data', () => {
  it('title: no Continue until a save is known', () => {
    const h = html(Title);
    expect(h).toContain('New game');
    expect(h).not.toContain('Continue');
  });
  it('title: the logo artwork is the heading, named for screen readers', () => {
    const h = html(Title);
    expect(h).toMatch(/<h1[^>]*><img[^>]*class="title-logo"[^>]*>/);
    expect(h).toMatch(/<img[^>]*alt="Signal No\. 5"/);
    expect(h).not.toContain('signal-five');
  });
  it('Q0 shows the exact backend labels and details', () => {
    const h = html(ModeSelect);
    expect(h).toContain('Customize My Household');
    expect(h).toContain('Randomize My Household');
    expect(h).toContain('Generate a fictional household');
  });
  it('custom path starts at Q1 with the three house types and no apartment/condominium', () => {
    const h = html(OnboardingFlow, { path: 'custom' });
    expect(h).toContain('What type of house best represents your household?');
    expect(h).toContain('Multi-story house (three or more floors)');
    expect(h).not.toMatch(/apartment|condo/i);
  });
  it('review step previews the generated household from the real engine', () => {
    app.prepare('random', { ...emptyRandom(), r1SizeRange: '3-4', r2PlayerAge: 'age36to59', r3OtherAgeGroups: ['surprise'] }, 42);
    const h = html(Customize);
    expect(h).toContain('Your household');
    expect(h).toContain('(you)');
    expect(h).toMatch(/₱[\d,]+/);
    expect(h).toContain('(fictional)');
    expect(h).toContain('Generate another household');
  });
  it('review step lists backend issues and offers to fix them', () => {
    app.prepare('custom', { q1Housing: 'singleStory', q2SizeRange: '3-4', q2ExactSize: 4, q3AgeCounts: { age0to4: 0, age5to12: 0, age13to17: 0, age18to35: 1, age36to59: 0, age60plus: 0 },
      q4Assistance: 'no', q5MedicalSupplies: 'no', q6Surroundings: ['neither'], q7Pets: 'no', q8Preparedness: 'none' }, 1);
    const h = html(Customize);
    expect(h).toContain('Some answers need another look');
    expect(h).toContain('add up to 1, household size is 4');
  });
});
