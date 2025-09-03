# UH-ME: Meta Ammo (SPT 3.11)

Creates **one “UH-ME” round per caliber** (not per variant). These are **meta, laser-like** bullets: max damage, max pen, high velocity, and reduced recoil. **No explosive effects.**

**Available from:**
- **Mechanic (LL1)** for **₽500** per round (unlimited)
- **Flea-enabled** via handbook + price

**Bots:** By default, the mod **blocks bots** from rolling UH-ME in their loadouts, so the power fantasy stays with players.

## Features
- One ME round per **caliber**, keeps inventories tidy
- **Damage 1500**, **Pen 100**, **Armor Damage 100**, **PenetrationChance 1.0**
- **InitialSpeed 1200 m/s**, strong **accuracy boost**, **recoil reduction**
- Preserves gun/mag filters: anything that takes the base caliber accepts UH-ME
- Proper names, short names, and descriptions
- Mechanic LL1 stock + Flea-enabled
- Bot pools automatically stripped of ME rounds

## Install
Extract to:
```
SPT/user/mods/UHSpartan-MetaAmmo-3.11/
```

## Customize (edit `src/mod.js`)
- Price & trader level:
```js
const PRICE_RUB = 500;
const MECH_LL   = 1;
```
- Naming:
```js
const NAME_PREFIX = "UH-ME";
```
- Bot control:
```js
const BOTS_CAN_USE_ME = false; // set true if you want AI to roll UH-ME
```
- Meta targets ("laser" feel):
```js
const META_DAMAGE       = 1500;
const META_PEN          = 100;
const META_ARMOR_DMG    = 100;
const META_PEN_CHANCE   = 1.0;
const META_VELOCITY     = 1200; // m/s
const META_ACCURACY     = 100;   // ammoAccr
const META_RECOIL       = -100;  // ammoRec
```

## Compatibility
- For **SPT 3.11**.
- Does **not modify** vanilla ammo. Each UH-ME round is a new item.
- If you previously used explosive EX mods, this one strips explosive fields completely.

## Credits & License
- **Author:** UHSpartan
- License: **MIT**