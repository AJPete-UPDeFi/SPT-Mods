"use strict";

/**
 * UHSpartan Explosive Ammo (SPT 3.11)
 * v1.1: One EX per caliber (choose a representative round with a valid prefab/icon).
 * Adds locale entries so names/descriptions render correctly.
 */

class ExplosiveAmmoMod {
    constructor() {
        this.mod = "UHSpartan-ExplosiveAmmo";
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
        const PRICE_RUB = 1000;           // fair price
        const UNLIMITED = true;

        // Naming controls
        const NAME_PREFIX = "UH-EX";           // shown in Name/ShortName
        
        function prettyCaliber(cal) {
            // Caliber strings often look like "Caliber9x19PARA" -> we prefer "9x19PARA" (or just the first 6-8 chars)
            const raw = String(cal || "");
            const stripped = raw.replace(/^Caliber/i, "");
            return stripped || raw || "Unknown";
        }


        function makeExplosiveProps(base) {
            const p = Object.assign({}, base || {});
            p.Damage = 1500;
            p.PenetrationPower = 100;
            p.PenetrationChance = 1.0;
            p.ArmorDamage = 100;
            // Explosive behavior
            p.HasGrenaderComponent = true;
            p.ExplosionStrength = 12;
            p.MinExplosionDistance = 0.15;
            p.MaxExplosionDistance = 2.0;
            p.ShowHitEffectOnExplode = true;
            p.ExplosionType = "big_round_impact_explosive";
            p.FragmentsCount = 20;
            p.FragmentType = "5996f6cb86f774678763a6ca";
            // High frag as fallback
            p.FragmentationChance = 1.0;
            p.MinFragmentsCount = 25;
            p.MaxFragmentsCount = 60;
            p.HeavyBleedingDelta = 1.0;
            p.LightBleedingDelta = 1.0;
            p.DurabilityBurnModificator = 1.0;
            p.RicochetChance = 0.0;
            if (typeof p.ProjectileCount !== 'number' || p.ProjectileCount < 1) p.ProjectileCount = 1;
            if (typeof p.buckshotBullets === 'number' && p.buckshotBullets < 1) p.buckshotBullets = 1;
            p.CanSellOnRagfair = true;
            p.CanRequireOnRagfair = true;
            return p;
        }

        function newIdFromTpl(tpl) {
            if (typeof tpl === "string" && tpl.length === 24) {
                const candidate = "e" + tpl.slice(1, 23) + "f";
                if (!items[candidate]) return candidate;
            }
            // fallback unique-ish
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

            // skip if already present
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
            } catch (e) { /* ignore */ }
        }

        function stripFromAllBotPools(tplList) {
            const tplSet = new Set(tplList);
            const bots = tables.bots?.types || {};

            function deepFilter(x) {
                if (Array.isArray(x)) {
                    // Remove string entries equal to EX tpl ids, or objects that reference them
                    const filtered = x.filter(v => {
                        if (typeof v === "string") return !tplSet.has(v);
                        if (v && typeof v === "object") {
                            return !tplSet.has(v._tpl) && !tplSet.has(v.tpl) && !tplSet.has(v.id);
                        }
                        return true;
                    });
                    // Recurse into remaining elements
                    return filtered.map(v => deepFilter(v));
                }
                if (x && typeof x === "object") {
                    for (const k in x) x[k] = deepFilter(x[k]);
                }
                return x;
            }

            for (const type in bots) {
                deepFilter(bots[type]); // mutate in place
            }
        }

        // Group ammo by caliber and pick *one* representative with a valid icon/prefab
        const byCaliber = {};
        const createdExTpls = [];

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
            // Prefer item with a Prefab path (prevents ? / ERROR icons)
            let chosen = candidates.find(x => x.it?._props?.Prefab?.path);
            if (!chosen) chosen = candidates[0];
            if (!chosen) continue;

            const baseTpl = chosen.tpl;
            const base = chosen.it;

            const newTpl = newIdFromTpl(baseTpl);
            if (items[newTpl]) continue;

            const longName = `${NAME_PREFIX} ${prettyCaliber(cal)}`;
            const shortName = `${NAME_PREFIX}`;
            const desc = `${prettyCaliber(cal)} EXperimental high-explosive cartridge. Handle with care.`;

            // Clone + set props
            const newItem = jsonUtil.clone(base);
            newItem._id = newTpl;
            if (!newItem._props) newItem._props = {};
            Object.assign(newItem._props, makeExplosiveProps(base._props));

            // Register item
            items[newTpl] = newItem;
            
            // collect the EX id INSIDE the loop
            createdExTpls.push(newTpl);

            // Locales so names/descriptions render
            setLocales(newTpl, longName, shortName, desc);

            // Handbook & Flea Pricing
            if (handbook && Array.isArray(handbook.Items)) {
                handbook.Items.push({ Id: newTpl, ParentId: AMMO_CATEGORY, Price: PRICE_RUB });
            }
            if (prices) prices[newTpl] = PRICE_RUB;

            // Filters (guns/mags that take base ammo take EX too)
            addToFilters(baseTpl, newTpl);

            // Mechanic stock
            if (addToMechanicAssort(newTpl)) mechAdded++;

            created++;
        }

        const BOTS_CAN_USE_EX = false;  // set true if you ever want chaos
        
        if (!BOTS_CAN_USE_EX) {
            stripFromAllBotPools(createdExTpls);
        }

        logger.info(`[${this.mod}] Created ${created} EX rounds (one per caliber), added ${mechAdded} to Mechanic, Flea-ready.`);
    }
}

module.exports = { mod: new ExplosiveAmmoMod() };