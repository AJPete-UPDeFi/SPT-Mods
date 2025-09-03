# UHSpartan Explosive Ammo (SPT 3.11)

Creates **explosive EX variants** for every ammo caliber and makes them available:
- **Flea-enabled** (handbook + price added)
- **Mechanic trader** (LL1) for ₽1,000 per round (configurable in code)

**Credit:** UHSpartan

## Install
Unzip into `SPT/user/mods/` so the path is:
```
SPT/user/mods/UHSpartan-ExplosiveAmmo-3.11/package.json
SPT/user/mods/UHSpartan-ExplosiveAmmo-3.11/src/mod.js
```

## Tuning
Open `src/mod.js` and edit:
- `PRICE_RUB` to change the ₽ price.
- `MECH_LL` for Mechanic loyalty level.
- The `makeExplosiveProps(...)` function for damage/frag/etc.

## Notes
- This mod **creates new ammo** (does not overwrite base rounds).
- Weapon/mag filters are extended so anything that accepts the base round should accept the EX version.
- No custom traders or quests required.