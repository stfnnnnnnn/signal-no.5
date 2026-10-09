# Content and Educational Review

**Audience:** content reviewers (preferably someone checking against official Philippine guidance), the backend owner, and frontend developers who need copy.

**Status, 2026-10-09:**
- **Nothing in this file has been applied to the code.** Every change below is a *proposal*.
- Rules, scoring and game content stay exactly as committed until a proposal is approved.
- All gameplay safety text is still **placeholder wording pending review** against official sources: PAGASA (weather), NDRRMC/OCD (disaster risk), DOH (health), Philippine Red Cross (preparedness), and the local LGU/MDRRMO/barangay.

**Reviewer task:** for each row, mark *keep*, *change to…*, or *remove*, and cite the source you checked. Text is edited only in `src/core/content/*`. Every action carries a `safetyRuleId`, so wording can change without touching rules.

---

## 1. Items that need validation against official guidance

| # | Location | Current text / value | Why it needs validation |
|---|---|---|---|
| C1 | Water target, `selectors.waterRequirement`; B03 hint "Store 12 L per household member early" | 12 L per person (= 4 L/day × 3 days) | Common international baseline. Confirm against current PH preparedness material (e.g. the DOH/PRC go-bag lists). Changing it is a **rule** change |
| C2 | Food target | 3 person-days of ready-to-eat food | Same as C1 |
| C3 | Go-bag categories (`F_GO_BAG` checklist) | "water, food, light, first aid, documents, clothing and hygiene items" | Compare with the official "Go Bag" checklist the team will cite. Adding a category is a **rule** change |
| C4 | `F_HAZARD_RESPONSE` lesson | "Stay indoors in the safest room and seek official help if needed." | Correct direction, but don't name a specific room type or claim a structure is safe. Keep it generic |
| C5 | `F_UNSAFE_ACTION` / EV10 `GO_OUTSIDE_TO_CHECK` | "Do not go outside during a typhoon to check on conditions." | Matches standard advice. Keep; confirm wording |
| C6 | B10 hint | "Arrange roof preparation early; never on the roof in a storm." | Roof work is a fall risk even before a storm. **Proposal:** "Have roof repairs done early by someone able to do them safely; never go on the roof once winds pick up." |
| C7 | B06 Bayanihan text; `SHARE_VERIFIED_ADVISORY` and `HELP_COMMUNITY_PREPARATION` labels; EV12__COMMUNITY | "Share the verified official advisory with neighbours"; "Help neighbours with the community preparedness activity"; "Neighbours are getting ready together. You can help while it is still safe outside, once your own preparations are on track." | **New wording (2026-10-10), needs review.** It deliberately avoids: entering floodwater, rescues, going next door after the advisory, sharing unverified messages, giving away household supplies, and any official registration or assistance procedure. Confirm that "community preparedness activity" (e.g. tying down shared loose items, clearing shared drains) matches what barangays actually organise, and that it's safe to recommend doing it *before* heavy rain |
| C8 | `F_MEDICATION` / `F_MEDICAL_CHECK` / B04 | "…ask a health professional about continuity", "get one refill if needed" | Good: no dosages or medication names. Confirm that "one refill" isn't read as advice. **Proposal for the B04 hint:** "Check the medicine cabinet early and prepare what's needed, as advised by a health professional." |
| C9 | `F_POWERED_EQUIPMENT` | "Plan backup power for essential equipment." | Must not imply that the game gives medical-device guidance. **Proposal:** add "…and ask the equipment provider or a health professional what to do during outages." |
| C10 | Fictional advisories: EV01, EV06, EV08, EV15 | e.g. "Fictional advisory: an evacuation advisory has been issued for your area." | Fine as long as "fictional" stays visible. **Never** show PAGASA signal numbers, logos or real bulletin formats. The UI must keep the "fictional" label (blueprint §8) |
| C11 | EV07 dam rumor | "A message is going around saying a dam will be opened tonight…" | Good misinformation lesson. Make sure the debrief doesn't name a real dam (it doesn't). Keep |
| C12 | Wellbeing rule reasons (`src/core/wellbeing.ts`) | "Stayed home after an applicable evacuation advisory, and the home flooded severely." / "Stayed in a room the scenario marked as unsafe." | Fictional indicator. Make sure the UI never calls it "health" and never shows injury imagery (UI_GAMEPLAY_REQUIREMENTS §14) |
| C13 | Exposure descriptions (`EXPOSURE_PROFILES`) | e.g. "Low-lying (fictional): faster flood escalation and an earlier advisory." | Fictional difficulty. Make sure no flood depths are shown and there's no implication about the player's real home |
| C14 | `F_LATE_PURCHASE` | "Prices and availability can get worse as a storm gets closer; buy supplies early." | Reasonable. Keep; avoid implying price gouging is legal or illegal |
| C15 | `F_DESTINATION` / B11 | "Find out where your designated evacuation center is." | Correct. Must not name real centers or routes (the backend doesn't) |

## 2. Community assistance (Bayanihan) wording

The former named neighbour character, her dialogue and the "register for official assistance" action were **removed** on 2026-10-10 (`01eaf7f`). Old saves and progress are migrated (`src/core/migrations.ts`). Bayanihan now comes from two safe, engine-validated actions with no new character:

| Where | Current text | Safety notes / review |
|---|---|---|
| `SHARE_VERIFIED_ADVISORY` (phone) | Label "Share the verified official advisory with neighbours"; disabled reason "Check official information first; only verified information should be shared."; late reason "It is too late to send updates now; keep the phone for your household." | Encourages verified-only sharing and keeping the phone charged for the household. Review wording |
| `HELP_COMMUNITY_PREPARATION` (front door) | Label "Help neighbours with the community preparedness activity"; reasons "Follow the evacuation advisory now; community activities have stopped.", "Not enough time to finish safely before conditions worsen.", "Conditions outside are no longer safe for this task." | Only before heavy rain or the advisory; never a rescue; doesn't use household supplies. Review C7 |
| EV12__COMMUNITY fallback | "Neighbours are getting ready together. You can help while it is still safe outside, once your own preparations are on track." / "Neighbours tie down loose items along the street." | Puts household readiness first. Spoken by a household member, or by the generic `NPC_NEIGHBOR` voice for single-person households |
| EV12__COMMUNITY AI facts | "Neighbours are preparing for the storm together." · "Helping is optional and only while it is still safe outside." · "Only verified official information should be shared." | Grounds the local AI; it can't invent procedures or characters (allowed speakers and actions are fixed) |
| B06 description / hint | "Helped the community safely: shared verified official information or joined a community preparedness activity while it was still safe." / "After checking official information, share it from the phone, or help with the community activity at the front door before heavy rain." | Matches the rule |
| A08 description | "Complete a Bayanihan community-assistance action in five different completed runs." | Neutral |

**Proposed result copy for the frontend** (BK-3; wording only, no rules): after sharing, "You shared the verified advisory. Neighbours now know where to find official updates." After helping, "You helped neighbours secure shared areas before the weather turned." Neither should promise outcomes for other households.

## 3. Badge, achievement and lesson text

- **Badges B01–B12** (`src/core/content/badges.ts`):
  - Descriptions accurately match the rules (checked against `src/core/evaluation/badges.ts`).
  - Only C6, C7 (new community wording) and C8 need wording review.
  - **B01 Handa** says "at least 85% wellbeing and every applicable critical preparedness requirement". That's correct, and it's a *different thing* from the **Handa ending** (score ≥ 85). Keep the two separate in UI copy.
- **Achievements A01–A10** (`src/core/content/achievements.ts`):
  - These are neutral progress text with no safety claims, so no review is needed.
  - A03 ("all 26 lessons") requires varied households to complete. Consider adding a hint saying so.
- **Findings** (`src/core/content/findings.ts`): 27 entries, all marked placeholder. Items C1–C9 and C14–C15 above are the ones with factual claims. The rest are generic preparedness statements.

## 4. Preparedness feedback (discovery results)

The backend provides **data, not sentences**, for discovery interactions (gap BK-3). Proposed frontend templates, with no new rules:

| Interaction | Data | Proposed copy |
|---|---|---|
| `INSPECT_GO_BAG` | `missingGoBagItems(state)` + `ITEM_LABELS` | "Your go-bag is missing: {labels}." / "Your go-bag has every category it needs." |
| `INSPECT_SUPPLIES` (kitchen/shelf) | `state.house.WATER`, `waterRequirement(profile)`, food vs `profile.size × 3` | "Water: {have} L of {target} L. Food: {have} of {target} person-days." |
| `CHECK_ESSENTIAL_SUPPLIES` | `state.flags.MEDICAL_SUPPLIES_CHECKED`, the profile's medical needs | "You checked the medicine cabinet." Never list conditions or medication names |

## 5. Corrections already made in documentation (not content)

- Removed the stale "26-question survey", `q3Mode: 'fictional'`, `familySurvey()` and `BADGES` (B01–B10) references from the frontend docs. They now point to onboarding v2, `tests/fixtures/onboarding.ts` and `getBadgeCatalog()` (B01–B12).
- No game text was changed.
