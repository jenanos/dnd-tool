# Eventide — Combat Companion

A small, fast attack-and-damage roller for **Elias Dawnridge**, level 9 Battle Master Fighter
(Dungeons of Drakkenheim, D&D 2024 rules plus our table's house rules).

Open it, press **Roll to Hit**, call the number, press **Roll Damage**, call the number.

```sh
npm install
npm run dev       # local dev server
npm test          # rules engine tests (Vitest)
npm run build     # static site in dist/ — host anywhere (relative paths, works from a sub-folder)
```

The production build registers a small service worker and a web manifest, so on a phone you can
"Add to Home Screen" and it works offline.

## Using it

| Step | What you do |
|---|---|
| Ready | Pick a weapon (Eventide Frost is the default). Set Normal / Advantage / Disadvantage. |
| Roll to Hit | Big total, e.g. **24 TO HIT**, with `d20 (14) + 10` underneath. A natural 20 is automatically a critical hit (**Can't be crit** cancels it for crit-immune targets). A natural 1 is automatically a miss (**Ignore natural 1** turns it back into an ordinary roll). |
| DM says miss | **Precision Attack** adds 1d8 to the same roll (no new d20), or press **Miss**. Eventide Frost shows **5 SLASHING — GRAZE**. |
| DM says hit | Optionally choose **Trip** or **Menacing**, then **Roll Damage**. The total is shown with a Slashing / Cold / Piercing breakdown and any save DCs. |
| Next | **Next Attack** rolls again while the turn has attacks left. After that the big button becomes **New Turn**, with **Action Surge** offered if you have a use. **Riposte** sits next to it as long as your reaction is unused. |

- **Dice details**: expand the row under the damage to see every die (`1→3` means Great Weapon Fighting changed a 1 into a 3).
- **Corrections**: "Actually a miss / hit", "Mark as critical hit" for non-20 rolls (e.g. a paralysed target), the **±** on superiority dice and **Undo** (which also restores spent dice and turn resources).
- **Attack type & Tactical Master** (collapsed under the roll-mode buttons): mark a Bonus-action or Reaction attack (no Great Weapon Master bonus), or swap the weapon's mastery for Push / Sap / Slow for one attack. Both reset to the defaults after each roll.
- **Turn**: every turn you have one Attack action (2 attacks), one bonus action (Hew, or a manual Bonus-action attack) and one reaction (Riposte or an opportunity attack). The app blocks anything beyond that. **Action Surge** has to be activated: it gives 2 more attacks, works once per turn, and its uses (`actionSurge.uses` in the config) come back on a rest. **New Turn** resets everything, including your reaction, so press it at the start of your turn.
- **Override** (Turn panel): turns off every turn limit for unusual situations, such as extra attacks from an ally's spell. It switches off again at the next **New Turn**.

## Configuration

Everything static lives in [`src/data/character.json`](src/data/character.json): ability scores (modifiers
are derived), proficiency bonus, attacks per action, superiority dice, maneuvers, feats, fighting
styles, Tactical Master options, house rules and the four weapons. The app never writes to this file.
Browser storage only holds settings (GWF mode, selected weapon, situational toggles), remaining
superiority dice, the turn counter and the last 40 attacks.

Weapon fields worth knowing:

- `damageAbilities`: ability modifiers added to damage (`["str", "dex"]` for the Longbow).
- `extraDamage`: extra dice on a hit. `"when": "targetIsGiant"` makes them conditional.
- `onHit`: reminders shown on a hit, optionally conditional.
- `damageBonusAdjustment`: flat correction for DM rulings (see the Longbow below).
- `strengthRequirement` / `movementDisadvantageForSizes`: the Longbow's disadvantage rules.

## Rules as implemented (and assumptions)

- **Great Weapon Fighting**: 2024 = a 1 or 2 counts as 3. 2014 = reroll a 1 or 2 once and keep the new roll, even if it is another 1 or 2. Applies only to a **melee attack with a `two-handed` weapon** (Eventide Frost, Greataxe). Never applies to attack rolls or Precision Attack.
  House rule `greatWeaponFightingAppliesToAllDamageDice` (on) extends it to Frost dice and superiority dice. Turn it off to limit GWF to the weapon's own dice.
- **Great Weapon Master (2024)**: +proficiency bonus to damage when the weapon is Heavy **and** the attack is part of the Attack action on your turn. Riposte, Bonus-action (Hew) and Reaction attacks don't get it. The Longbow is Heavy, so it qualifies; the Javelin isn't Heavy, so it doesn't.
- **Cleave**: the follow-up attack drops positive ability modifiers from damage and keeps magic and GWM. It counts as part of the Attack action only if the first attack did. That is the house rule `cleaveCountsAsPartOfAttackAction` (on); set it to false to never give the Cleave attack GWM. Once per turn, until **New turn**.
- **Critical hits** double every damage die (weapon, Frost, Giant Slayer, superiority) and never flat modifiers. A crit with a maneuver still spends exactly one superiority die.
- **Graze** deals the attack's ability modifier (STR +5) as the weapon's damage type on a miss, nat 1 included. No dice, no magic/GWM, no Frost. If Tactical Master replaces Graze, there's no miss damage.
- **Precision Attack** is offered while the roll is pending or after you've marked a miss. It isn't offered on a natural 1. The die is spent even if the attack still misses.
- **Riposte** spends its die when you roll the reaction attack, hit or miss. It only works for melee attacks, so it's hidden for the Longbow and a thrown Javelin.
- **One maneuver per attack**: after Precision or Riposte, Trip and Menacing are unavailable.
- **Hew** (GWM): after a hit with a melee weapon, the **Hew** button appears on a critical hit, or when you tick **Target reduced to 0 HP**. It rolls a Bonus-action attack with the same weapon, without the GWM bonus.
- **Advantage plus a forced disadvantage** (Longbow moved, long range, below the STR requirement) cancel to a normal roll. The app tells you when that happens.
- **Giant Slayer Javelin**: "Target is Giant" adds 2d6 Piercing and the DC 15 STR / Prone reminder. "Thrown" makes it a ranged attack, which enables the long-range toggle and disables Riposte.

### Known discrepancy: Lord of the Feast's Longbow

D&D Beyond shows `2d6 + 9`. The written description (STR + DEX to damage) plus 2024 Great Weapon
Master gives **`2d6 + 10`** (STR 5 + DEX 1 + GWM 4), so that's what the app uses. If the DM confirms
+9, set `"damageBonusAdjustment": -1` on the Longbow in `character.json`. It then shows up as an
"Adjustment" line in the dice details.

## Project layout

```
src/
  data/character.json   static character + weapon configuration
  rules/                pure, tested game logic (no React)
    dice.ts             RNG, GWF die rolls, d20 with advantage
    character.ts        derived values, damage plans, effects
    combat.ts           attack lifecycle state transitions + persistence sanitising
  state/useCompanion.ts React glue: settings, persistence, undo
  components/           UI
public/                 manifest, icons, service worker
```

The rules functions take an injectable RNG (`scriptedRng([14, 5, …])` in tests), so every
mechanic above has a deterministic test in `src/rules/*.test.ts`.
