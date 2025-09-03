
# Snake Oil (UHSpartan) — SPT 3.11

A lore-friendly **god stim** cloned from Propital. All positives for ~**2 hours** focused on survivability (painkiller, regen, stamina, carry weight, hydration/energy, bleed & fracture protection).

- **Therapist (LL1)** sells it for **₽85,000** (unlimited), **Flea-enabled**
- **Optional world-loot** toggle
- **Optional bot spawn** toggle (mirrors where Propital can appear in bot inventories)
- **Craftable** at **Medstation**

## Craft (Medstation)
- Propital ×1  
- Salewa ×1  
- AHF1-M stim ×1  
- Expeditionary fuel tank ×1  
- Clin Wiper ×2  
- Beard Oil ×1

## Config (edit `src/mod.js`)
```js
const ENABLE_WORLD_LOOT   = true;   // make it appear in med/jacket/cache/etc
const WORLD_LOOT_WEIGHT   = 3;      // rarity weight (raise for more)
const ALLOW_BOTS_TO_SPAWN = true;   // let bots roll it where they can roll Propital
```

## Lore
*Rumor says a group of back‑alley medics boiled down every booster they could scavenge, cut it with camp fuel and antiseptic, and topped it off with beard oil for “smooth delivery”. In Tarkov, miracles are suspicious—but this one works.*

**Author:** UHSpartan • License: MIT
