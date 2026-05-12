# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

贪婪洞窟 (Greedy Cave) — a browser-based Roguelike dungeon crawler. Pure vanilla JS, no frameworks, no build tools, no package.json. Single-page app loaded from `index.html`.

## How to run

No build step. Serve the root directory with any HTTP server:

```bash
npx serve .
```

Then open the URL in a browser. Local file:// opening works for basic play but PWA/Service Worker require HTTP.

## File architecture

```
index.html          # Entry point, all UI markup, loads CSS + 9 JS files in order
css/style.css       # All styles, responsive (desktop ≥769px, mobile ≤768px)
js/utils.js         # Constants (TILE, ENTITY, STATE, COLORS), rand(), clamp(), pick()
js/equipment.js     # Procedural equipment generation — types, rarities, affixes, legendary mods
js/monster.js       # Monster generation — normal/elite/boss, scaled by floor
js/player.js        # Player class — stats, leveling, equip/unequip, potions
js/dungeon.js       # Dungeon class — BSP procedural generation (50×40 grid), visibility/FOV
js/combat.js        # Combat class — damage formula, crit, lifesteal, legendary effects, flee, loot
js/renderer.js      # Renderer class — Canvas 2D drawing, camera, fog-of-war
js/auth.js          # Auth (localStorage users), save/load progress, leaderboard (local + jsonbin.io cloud sync)
js/main.js          # Game loop, UI updates, event binding, version string
sw.js               # Service Worker — network-first caching
manifest.json       # PWA manifest
icon.svg            # PWA icon
```

## Key constants

- `GAME_VERSION` in `js/main.js` — version string displayed in title/town
- `LB_BIN_ID`, `LB_ACCESS_KEY`, `LB_MASTER_KEY` in `js/auth.js` — jsonbin.io cloud leaderboard credentials

## Cloud leaderboard

Reads/writes to a public jsonbin.io Bin. `syncLeaderboard()` fetches from cloud, merges with local (per-user max floor), saves merged result back. `updateMaxFloor()` auto-pushes to cloud on new high score. Service Worker cache version must be bumped when changing static files.

## Data persistence

All user data in localStorage keys: `greedyUsers`, `greedyCurrentUser`, `greedySave_<username>`, `greedyLeaderboard`, `greedyDisplayNames`. No server-side state.
