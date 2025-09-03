"use strict";

/**
 * Snake Oil (UHSpartan) – SPT 3.11
 * Lore-friendly all-positive mega stim cloned from Propital.
 * - Therapist LL1 vendor + Flea
 * - Optional world-loot injection (toggle)
 * - Optional bot spawn permission (toggle)
 * - Craftable at Medstation
 * - Defensive buff-shape handling for compatibility with other mods
 */

class SnakeOilMod {
    constructor() {
        this.mod = "UHSpartan-SnakeOilStim";
        this.logger = null;
    }

    preSptLoad(container) {
        this.logger = container.resolve("WinstonLogger");
        this.logger.info(`[${this.mod}] preSptLoad`);
    }

    postDBLoad(container) {
        const logger   = this.logger || container.resolve("WinstonLogger");
        const db       = container.resolve("DatabaseServer");
        const jsonUtil = container.resolve("JsonUtil");

        const tables    = db.getTables();
        const items     = tables.templates.items;
        const traders   = tables.traders;
        const handbook  = tables.templates.handbook;
        const prices    = tables.templates.prices;
        const locales   = tables.locales?.global || {};
        const loot      = tables.loot || {};
        const hideout   = tables.hideout;

        // ----------------- USER CONFIG -----------------
        const THERAPIST_ID = "54cb57776803fa99248b456e";
        const ROUBLES_TPL  = "5449016a4bdc2d6f028b456f";
        const PRICE_RUB    = 85000;
        const THER_LL      = 1;
        const UNLIMITED    = true;

        const BUFF_SECONDS = 2 * 60 * 60; // 2 hours

        // Compatibility toggles
        const COMPAT_SAFE_MODE     = false; // true => only add item + Therapist listing (skip loot/bots)
        const ENABLE_WORLD_LOOT    = true;  // world spawns
        const WORLD_LOOT_WEIGHT    = 3;
        const WORLD_LOOT_CONTAINERS = [
            "med","medcase","meds","jacket","duffle",
            "safe","cache","weapon_box","toolbox","ammo_box","ammobox"
        ];
        const ALLOW_BOTS_TO_SPAWN  = true; // mirror Propital allowance in bot inventories
        // ------------------------------------------------

        // Find Propital
        function findPropitalTpl() {
            const en = locales["en"] || locales["en-EN"] || locales["en_us"];
            if (en) {
                for (const k in en) {
                    if (k.endsWith(" Name") && /propital/i.test(String(en[k]))) {
                        const tpl = k.replace(/ Name$/,"");
                        if (items[tpl]) return tpl;
                    }
                }
            }
            for (const tpl in items) {
                if (String(items[tpl]?._name||"").toLowerCase().includes("propital")) return tpl;
            }
            return null;
        }

        const baseTpl = findPropitalTpl();
        if (!baseTpl || !items[baseTpl]) {
            logger.error(`[${this.mod}] Propital not found`);
            return;
        }
        const base = items[baseTpl];

        // Handbook parent (reuse Propital’s)
        const hbParent = (handbook?.Items?.find(r=>r.Id===baseTpl)?.ParentId) || "5b47574386f77428ca22b2f1";

        // New hex-safe id
        function newIdFromTpl(tpl) {
            if (typeof tpl === "string" && tpl.length === 24) {
                const candidate = "e" + tpl.slice(1, 23) + "f"; // valid hex
                if (!items[candidate]) return candidate;
            }
            const hex = (Date.now().toString(16) + Math.random().toString(16).slice(2))
                .replace(/[^0-9a-f]/g, "")
                .slice(0, 24)
                .padEnd(24, "0");
            return hex;
        }
        const newTpl = newIdFromTpl(baseTpl);

        // Clone/modify
        const oil = jsonUtil.clone(base);
        oil._id = newTpl;

        // ---------- Defensive stim buff handling ----------
        const p = oil._props = oil._props || {};

        // Find the actual buff-array key used by Propital in THIS build
        const buffArrayKey = Object.keys(base._props || {}).find(k => /^stimulatorbuffs$/i.test(k)) || "StimulatorBuffs";

        if (!Array.isArray(base._props?.[buffArrayKey])) {
            // Another mod changed schema (string/object). Keep it untouched to avoid /client/items crash.
            p[buffArrayKey] = base._props[buffArrayKey];
        } else {
            // Start from Propital’s existing array so we inherit its structure
            const baseBuffs = Array.isArray(p[buffArrayKey]) ? p[buffArrayKey] : base._props[buffArrayKey].map(x => ({ ...x }));

            // Detect field names (casing) used by this build
            const sample = baseBuffs[0] || {};
            const keyMap = {
                type:      ["BuffType", "buffType", "type", "Buff"].find(k => k in sample) || "BuffType",
                value:     ["Value", "value", "amount"].find(k => k in sample) || "Value",
                duration:  ["Duration", "duration"].find(k => k in sample) || "Duration",
                chance:    ["Chance", "chance"].find(k => k in sample) || "Chance",
                delay:     ["Delay", "delay"].find(k => k in sample) || "Delay",
                absolute:  ["AbsoluteValue", "absoluteValue"].find(k => k in sample) || "AbsoluteValue"
            };

            const clean = [];
            for (const raw of baseBuffs) {
                const b = {};
                b[keyMap.type] = String(raw[keyMap.type] ?? "Painkiller");
                let v = Number(raw[keyMap.value] ?? 1);
                if (!Number.isFinite(v)) v = 1;
                if (v < 0) v = 0; // all-positive policy
                b[keyMap.value]    = v > 0 ? Math.max(v, 5) : 1;
                b[keyMap.duration] = BUFF_SECONDS;
                b[keyMap.chance]   = 1;
                b[keyMap.delay]    = 0;
                b[keyMap.absolute] = Boolean(raw[keyMap.absolute] ?? false);
                clean.push(b);
            }

            function ensure(buffType, value, absolute = false) {
                if (!clean.some(x => x[keyMap.type] === buffType)) {
                    const b = {};
                    b[keyMap.type]     = buffType;
                    b[keyMap.value]    = value;
                    b[keyMap.duration] = BUFF_SECONDS;
                    b[keyMap.chance]   = 1;
                    b[keyMap.delay]    = 0;
                    b[keyMap.absolute] = !!absolute;
                    clean.push(b);
                }
            }

            // Your positives
            ensure("Painkiller", 1);
            ensure("HealthRate", 60);
            ensure("EnergyRate", 12);
            ensure("HydrationRate", 12);
            ensure("StaminaRecoveryRate", 60);
            ensure("WeightLimit", 400);
            ensure("AimStability", 50);
            ensure("HandsPenalty", -60, true);
            ensure("RemoveAllBloodLosses", 1, true);
            ensure("BloodLoss", -100, true);
            ensure("RemoveAllFractures", 1, true);
            ensure("FractureChance", -100, true);

            p[buffArrayKey] = clean;
        }
        // --------------------------------------------------

        p.CanSellOnRagfair = true;
        p.CanRequireOnRagfair = true;

        // Locales
        const longName  = "Snake Oil Stim";
        const shortName = "SnakeOil";
        const desc      = "Rumor says a group of back-alley medics boiled down every booster they could scavenge, cut it with camp fuel and antiseptic, and topped it off with beard oil for 'smooth delivery'. In Tarkov, miracles are suspicious—but this one works.";
        for (const lang in locales) {
            const g = locales[lang]; if (!g || typeof g !== "object") continue;
            g[`${newTpl} Name`] = longName;
            g[`${newTpl} ShortName`] = shortName;
            g[`${newTpl} Description`] = desc;
        }

        // Register item
        items[newTpl] = oil;

        // Handbook & Flea
        if (handbook?.Items) handbook.Items.push({ Id: newTpl, ParentId: hbParent, Price: PRICE_RUB });
        if (prices) prices[newTpl] = PRICE_RUB;

        // Therapist stock
        const ther = traders[THERAPIST_ID];
        if (ther?.assort) {
            ther.assort.items = ther.assort.items || [];
            ther.assort.barter_scheme = ther.assort.barter_scheme || {};
            ther.assort.loyal_level_items = ther.assort.loyal_level_items || {};
            if (!ther.assort.items.some(i=>i._id===newTpl)) {
                ther.assort.items.push({
                    _id:newTpl,_tpl:newTpl,parentId:"hideout",slotId:"hideout",
                    upd:{UnlimitedCount:UNLIMITED,StackObjectsCount:999999}
                });
                ther.assort.barter_scheme[newTpl] = [[{count:PRICE_RUB,_tpl:ROUBLES_TPL}]];
                ther.assort.loyal_level_items[newTpl] = THER_LL;
            }
        }

        // --------- World loot injection (guarded by compat) ----------
        function sprinkleIntoLootGlobalOnly(tpl, weight = 2) {
    // Only use globalLoot (small + fast). No deep walks.
    loot.globalLoot = Array.isArray(loot.globalLoot) ? loot.globalLoot : [];

    // try to find a meds-ish bucket; otherwise create one tiny bucket
    let medsBucket = loot.globalLoot.find(b => {
        const name = (b.name || b.id || "").toString().toLowerCase();
        return name.includes("med") || name.includes("medical");
    });

    if (!medsBucket) {
        medsBucket = {
            name: "uh_snakeoil_meds_bucket",
            itemDistribution: []
        };
        loot.globalLoot.push(medsBucket);
    }

    const dist = medsBucket.itemDistribution = Array.isArray(medsBucket.itemDistribution)
        ? medsBucket.itemDistribution : [];

    if (!dist.some(e => e && (e.tpl === tpl || e._id === tpl))) {
        dist.push({ tpl, relativeProbability: weight });
    }
}

// --- OPTIONAL: also seed a few container names safely (small scope) ---
function sprinkleIntoSpecificContainers(tpl, weight = 2, names = ["medcase","meds","med"]) {
    const targets = new Set(names.map(x => String(x).toLowerCase()));
    // staticLoot containers
    const stat = loot.staticLoot;
    if (stat && Array.isArray(stat.containers)) {
        for (const c of stat.containers) {
            const n = (c?.name || c?.id || "").toString().toLowerCase();
            if (!targets.has(n)) continue;
            const dist = c.itemDistribution = Array.isArray(c.itemDistribution) ? c.itemDistribution : [];
            if (!dist.some(e => e && (e.tpl === tpl || e._id === tpl))) {
                dist.push({ tpl, relativeProbability: weight });
            }
        }
    }
}

        if (!COMPAT_SAFE_MODE && ENABLE_WORLD_LOOT) {
    sprinkleIntoLootGlobalOnly(newTpl, WORLD_LOOT_WEIGHT);               // very safe
    sprinkleIntoSpecificContainers(newTpl, WORLD_LOOT_WEIGHT,            // optional small extra
        ["medcase","meds","med","jacket","duffle"]);
}
        // -------------------------------------------------------------

        // ------------------ Craft (Medstation) -----------------------
        if (hideout?.production?.recipes) {
            hideout.production.recipes.push({
                _id: `rec_${newTpl}`,
                areaType: 4, // Medstation
                productionTime: 60 * 25,
                requirements: [
                    { templateId: baseTpl, count: 1, type: "Item" },          // Propital
                    { templateId: "544fb45d4bdc2dee738b4568", count: 1, type: "Item" }, // Salewa
                    { templateId: "5c0e530286f7747fa1419862", count: 1, type: "Item" }, // AHF1-M
                    { templateId: "5d1b36a186f7742523398433", count: 1, type: "Item" }, // Expeditionary fuel
                    { templateId: "5d1b32a186f774252167a530", count: 2, type: "Item" }, // Clin Wiper
                    { templateId: "5bc9b156d4351e00367fbce9", count: 1, type: "Item" }  // Beard Oil
                ],
                endProduct: newTpl,
                count: 1
            });
        }
        // -------------------------------------------------------------

        // ----------- Bot spawn mirror / strip (compat-guarded) -------
        function mirrorBotItemAllowance(baseTpl, newTpl) {
            const bots = tables.bots?.types || {};
            function visit(node) {
                if (!node || typeof node !== "object") return;
                for (const k in node) {
                    const v = node[k];
                    if (Array.isArray(v)) {
                        // arrays of tpl strings
                        if (v.some(x => x === baseTpl) && !v.includes(newTpl)) {
                            v.push(newTpl);
                        }
                        // arrays of objects with tpl fields
                        for (const e of v) {
                            if (e && typeof e === "object" && e.tpl === baseTpl) {
                                const exists = v.some(x => x && typeof x === "object" && x.tpl === newTpl);
                                if (!exists) v.push(Object.assign({}, e, { tpl: newTpl }));
                            }
                        }
                    } else if (v && typeof v === "object") {
                        visit(v);
                    }
                }
            }
            for (const t in bots) visit(bots[t]);
        }

        if (!COMPAT_SAFE_MODE) {
            if (ALLOW_BOTS_TO_SPAWN) {
                mirrorBotItemAllowance(baseTpl, newTpl);
            } else {
                const bots = tables.bots?.types || {};
                function strip(node) {
                    if (!node || typeof node !== "object") return;
                    for (const k in node) {
                        const v = node[k];
                        if (Array.isArray(v)) {
                            for (let i=v.length-1;i>=0;i--) {
                                const e = v[i];
                                if (e === newTpl || (e && typeof e==="object" && (e.tpl===newTpl || e._tpl===newTpl))) {
                                    v.splice(i,1);
                                }
                            }
                        } else if (v && typeof v === "object") {
                            strip(v);
                        }
                    }
                }
                for (const t in bots) strip(bots[t]);
            }
        }
        // -------------------------------------------------------------

        logger.info(`[${this.mod}] Snake Oil ready (Therapist LL${THER_LL}, ₽${PRICE_RUB}, duration ${BUFF_SECONDS}s, world loot ${ENABLE_WORLD_LOOT}, bots ${ALLOW_BOTS_TO_SPAWN})`);
    }
}

module.exports = { mod: new SnakeOilMod() };
