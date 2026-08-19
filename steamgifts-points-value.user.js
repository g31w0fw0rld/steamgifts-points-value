// ==UserScript==
// @name         SteamGifts Points Value (odds & cost per giveaway)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Works out the real odds of every open SteamGifts giveaway — copies against entries, not the entry count alone — and what those odds cost you in points, so you can see where your balance is worth spending. Adds the odds and the value per point to each row, sorts the listing by value, and shows how many giveaways your current points can still cover. Filtering by level, library or already-entered is left to the site's own settings, which do it server-side.
// @match        https://www.steamgifts.com/*
// @author       g31w0fw0rld
// @license      MIT
// @downloadURL  https://github.com/g31w0fw0rld/steamgifts-points-value/raw/main/steamgifts-points-value.user.js
// @updateURL    https://github.com/g31w0fw0rld/steamgifts-points-value/raw/main/steamgifts-points-value.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_VERSION = '1.0.0';

    // ------------------------------------------------------------------
    // i18n
    // ------------------------------------------------------------------
    // SteamGifts fija <html lang="en"> siempre, sea cual sea tu idioma:
    // su interfaz solo existe en inglés. Así que el idioma se detecta por
    // navigator.languages, nunca por el lang del documento.
    function detectLang() {
        const langs = navigator.languages && navigator.languages.length
            ? navigator.languages
            : [navigator.language || 'en'];
        return langs.some(l => /^es\b/i.test(l)) ? 'es' : 'en';
    }

    const LANG = detectLang();

    const I18N = {
        en: {
            oneIn: '1 in {n}',
            sure: 'certain',
            perPoint: '{v}%/P',
            free: 'free',
            sortValue: 'Sort by value',
            sortSite: "Site's order",
            summary: '{n} giveaways · {afford} within your {points}P',
            best: 'best value here',
            tipOdds: 'Real odds: {copies} copies shared between {entries} entries.',
            tipCost: 'Costs {points}P, so each point buys {v}% of a chance.',
            tipFree: 'Costs no points.',
            tipLevel: 'Your level does not reach this one.',
            noData: 'No giveaways read on this page.',
        },
        es: {
            oneIn: '1 de {n}',
            sure: 'seguro',
            perPoint: '{v} %/P',
            free: 'gratis',
            sortValue: 'Ordenar por valor',
            sortSite: 'Orden del sitio',
            summary: '{n} sorteos · {afford} a tu alcance con {points}P',
            best: 'la mejor relación',
            tipOdds: 'Probabilidad real: {copies} copias repartidas entre {entries} entradas.',
            tipCost: 'Cuesta {points}P, así que cada punto compra un {v}% de posibilidad.',
            tipFree: 'No cuesta puntos.',
            tipLevel: 'Tu nivel no llega a este.',
            noData: 'No se ha leído ningún sorteo en esta página.',
        },
    };

    const T = I18N[LANG] || I18N.en;

    function t(key, vars) {
        let s = T[key] || key;
        if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(vars[k]);
        return s;
    }

    // ------------------------------------------------------------------
    // Selectores del sitio
    // ------------------------------------------------------------------
    const SEL = {
        row: '.giveaway__row-outer-wrap',
        pinned: '.pinned-giveaways',
        name: '.giveaway__heading__name',
        thin: '.giveaway__heading__thin',
        links: '.giveaway__links',
        entries: '.giveaway__links a[href$="/entries"]',
        level: '.giveaway__column--contributor-level',
        levelBad: 'giveaway__column--contributor-level--negative',
        navPoints: '.nav__points',
    };

    const MARK = 'sgpvDone';
    const BADGE_CLASS = 'sgpv-badge';
    const BAR_ID = 'sgpv-bar';
    const SORT_KEY = 'sgpv-sort';

    const nf = new Intl.NumberFormat(LANG === 'es' ? 'es' : 'en');
    // Dos decimales fijos: con parseFloat, un 1,40 %/P se imprimía "1,4" y
    // los valores por debajo de 0,005 se redondeaban a un "0 %/P" que no
    // distingue un sorteo malísimo de uno que no cuesta puntos.
    const pf = new Intl.NumberFormat(LANG === 'es' ? 'es' : 'en', {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
    });

    function fmtPct(pct) {
        if (pct > 0 && pct < 0.01) return '<' + pf.format(0.01);
        return pf.format(pct);
    }

    // ------------------------------------------------------------------
    // Lectura
    // ------------------------------------------------------------------
    // "1,501 entries" y "(100 Copies)" llevan separador de millares del
    // sitio, que siempre escribe en inglés; se quita todo lo que no sea
    // dígito en vez de confiar en el separador.
    function toNumber(text) {
        const digits = String(text).replace(/[^\d]/g, '');
        return digits ? parseInt(digits, 10) : 0;
    }

    function readBalance() {
        const el = document.querySelector(SEL.navPoints);
        return el ? toNumber(el.textContent) : null;
    }

    function parseRow(row) {
        const name = row.querySelector(SEL.name);
        if (!name) return null;

        // El coste en puntos va siempre; las copias solo aparecen si son
        // más de una, así que su ausencia significa 1 y no 0.
        let points = null;
        let copies = 1;
        row.querySelectorAll(SEL.thin).forEach(el => {
            const text = el.textContent.trim();
            const p = text.match(/^\(\s*([\d,.]+)\s*P\s*\)$/i);
            if (p) { points = toNumber(p[1]); return; }
            const c = text.match(/^\(\s*([\d,.]+)\s*Cop(?:y|ies)\s*\)$/i);
            if (c) copies = Math.max(1, toNumber(c[1]));
        });
        if (points === null) return null;

        const entriesLink = row.querySelector(SEL.entries);
        const entries = entriesLink ? toNumber(entriesLink.textContent) : 0;

        const levelEl = row.querySelector(SEL.level);
        const level = levelEl ? toNumber(levelEl.textContent) : 0;
        const levelBlocked = !!(levelEl && levelEl.classList.contains(SEL.levelBad));

        // Sin entradas todavía, la siguiente en llegar se lleva una copia:
        // la probabilidad es 1, no una división por cero.
        const odds = entries > 0 ? Math.min(1, copies / entries) : 1;
        const oneIn = entries > 0 ? entries / copies : 1;
        const perPoint = points > 0 ? odds / points : null;

        return {
            row, name: name.textContent.trim(), points, copies, entries,
            level, levelBlocked, odds, oneIn, perPoint,
            pinned: !!row.closest(SEL.pinned),
        };
    }

    // ------------------------------------------------------------------
    // Pintado
    // ------------------------------------------------------------------
    function fmtOdds(g) {
        if (g.oneIn <= 1) return t('sure');
        return t('oneIn', { n: nf.format(Math.round(g.oneIn)) });
    }

    function fmtPerPoint(g) {
        if (g.perPoint === null) return t('free');
        return t('perPoint', { v: fmtPct(g.perPoint * 100) });
    }

    function tooltipFor(g) {
        const lines = [t('tipOdds', {
            copies: nf.format(g.copies),
            entries: nf.format(g.entries),
        })];
        if (g.perPoint === null) {
            lines.push(t('tipFree'));
        } else {
            lines.push(t('tipCost', {
                points: nf.format(g.points),
                v: fmtPct(g.perPoint * 100),
            }));
        }
        if (g.levelBlocked) lines.push(t('tipLevel'));
        return lines.join('\n');
    }

    // El color del badge sale de comparar el sorteo con los demás de la
    // misma página, no de umbrales fijos: un 0,4 %/P puede ser lo mejor de
    // una tarde floja y lo peor de una buena.
    function rankAll(list) {
        const usable = list.filter(g => !g.levelBlocked && g.perPoint !== null);
        const values = usable.map(g => g.perPoint).sort((a, b) => b - a);
        const at = q => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * q))] : 0;
        const top = at(0.25);
        const mid = at(0.60);
        list.forEach(g => {
            if (g.levelBlocked) { g.tier = 'blocked'; return; }
            if (g.perPoint === null) { g.tier = 'good'; return; }
            g.tier = g.perPoint >= top ? 'good' : (g.perPoint >= mid ? 'mid' : 'low');
        });
    }

    function paint(g) {
        const links = g.row.querySelector(SEL.links);
        if (!links) return;

        let badge = links.querySelector('.' + BADGE_CLASS);
        if (!badge) {
            badge = document.createElement('span');
            badge.className = BADGE_CLASS;
            links.appendChild(badge);
        }
        badge.textContent = fmtOdds(g) + ' · ' + fmtPerPoint(g);
        badge.title = tooltipFor(g);
        badge.className = BADGE_CLASS + ' ' + BADGE_CLASS + '--' + (g.tier || 'mid');
    }

    // ------------------------------------------------------------------
    // Barra de resumen y orden
    // ------------------------------------------------------------------
    function sortWanted() {
        try { return localStorage.getItem(SORT_KEY) === '1'; } catch (e) { return false; }
    }

    function rememberSort(on) {
        try { localStorage.setItem(SORT_KEY, on ? '1' : '0'); } catch (e) { /* modo privado */ }
    }

    // Solo se reordena el listado corriente: los destacados viven en su
    // propio contenedor y moverlos de sitio rompería esa sección.
    function applySort(list, on) {
        const plain = list.filter(g => !g.pinned);
        if (!plain.length) return;
        const parent = plain[0].row.parentElement;
        if (!parent) return;

        if (on) {
            const ordered = plain.slice().sort((a, b) => {
                const av = a.perPoint === null ? Infinity : a.perPoint;
                const bv = b.perPoint === null ? Infinity : b.perPoint;
                if (bv !== av) return bv - av;
                return a.oneIn - b.oneIn;
            });
            ordered.forEach(g => parent.appendChild(g.row));
        } else {
            plain.slice()
                .sort((a, b) => a.siteIndex - b.siteIndex)
                .forEach(g => parent.appendChild(g.row));
        }

        plain.forEach(g => g.row.classList.remove('sgpv-row--best'));
        if (on) {
            const best = plain.reduce((acc, g) => {
                if (g.levelBlocked) return acc;
                const v = g.perPoint === null ? Infinity : g.perPoint;
                return !acc || v > (acc.perPoint === null ? Infinity : acc.perPoint) ? g : acc;
            }, null);
            if (best) best.row.classList.add('sgpv-row--best');
        }
    }

    function buildBar(list) {
        const plain = list.filter(g => !g.pinned);
        const anchor = plain.length ? plain[0].row.parentElement : null;
        if (!anchor) return null;

        let bar = document.getElementById(BAR_ID);
        if (!bar) {
            bar = document.createElement('div');
            bar.id = BAR_ID;
            anchor.parentElement.insertBefore(bar, anchor);
        }
        bar.textContent = '';

        const balance = readBalance();
        const afford = balance === null
            ? plain.length
            : plain.filter(g => !g.levelBlocked && g.points <= balance).length;

        const info = document.createElement('span');
        info.className = 'sgpv-bar__info';
        info.textContent = t('summary', {
            n: nf.format(plain.length),
            afford: nf.format(afford),
            points: balance === null ? '?' : nf.format(balance),
        });

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sgpv-bar__btn';
        const setLabel = on => { btn.textContent = on ? t('sortSite') : t('sortValue'); };
        setLabel(sortWanted());
        btn.addEventListener('click', () => {
            const on = !sortWanted();
            rememberSort(on);
            setLabel(on);
            applySort(list, on);
        });

        bar.appendChild(info);
        bar.appendChild(btn);
        return bar;
    }

    // ------------------------------------------------------------------
    // Estilos
    // ------------------------------------------------------------------
    function injectCss() {
        if (document.getElementById('sgpv-css')) return;
        const css = document.createElement('style');
        css.id = 'sgpv-css';
        css.textContent = [
            // Píldora de fondo sólido: con solo borde, el badge se perdía
            // entre los enlaces azules de "entries" y "comments" que tiene
            // al lado en la misma fila.
            '.' + BADGE_CLASS + '{display:inline-block;margin-left:10px;padding:2px 9px;',
            'border-radius:11px;font-size:11px;font-weight:700;line-height:1.5;',
            'white-space:nowrap;cursor:help;color:#fff !important;',
            'text-shadow:none;background:#4b72d4;}',
            '.' + BADGE_CLASS + '--good{background:#3d8b37;}',
            '.' + BADGE_CLASS + '--mid{background:#4b72d4;}',
            '.' + BADGE_CLASS + '--low{background:#7b8794;}',
            '.' + BADGE_CLASS + '--blocked{background:#b9c0c8;}',
            '#' + BAR_ID + '{display:flex;align-items:center;justify-content:space-between;',
            'gap:12px;margin:0 0 10px;padding:8px 12px;border-radius:4px;',
            'background:#eef1f5;border:1px solid rgba(0,0,0,.14);',
            'font-size:13px;font-weight:600;color:#333;}',
            '.sgpv-bar__btn{cursor:pointer;font:inherit;font-weight:700;padding:4px 12px;',
            'border-radius:4px;border:1px solid #4b72d4;background:#fff;color:#4b72d4;}',
            '.sgpv-bar__btn:hover{background:#4b72d4;color:#fff;}',
            '.sgpv-row--best > .giveaway__row-inner-wrap{box-shadow:inset 4px 0 0 #3d8b37;}',
        ].join('');
        document.head.appendChild(css);
    }

    // ------------------------------------------------------------------
    // Arranque
    // ------------------------------------------------------------------
    function collect() {
        const rows = Array.from(document.querySelectorAll(SEL.row));
        const list = [];
        rows.forEach((row, i) => {
            const g = parseRow(row);
            if (!g) return;
            g.siteIndex = row.dataset[MARK] ? parseInt(row.dataset[MARK], 10) : i;
            row.dataset[MARK] = String(g.siteIndex);
            list.push(g);
        });
        return list;
    }

    function run() {
        const list = collect();
        if (!list.length) return false;
        injectCss();
        rankAll(list);
        list.forEach(paint);
        buildBar(list);
        if (sortWanted()) applySort(list, true);
        return true;
    }

    function boot() {
        if (!run()) return;
        // El listado se repinta cuando otro script inserta filas (scroll
        // infinito de terceros). Se reprocesa con retardo para no correr
        // una vez por nodo insertado.
        const host = document.querySelector(SEL.row);
        const target = host && host.parentElement ? host.parentElement : document.body;
        let pending = null;
        new MutationObserver(() => {
            clearTimeout(pending);
            pending = setTimeout(run, 200);
        }).observe(target, { childList: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
