# FitQuest

FitQuest is a lightweight, mobile-friendly daily habit tracker. Users rate Sleep, Healthy Eating, Stretching, Cardio, and Strength from 0–5. Check-ins earn skill XP, unlock titles and backgrounds, and show weekly participation.

## Run locally

The app uses plain HTML, CSS, and JavaScript. No build step or npm packages are required.

1. Download or clone this repository.
2. Open a terminal in its folder.
3. Start a local web server:

```sh
python -m http.server 8000
```

4. Open http://localhost:8000 in your browser.

Use http://localhost:8000/?dev for developer mode. It previews skill and Total Levels without writing normal progress. The Total Level override is a visual preview independent of skill levels; use **Use Sum of Skill Levels** to return to the calculated total.

## File map

| File | Responsibility |
| --- | --- |
| `index.html` | Page structure, dialog containers, developer controls, and script order |
| `js/config.js` | Editable skills, titles, colours, progression settings, rewards, backgrounds, and reset settings |
| `js/progression.js` | Pure XP, level, bonus, Total Level, and reward-selection calculations |
| `js/storage.js` | Reads and validates saved progress, including compatibility with older check-in history |
| `js/fitville.js` | Check-in coordination, save handling, UI rendering, celebrations, and browser events |
| `css/fitville.css` | Layout and styling; responsive overrides are grouped at the end |
| `assets/icons/` | Local SVG icons and their licensing information |
| `tests/tracker.test.cjs` | Regression checks for the production tracker logic |
| `.github/workflows/deploy-pages.yml` | Runs checks, then deploys GitHub Pages |

The older `fitville` filenames remain valid and are intentional. Visible app branding is FitQuest.

To understand saves: start with `js/storage.js` for **reading and checking** saved data. The browser storage key (`fitville-v1`) and the save/write synchronization logic still live in `js/fitville.js`. Do not rename the key or reorder the skills array: either change could disconnect existing progress.

## Where to edit

Start with **js/config.js** for names, titles, rewards, colours, or balancing. Scripts load in this order: `config.js`, `progression.js`, `storage.js`, then `fitville.js`.

### Change a reward title

Find the entry in `totalRewards` and edit its `title`:

```js
{ level: 25, title: 'Habit Pathfinder', theme: 'rose', themeName: 'Rose' }
```

The header, next-reward message, and celebration all use this entry.

### Change a background

Edit its gradient in `themes`:

```js
rose: 'linear-gradient(145deg, #f7dce5, #fff1f5)'
```

To add a theme, give it a unique key in `themes`, then use that key in a reward's `theme`. Set `themeName` to the readable name shown in the popup. Keep reward entries sorted by increasing level.

### Change skill information

Each entry in `skills` contains its name, hint, icon, colour, regular titles, mastery title, and crown details. Regular titles unlock every seven levels; the mastery title and crown unlock at the maximum skill level.

**Do not reorder, remove, or insert skills into the skills array.** Existing saves associate progress with each array position. Change `skillDisplayOrder` to rearrange the dashboard safely. Adding a sixth skill requires a save migration and updates to validation, layout, and tests; it is not a configuration-only edit.

### Progression settings

- `maxSkillLevel`: currently 50.
- `xp.firstLevelCost`: 5 XP to reach level 2.
- `xp.costIncrease`: each subsequent level costs 1 additional XP.
- `bonusMilestones`: +1, +2, +3, and +4 XP at skill levels 10, 20, 30, and 40. The current save validator supports bonus values 0–4.
- Total Level is the sum of all five skill levels, ranging from 5–250.
- Check-ins are limited to one per skill per reset day. Completed skills offer **Edit today’s rating** until the daily reset. Corrections replace the original XP contribution, retain the original bonus, and do not replay celebrations or increase participation counts. A zero rating earns zero XP; positive ratings receive the bonus earned by the skill level before that check-in.

Each skill needs 1,421 total XP to reach level 50. Perfect daily check-ins with the current bonuses take 191 days. Changes to XP settings recalculate levels from existing saved XP; review that effect before deploying.

Changing the maximum level also requires checking title counts, Total Level reward milestones, developer input limits in `index.html`, and regression expectations.

### Reset settings

`dailyReset.utcHour` and `utcMinute` define the reset boundary; `label` is its display text. Keep the label consistent with the configured time. The current reset is fixed at 09:30 UTC: 03:30 CST (UTC−6) year-round. It does not follow daylight saving time.

## Run automated checks

Install Node.js 22 or newer, then run these commands from the repository folder:

```sh
node --check js/config.js
node --check js/progression.js
node --check js/storage.js
node --check js/fitville.js
node --test tests/tracker.test.cjs
```

Checks cover XP thresholds, Total Levels, rewards, duplicate check-ins, reset boundaries, weekly counts, bonus XP, completion messages, save validation, and configuration consistency.

Progression tests import `createProgression(config)` from `js/progression.js` directly. Its functions do not depend on a browser, storage, or mutable tracker state. Integration tests load the production configuration, progression module, storage module, and tracker code in an isolated environment. The tests are grouped by topic and each `test('description', ...)` states the behavior it expects. `assert.equal` checks an exact value; `assert.throws` checks that invalid data is rejected. The tracker exposes a small test-only hook (`__fitQuestTestHook`) when the isolated test environment provides it. This avoids rewriting application source code. In normal browser use, the hook is absent and startup proceeds normally. As the application is split into modules, prefer direct module tests over adding more test hooks.

GitHub runs checks on pushes to main and on pull requests. Deployment depends on successful checks; pull requests do not deploy. These logic checks do not replace phone-screen visual testing.

## Save compatibility

Progress is stored in the current browser, not in a shared account. Use the backup controls in Settings to move it between browsers or devices.

Preserve the `fitville-v1` storage key, developer-session keys, and the existing synchronization identifier. Legacy fields such as `coins`, `bank`, `last`, `tier`, and historical `rates` remain for compatibility. Do not delete them until a migration can safely read and upgrade older saves.

Both normal loading and backup imports use `readSave()` in `js/fitville.js`. Update this shared validator when changing the save format, and add valid, legacy, and malformed-save tests.

## Before publishing a change

Run the automated checks and preview the normal dashboard and developer mode. Test the check-in and celebration dialogs on a small screen. If you change an asset, update its version suffix in `index.html` so browsers request the new file.

Future refactoring should separate storage, UI, and developer tools while retaining behaviour and save compatibility.

## Progression module

Create a calculator from the configuration and pass data into its functions:

```js
const { createProgression } = require('./js/progression.js');
const progression = createProgression(config);
const skillLevel = progression.levelForXP(81); // 10
const earnedXP = progression.experienceForCheckIn(5, skillLevel); // 6
const totalLevel = progression.calculateTotalLevel([
  { xp: 81 }, { xp: 0 }, { xp: 0 }, { xp: 0 }, { xp: 0 },
]); // 14
```

In the browser, use `FitQuestProgression.createProgression(FitQuestConfig)`. Each calculator uses the provided configuration. Changing progression formulas belongs in this module; editable values remain in `config.js`. Award XP using the skill level before the check-in.
