# UI and Gameplay Requirements (frontend)

Derived from the three specs in [`docs/specs/`](../specs/): **GD** = Complete Game Design v3.0, **HF** = Household Configuration Form, **GS** = Game Settings v2.0. Where they disagree, [SPEC_RECONCILIATION.md](../implementation/SPEC_RECONCILIATION.md) decides.

**Legend:**
- **MVP:** required for the demo.
- **Optional:** polish or stretch.
- Backend hooks name the real API ([integration reference](FRONTEND_BACKEND_INTEGRATION.md)).

## 1. Scenes (GD §5)

| Scene ID | MVP | What the player sees | Backend hook |
|---|---|---|---|
| TITLE | MVP | Start / Continue / Settings | `save.list()`, `ai.status()` |
| ONBOARDING | MVP | Q0 mode, then 8 custom questions or 4 random steps (§13) | `ONBOARDING_QUESTIONS`, `createGame()` → `error.issues` |
| CUSTOMIZATION | MVP | Theme, player character, appearance, minimum-budget challenge; configuration review | `getProfile()`, `getWorldConfig()` |
| HOUSE | MVP | Explorable fixed-layout house | `interact`, `executeAction`, `tick` |
| SHOP | MVP | Small community shop with shopkeeper and shelves | `getShopCatalog`, `purchase`, `RETURN_HOME` |
| STREET | MVP (simple) | Shown while travelling to evacuation (`scene === 'STREET'`). Can be a short transition | `skipToNextMilestone()` |
| EVACUATION | MVP | Simplified evacuation center (arrival EV11, staying through impact) | events EV10–EV13 |
| HOME_IMPACT | MVP | The house during the storm (darker, rain, wind, flood overlay) | `environment.*`, EV10/EV13 |
| AFTERMATH | MVP | Recovery days 1–3 | EV14–EV16, `aftermathDay` |
| RESULTS | MVP | Debrief, score, badges, replay | `engine.evaluate()`, `narrateDebrief`, `achievements.recordRun` |
| BARANGAY | Optional | Information point (the action exists; no scene in the backend, gap G4) | `BARANGAY_VISIT` |

## 2. Characters (GD §4, HF Q25)

- **MVP:**
  - Four reusable base sprites: **Boy, Girl, Mom, Dad** (`spriteBase`: `boy | girl | mom | dad`). These are visual templates, not family relationships.
  - Clothing variants `clothingVariant` 0–3 and `paletteId`, both from `getWorldConfig().characters`. `paletteId === 'custom'` means use `profile.appearance.clothingColor`.
  - Up to **3 visible household NPCs** (`visibleNpc`, with `npcId`). Infants and toddlers are `dependent: true`; show them as a dependent character (e.g. held or in a crib), never as a walking NPC.
  - Other NPCs: shopkeeper and evacuation-center staff (`NPC_CENTER_STAFF`). `NPC_NEIGHBOR` is a dialogue voice only (no sprite). There is no neighbour character to visit.
  - Idle and walk animations in 4 directions.
- **Optional:** hairstyle variations, emotes, item-pickup animation.
- **Never** use sex or age to imply capability. The backend doesn't, either.

## 3. House, tiles and collision (GD §5, GS §17)

- **MVP:**
  - One fixed floor plan (`layoutId: 'house_fixed_v1'`) used for every household.
  - Areas: living room, kitchen, bedroom, utility area, entrance, stairs, windows.
  - **16×16 px tiles**, a crisp pixel-art look (nearest-neighbor scaling, integer zoom), internal resolution 320×180 or 384×216 (project_context §8).
  - A collision layer that never changes between themes or households.
  - Every interactable from `getWorldConfig().interactables` is placed and reachable.
- **Themes (`customization.theme`):**
  - **Modern Filipino:** contemporary furniture, tiled floors, neutral or cool palette.
  - **Traditional Filipino:** wood textures, warmer palette, traditional furnishings.
  - The same geometry, collision and interaction points for both. Only skins and decorative props change.
- **Optional:** decorative props at fixed anchor points, a multi-floor visual cue (stairs) when `household.housing.floors > 1`.

## 4. Movement and interaction (GD §5)

| Setting | Value |
|---|---|
| Movement | Four directions, no diagonals (MVP) |
| Speed | 90 px/s (unaffected by the clock speed) |
| Interaction range | 24 px, with a visible prompt |
| Keys | WASD / arrow keys to move, **E / Space** to interact |
| Camera | Fixed or room-following |

On interact, call `engine.interact(id)`. Then either open the event dialog or show the returned `actions` as a menu: label, time cost in game minutes, disabled with `reasons` when unavailable.

## 5. Dialogue and choices (GD §2 core loop, §16)

- **MVP:**
  - A dialogue panel with the speaker, `dialogue` and `description`.
  - An **"AI-personalized"** tag when `content.source === 'ai'`.
  - A short loading state while text generates. The clock is already paused by the event.
  - Choice buttons from `getEventChoices()`, **in the given order**. Disable unavailable choices and show their `reasons`. Mark `unsafe` choices (e.g. "Go outside to look") with a warning style.
- **Never** show AI text as official advice. Advisories in the game are fictional scenario data.

## 6. Inventory and go-bag (GD §6)

- **MVP:** two lists, **At home** (`state.house`) and **Go-bag** (`state.goBag`); units are L for water and person-days for food. A go-bag status indicator from `getGoBagStatus()`.
- Moving items: the backend currently packs via the `PACK_GO_BAG`, `PACK_MEDICATION`, `PREPARE_PET_SUPPLIES` and `PREPARE_CHILD_SUPPLIES` actions. There's no per-item drag and drop (GD §6 lists add/remove item; gap, raise it if needed).

## 7. Shop (GD §7)

- **MVP:**
  - Purchase UI at `SHOP_COUNTER`, built from `getShopCatalog()`: label, current `price` (shows ×1.5 after hour 24), `stock`, `affordable`.
  - A quantity picker, then `purchase()`.
  - Errors shown from `error.message`: out of stock, insufficient funds.
  - Cash is shown in the HUD.
- The trip takes 1 h each way (`SHOP_TRIP` / `RETURN_HOME`). Show that the clock advanced.

## 8. Clock and speed HUD (GD §3)

- **MVP:**
  - Game time (day and hour from `clock.gameMinutes`).
  - Phase.
  - Speed buttons **1× 2× 4× 8× 16× 32×** (`setSpeed`), with the current speed highlighted.
  - Show when the speed is forced back to 1× (`speedChanged`, `reason: 'critical'`).
  - A "paused" indicator when `clock.pauseReasons` isn't empty.
- **Landfall countdown:** show it only after `environment.landfallRevealed` (hour 24); before that, the expected landfall is 48 h.
- Call `pause('menu')` for menus and `pause('focusLost')` on window blur, with the matching `resume`.
- **Optional:** a speed tooltip ("8 game hours per real minute at 32×").

## 9. Storm effects (GD §9, §12)

**Render storm visuals from the `SceneDirective`** (`engine.getSceneDirective()`, optionally merged with an AI suggestion). It already maps the state below into weather, lighting, flood overlay, effects, props, NPC cues, audio and mood presets. Every preset and asset ID the frontend must provide is listed in [FRONTEND_BACKEND_CONTRACTS.md](../implementation/FRONTEND_BACKEND_CONTRACTS.md#asset-ids-the-frontend-must-provide). The raw state, for reference:

| State (`environment.*`) | MVP visual |
|---|---|
| `weatherState`: clear / rain / heavyRain / typhoon | Rain overlay intensity; darker lighting at typhoon |
| `windSeverity` | Wind sway or debris particles |
| `floodSeverity`: none / low / moderate / severe | Exterior water overlay that grows with severity. Never animate the player entering water |
| `powerAvailable: false` | Dim the lights (and use flashlight light if `BACKUP_LIGHTING_USED`) |
| `roadStatus`, `shopOpen` | Show closed or blocked exits as unavailable (the backend already rejects them) |

- Warnings must not rely on colour alone: add an icon and a text label.
- **Optional:** thunder flashes, screen shake, ambient storm audio with a mute toggle.

## 10. Evacuation (GD §11)

- **MVP:**
  - The EV08 advisory dialog with choices.
  - "Leave for the evacuation destination" is disabled with a reason until assistance is arranged (households that need help).
  - After departure: the `STREET` transition and a "Continue" (`skipToNextMilestone`) control, then arrival at `EVACUATION` (EV11). A household still travelling at landfall stays on `STREET`; departures too late to arrive before the route closes are disabled with the engine's reason.
- The backend owns the destination, route and travel time. Don't add routes or maps.

## 11. Aftermath (GD §13)

- **MVP:** a day indicator (`aftermathDay` 1–3), events EV14–EV16, and a "Continue to next day" control (`skipToNextMilestone`). Show remaining water and food against the household's needs (EV14 facts).

## 12. Debrief and achievements (GD §14–15)

- **MVP:**
  - Score (0–100) and ending: **Handa** (≥ 85), **Nakaraos** (≥ 60), **Nahirapan**. Plus a Na-rescue narrative note when `rescueOutcome`.
  - Six competency bars from `categories[]`. Hide excluded categories (`included: false`).
  - Decision timeline (`timeline[]`) and strengths/gaps with lesson text (`learningPoints`).
  - Household checklist (`checklistItems`) and the AI or fallback summary (`narrateDebrief`).
  - Badge gallery B01–B12 (names from `engine.getBadgeCatalog()`), showing this run's statuses and lifetime badges (`badges.read()`). See §12b.
  - Replay options: same household (`startRun`) or a new household (`createGame`).
- **Optional:** badge unlock animations, printable checklist.

## 12b. Badges, Handa and achievements (revised)

- **MVP:**
  - All 12 badges from `engine.getBadgeCatalog()`, each with a status from `ev.badges`. Show *Not applicable* neutrally; it's never a failure.
  - A Handa breakdown: wellbeing % vs **85%**, critical competencies, gaps and `reasons`.
  - The **ending label and the Handa badge shown separately**.
  - A player wellbeing meter (not "health").
  - An achievements screen (`achievements.read()`) with progress bars (`progress`/`target`) and unlock toasts from `recordRun().newlyUnlocked`.
- Call `achievements.markPlanViewed(runId)` when the personalized plan or checklist is displayed.
- **Bayanihan (B06):** the phone menu offers "Share the verified official advisory with neighbours" and the front door offers "Help neighbours with the community preparedness activity" (also in EV12). Show them like any action (time cost, disabled with reasons), and a badge toast on `badgeEarned`. Never present them as mandatory or as rescues.
- **Whole Barangay (A08):** progress n/5 on the achievements screen.

## 13. Onboarding UI (onboarding v2; supersedes the 26-question survey)

- **MVP:**
  - Q0 mode choice, then 8 custom questions or 4 random steps, rendered from `ONBOARDING_QUESTIONS`.
  - The Q2b exact-size picker (max 10) and the Q3 age counters, with a live total.
  - Q6 multi-select with exclusive options.
  - R3 skipped for 1 person; R4 skippable.
  - Customization: theme, player, appearance, and a "minimum budget challenge" toggle.
  - The game takes over from here: it assesses preparedness through interactions, not more questions.

## 13-legacy. Survey UI (HF, deprecated)

- **MVP:**
  - All 26 questions with the HF wording and options, and "Prefer not to say" where HF provides it.
  - Conditional fields: Q4 count, Q5 animals, Q13 only if Q12 = yes, Q15 categories only if Q15 = yes, Q25 colour only for custom.
  - A live total check for the Q2 age grid against the Q1 range.
  - Show backend `issues` next to fields.
  - A "Generate a fictional household" path (Q3).
  - The privacy notice (HF intro).
  - A review screen before starting.
- Section III (medical) must stay optional and must never ask for diagnoses or medication names.

## 14. Accessibility and mood (project_context §8)

- **MVP:** readable pixel font with a fallback, large click and touch targets, high contrast, non-colour warning cues, mute control. The tone stays calm and empathetic, with no graphic injuries.
