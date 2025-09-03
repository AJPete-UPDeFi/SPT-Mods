"use strict";

/**
 * UH-ME: Meta Ammo (SPT 3.11)
 * One ME round per caliber (not per variant). Max damage/pen + laser handling (high velocity, low recoil).
 * No explosive effects.
 * Sold by Mechanic (LL1) for ₽500, Flea-enabled. Bots blocked by default.
 * Author: UHSpartan
 * License: MIT
 */

class MetaAmmoMod {
    constructor() {
        this.mod = "UHSpartan-MetaAmmo";
        this.logger = null;
    }

    preSptLoad(container) {
        this.logger = container.resolve("WinstonLogger");
        this.logger.info(`[${this.mod}] preSptLoad`);
    }

    postDBLoad(container) {
        const logger = this.logger || container.resolve("WinstonLogger");
        const db = container.resolve("DatabaseServer");
        const jsonUtil = container.resolve("JsonUtil");

        const tables = db.getTables();
        const items = tables.templates.items;
        const handbook = tables.templates.handbook;
        const prices = tables.templates.prices;
        const traders = tables.traders;
        const locales = tables.locales?.global || {};

        const AMMO_PARENT = "5485a8684bdc2da71d8b4567";           // ammo parent
        const AMMO_CATEGORY = "5b47574386f77428ca22b33b";          // handbook ammo
        const MECHANIC_ID = "5a7c2eca46aef81a7ca2145d";            // Mechanic trader
        const ROUBLES_TPL = "5449016a4bdc2d6f028b456f";

        const MECH_LL = 1;                 // loyalty level requirement
        const PRICE_RUB = 500;             // ₽ per round
        const UNLIMITED = true;

        // Naming controls
        const NAME_PREFIX = "UH-ME";       // shown in Name/ShortName
        function prettyCaliber(cal) {
            const raw = String(cal || "");
            const stripped = raw.replace(/^Caliber/i, "");
            return stripped || raw || "Unknown";
        }

        // "Laser" meta targets
        const META_DAMAGE       = 1500;
        const META_PEN          = 100;
        const META_ARMOR_DMG    = 100;
        const META_PEN_CHANCE   = 1.0;
        const META_VELOCITY     = 1200;    // m/s (very fast; adjust if you prefer)
        const META_ACCURACY     = 100;      // ammoAccr boost
        const META_RECOIL       = -100;     // ammoRec reduction (negative lowers recoil)

        function makeMetaProps(base) {
            const p = Object.assign({}, base || {});

            // Remove explosive behavior if present on base
            delete p.HasGrenaderComponent;
            delete p.ExplosionStrength;
            delete p.MinExplosionDistance;
            delete p.MaxExplosionDistance;
            delete p.ShowHitEffectOnExplode;
            delete p.ExplosionType;
            delete p.FragmentsCount;
            delete p.FragmentType;

            // Maxed combat stats
            p.Damage = META_DAMAGE;
            p.PenetrationPower = META_PEN;
            p.PenetrationChance = META_PEN_CHANCE;
            p.ArmorDamage = META_ARMOR_DMG;

            // Laser handling
            p.InitialSpeed = Math.max(p.InitialSpeed || 0, META_VELOCITY);
            // Accuracy/recoil modifiers (engine respects these for ammo)
            p.ammoAccr = Math.max(p.ammoAccr || 0, META_ACCURACY);
            p.ammoRec  = Math.min(p.ammoRec  || 0, META_RECOIL); // more negative = less recoil

            // Keep fragmentation modest
            if (typeof p.FragmentationChance !== "number") p.FragmentationChance = 0.05;
            p.MinFragmentsCount = 1;
            p.MaxFragmentsCount = Math.max(1, Math.min(3, p.MaxFragmentsCount || 1));

            // Ensure single projectile by default
            if (typeof p.ProjectileCount !== 'number' || p.ProjectileCount < 1) p.ProjectileCount = 1;

            // Flea flags
            p.CanSellOnRagfair = true;
            p.CanRequireOnRagfair = true;

            return p;
        }

        function newIdFromTpl(tpl) {
            if (typeof tpl === "string" && tpl.length === 24) {
                const candidate = "d" + tpl.slice(1, 23) + "c"; // unique-ish pattern for ME
                if (!items[candidate]) return candidate;
            }
            return (Date.now().toString(16) + Math.random().toString(16).slice(2)).slice(0,24);
        }

        function addToFilters(baseTpl, newTpl) {
            function patchFilterBlock(f) {
                if (!f || !Array.isArray(f.Filter)) return;
                if (f.Filter.includes(baseTpl) && !f.Filter.includes(newTpl)) {
                    f.Filter.push(newTpl);
                }
            }

            function visit(node) {
                if (!node || typeof node !== "object") return;

                // Generic: any property named "filters" that looks like EFT filter blocks
                if (Array.isArray(node.filters)) {
                    for (const f of node.filters) patchFilterBlock(f);
                }

                // Known containers that hold filter blocks
                const containers = [
                    "Cartridges", "Chambers", "Slots", "StackSlots",
                    "InternalSlots", "internalSlots" // just in case
                ];
                for (const key of containers) {
                    const arr = node[key];
                    if (Array.isArray(arr)) {
                        for (const entry of arr) {
                            // Some entries store their own _props with filters
                            if (entry && typeof entry === "object") {
                                if (entry._props && entry._props.filters) {
                                    for (const f of entry._props.filters) patchFilterBlock(f);
                                }
                                // Recurse further in case filters are nested deeper
                                visit(entry);
                                if (entry._props) visit(entry._props);
                            }
                        }
                    }
                }

                // Recurse generically through all nested objects to catch edge cases
                for (const k in node) {
                    if (k === "parent" || k === "_parent") continue;
                    const v = node[k];
                    if (v && typeof v === "object") visit(v);
                }
            }

            // Walk every template item once
            for (const tpl in items) {
                const it = items[tpl];
                if (!it || !it._props) continue;
                visit(it._props);
            }
        }


        function addToMechanicAssort(tpl) {
            const mech = traders[MECHANIC_ID];
            if (!mech || !mech.assort) return false;
            mech.assort.items = mech.assort.items || [];
            mech.assort.barter_scheme = mech.assort.barter_scheme || {};
            mech.assort.loyal_level_items = mech.assort.loyal_level_items || {};

            if (mech.assort.items.some(i => i._id === tpl)) return false;

            mech.assort.items.push({
                _id: tpl,
                _tpl: tpl,
                parentId: "hideout",
                slotId: "hideout",
                upd: { UnlimitedCount: UNLIMITED, StackObjectsCount: 999999 }
            });
            mech.assort.barter_scheme[tpl] = [[{ count: PRICE_RUB, _tpl: ROUBLES_TPL }]];
            mech.assort.loyal_level_items[tpl] = MECH_LL;
            return true;
        }

        function setLocales(tpl, longName, shortName, desc) {
            try {
                for (const lang in locales) {
                    const g = locales[lang];
                    if (!g || typeof g !== 'object') continue;
                    g[`${tpl} Name`] = longName;
                    g[`${tpl} ShortName`] = shortName;
                    g[`${tpl} Description`] = desc;
                }
            } catch (_) {}
        }

        function stripFromAllBotPools(tplList) {
            const tplSet = new Set(tplList);
            const bots = tables.bots?.types || {};

            function deepFilter(x) {
                if (Array.isArray(x)) {
                    const filtered = x.filter(v => {
                        if (typeof v === "string") return !tplSet.has(v);
                        if (v && typeof v === "object") {
                            return !tplSet.has(v._tpl) && !tplSet.has(v.tpl) && !tplSet.has(v.id);
                        }
                        return true;
                    });
                    return filtered.map(v => deepFilter(v));
                }
                if (x && typeof x === "object") {
                    for (const k in x) x[k] = deepFilter(x[k]);
                }
                return x;
            }

            for (const type in bots) {
                deepFilter(bots[type]);
            }
        }

        // Group ammo by caliber and pick one representative with a valid icon/prefab
        const byCaliber = {};
        const createdMeTpls = [];

        for (const tpl in items) {
            const it = items[tpl];
            if (!it || it._parent !== AMMO_PARENT) continue;
            const cal = it?._props?.Caliber || "Unknown";
            byCaliber[cal] = byCaliber[cal] || [];
            byCaliber[cal].push({ tpl, it });
        }

        let created = 0;
        let mechAdded = 0;

        for (const cal of Object.keys(byCaliber)) {
            const candidates = byCaliber[cal];
            let chosen = candidates.find(x => x.it?._props?.Prefab?.path);
            if (!chosen) chosen = candidates[0];
            if (!chosen) continue;

            const baseTpl = chosen.tpl;
            const base = chosen.it;

            const newTpl = newIdFromTpl(baseTpl);
            if (items[newTpl]) continue;

            const longName = `${NAME_PREFIX} ${prettyCaliber(cal)}`;
            const shortName = `${NAME_PREFIX}`;
            const desc = `${prettyCaliber(cal)} meta cartridge tuned to delete problems on contact.`;

            const newItem = jsonUtil.clone(base);
            newItem._id = newTpl;
            if (!newItem._props) newItem._props = {};
            Object.assign(newItem._props, makeMetaProps(base._props));

            items[newTpl] = newItem;
            createdMeTpls.push(newTpl);

            setLocales(newTpl, longName, shortName, desc);

            if (handbook?.Items && !handbook.Items.some(h => h.Id === newTpl)) {
                handbook.Items.push({ Id: newTpl, ParentId: AMMO_CATEGORY, Price: PRICE_RUB });
            }
            if (prices && prices[newTpl] == null) prices[newTpl] = PRICE_RUB;

            addToFilters(baseTpl, newTpl);

            if (addToMechanicAssort(newTpl)) mechAdded++;

            created++;
        }

        const BOTS_CAN_USE_ME = false;
        if (!BOTS_CAN_USE_ME) stripFromAllBotPools(createdMeTpls);

        logger.info(`[${this.mod}] Created ${created} ME rounds (one per caliber), added ${mechAdded} to Mechanic (₽${PRICE_RUB}), Flea-ready.`);
    }
}

module.exports = { mod: new MetaAmmoMod() };