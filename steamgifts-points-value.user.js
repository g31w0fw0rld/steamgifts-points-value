// ==UserScript==
// @name         SteamGifts Points Value (odds & cost per giveaway)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Works out the real odds of every open SteamGifts giveaway — copies against entries, not the entry count alone — and what those odds cost you in points, so you can see where your balance is worth spending. Adds odds and value per point to each row, sorts the listing by value, and shows a widget with your balance, your level and how far the next one is. Filtering by level, library or already-entered is left to the site's own settings, which do it server-side.
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
    // SteamGifts fija <html lang="en"> para todo el mundo: su interfaz solo
    // existe en inglés. Así que el idioma se detecta por navigator.languages,
    // nunca por el lang del documento, y se puede forzar desde el widget.
    const LANG_PREF_KEY = 'sgpv-lang';

    function readLangPref() {
        try { const v = localStorage.getItem(LANG_PREF_KEY); return (v === 'es' || v === 'en') ? v : ''; }
        catch (e) { return ''; }
    }

    function saveLangPref(v) {
        try {
            if (v === 'es' || v === 'en') localStorage.setItem(LANG_PREF_KEY, v);
            else localStorage.removeItem(LANG_PREF_KEY);
        } catch (e) { /* almacenamiento no disponible */ }
    }

    function detectLang() {
        const langs = navigator.languages && navigator.languages.length
            ? navigator.languages
            : [navigator.language || 'en'];
        return langs.some(l => /^es\b/i.test(l)) ? 'es' : 'en';
    }

    const LANG_PREF = readLangPref();
    const LANG = LANG_PREF || detectLang();

    const I18N = {
        en: {
            oneIn: '1 in {n}',
            sure: 'certain',
            perPoint: '{v}%/P',
            free: 'free',
            title: 'Points Value',
            capped: 'at the cap',
            cappedTip: 'You are at the 400P cap: every point handed out from now on is lost until you spend some.',
            level: 'Level {n}',
            toNext: '${v} to Level {n}',
            maxLevel: 'top level',
            counts: '{n} giveaways · {afford} within reach',
            bestIs: 'Best: {odds} · {value}',
            sortValue: 'Sort by value',
            sortSite: "Site's order",
            about: 'About',
            language: 'Language',
            auto: 'Auto',
            minimise: 'Minimise',
            aboutBody: [
                'Odds are copies ÷ entries, and value is those odds ÷ what the giveaway costs: how much of a chance each point buys. Colours compare each giveaway with the others on the page, not against fixed thresholds.',
                'This script filters nothing. SteamGifts does it better in Account → Settings → Giveaways, server-side. The setup this script assumes:',
                '2, 3, 4, 5 and 6 set to Yes — games you own, DLC without the base game, above your level, already entered, and manually filtered. Leave 1 on All and 7 as you prefer.',
            ],
            tipOdds: 'Real odds: {copies} copies shared between {entries} entries.',
            tipCost: 'Costs {points}P, so each point buys {v}% of a chance.',
            tipFree: 'Costs no points.',
            tipLevel: 'Your level does not reach this one.',
        },
        es: {
            oneIn: '1 de {n}',
            sure: 'seguro',
            perPoint: '{v} %/P',
            free: 'gratis',
            title: 'Valor por punto',
            capped: 'al tope',
            cappedTip: 'Estás en el tope de 400P: cada punto que se reparta a partir de ahora se pierde hasta que gastes.',
            level: 'Nivel {n}',
            toNext: '{v} $ para el nivel {n}',
            maxLevel: 'nivel máximo',
            counts: '{n} sorteos · {afford} a tu alcance',
            bestIs: 'Mejor: {odds} · {value}',
            sortValue: 'Ordenar por valor',
            sortSite: 'Orden del sitio',
            about: 'Acerca de',
            language: 'Idioma',
            auto: 'Automático',
            minimise: 'Minimizar',
            aboutBody: [
                'La probabilidad es copias ÷ entradas, y el valor es esa probabilidad ÷ lo que cuesta el sorteo: cuánta posibilidad compra cada punto. Los colores comparan cada sorteo con los demás de la página, no contra umbrales fijos.',
                'Este script no filtra nada. SteamGifts lo hace mejor en Account → Settings → Giveaways, del lado del servidor. La configuración que este script da por supuesta:',
                'Los puntos 2, 3, 4, 5 y 6 en Yes —juegos que ya tienes, DLC sin el juego base, por encima de tu nivel, en los que ya entraste y los filtrados a mano—. El 1 en All y el 7 a tu gusto.',
            ],
            tipOdds: 'Probabilidad real: {copies} copias repartidas entre {entries} entradas.',
            tipCost: 'Cuesta {points}P, así que cada punto compra un {v}% de posibilidad.',
            tipFree: 'No cuesta puntos.',
            tipLevel: 'Tu nivel no llega a este.',
        },
    };

    const T = I18N[LANG] || I18N.en;

    function t(key, vars) {
        let s = T[key];
        if (s === undefined) return key;
        if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(vars[k]);
        return s;
    }

    // ------------------------------------------------------------------
    // Constantes del sitio
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

    // Tope de puntos de la cuenta: por encima no se acumula nada.
    const POINTS_CAP = 400;
    // Valor en dólares regalados con el que empieza cada nivel, del 1 al 10.
    const LEVEL_STEPS = [0.01, 25, 50, 100, 250, 500, 1000, 2000, 3000, 5000];

    const MARK = 'sgpvDone';
    const BADGE_CLASS = 'sgpv-badge';
    const WIDGET_ID = 'sgpv-widget';
    const SORT_KEY = 'sgpv-sort';
    const MIN_KEY = 'sgpv-min';

    const nf = new Intl.NumberFormat(LANG === 'es' ? 'es' : 'en');
    // Dos decimales fijos: con parseFloat, un 1,40 %/P se imprimía "1,4", y
    // los valores por debajo de 0,005 se redondeaban a un "0 %/P" que no
    // distingue un sorteo malísimo de uno que no cuesta puntos.
    const pf = new Intl.NumberFormat(LANG === 'es' ? 'es' : 'en', {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
    });

    function fmtPct(pct) {
        if (pct > 0 && pct < 0.01) return '<' + pf.format(0.01);
        return pf.format(pct);
    }

    function store(key, value) {
        try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
        catch (e) { /* modo privado */ }
    }

    function recall(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    // ------------------------------------------------------------------
    // Lectura del sitio
    // ------------------------------------------------------------------
    // "1,501 entries" y "(100 Copies)" llevan el separador de millares que
    // el sitio escribe siempre en inglés; se quita todo lo que no sea dígito
    // en vez de confiar en cuál es.
    function toNumber(text) {
        const digits = String(text).replace(/[^\d]/g, '');
        return digits ? parseInt(digits, 10) : 0;
    }

    function readAccount() {
        const pointsEl = document.querySelector(SEL.navPoints);
        if (!pointsEl) return null;
        const points = toNumber(pointsEl.textContent);

        // El nivel va en el span contiguo, con el valor exacto de tu
        // contribución en el title: "Level 0" con title="0.00".
        const levelEl = pointsEl.nextElementSibling;
        let level = null;
        let value = null;
        if (levelEl) {
            const m = levelEl.textContent.match(/(\d+)/);
            if (m) level = parseInt(m[1], 10);
            const raw = parseFloat(String(levelEl.getAttribute('title') || '').replace(/[^\d.]/g, ''));
            if (!isNaN(raw)) value = raw;
        }
        return { points, level, value };
    }

    function parseRow(row) {
        const name = row.querySelector(SEL.name);
        if (!name) return null;

        // El coste en puntos va siempre; las copias solo se imprimen si son
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
        const levelBlocked = !!(levelEl && levelEl.classList.contains(SEL.levelBad));

        // Sin entradas todavía, la siguiente en llegar se lleva una copia:
        // la probabilidad es 1, no una división por cero.
        const odds = entries > 0 ? Math.min(1, copies / entries) : 1;
        const oneIn = entries > 0 ? entries / copies : 1;
        const perPoint = points > 0 ? odds / points : null;

        return {
            row, name: name.textContent.trim(), points, copies, entries,
            levelBlocked, odds, oneIn, perPoint,
            pinned: !!row.closest(SEL.pinned),
        };
    }

    // ------------------------------------------------------------------
    // Badges
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
        const lines = [t('tipOdds', { copies: nf.format(g.copies), entries: nf.format(g.entries) })];
        lines.push(g.perPoint === null
            ? t('tipFree')
            : t('tipCost', { points: nf.format(g.points), v: fmtPct(g.perPoint * 100) }));
        if (g.levelBlocked) lines.push(t('tipLevel'));
        return lines.join('\n');
    }

    // El color sale de comparar el sorteo con los demás de la misma página,
    // no de umbrales fijos: un 0,4 %/P puede ser lo mejor de una tarde floja
    // y lo peor de una buena.
    function rankAll(list) {
        const values = list
            .filter(g => !g.levelBlocked && g.perPoint !== null)
            .map(g => g.perPoint)
            .sort((a, b) => b - a);
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
            links.appendChild(badge);
        }
        badge.textContent = fmtOdds(g) + ' · ' + fmtPerPoint(g);
        badge.title = tooltipFor(g);
        badge.className = BADGE_CLASS + ' ' + BADGE_CLASS + '--' + (g.tier || 'mid');
    }

    // ------------------------------------------------------------------
    // Orden
    // ------------------------------------------------------------------
    // Se reordena POR HUECOS, no moviendo las filas al final. El sitio
    // intercala entre ellas bloques promocionales propios (divs de clase
    // ofuscada, uno cada trece filas y a veces vacíos): con appendChild esos
    // bloques se quedaban agrupados arriba y abrían un vacío enorme sobre el
    // listado. Cada fila deja un marcador en su sitio y las filas ordenadas
    // ocupan esos mismos marcadores, así que lo ajeno no se mueve.
    function reflow(plain, ordered) {
        const anchors = plain.map(g => {
            const mark = document.createComment('sgpv');
            g.row.parentNode.insertBefore(mark, g.row);
            return mark;
        });
        ordered.forEach((g, i) => {
            const mark = anchors[i];
            if (mark && mark.parentNode) mark.parentNode.replaceChild(g.row, mark);
        });
        anchors.forEach(m => { if (m.parentNode) m.parentNode.removeChild(m); });
    }

    function byValue(a, b) {
        const av = a.perPoint === null ? Infinity : a.perPoint;
        const bv = b.perPoint === null ? Infinity : b.perPoint;
        if (bv !== av) return bv - av;
        return a.oneIn - b.oneIn;
    }

    function bestOf(list) {
        return list
            .filter(g => !g.levelBlocked && !g.pinned)
            .slice()
            .sort(byValue)[0] || null;
    }

    function applySort(list, on) {
        // Los destacados viven en su propio contenedor: moverlos rompería
        // esa sección, así que se quedan fuera del reparto.
        const plain = list.filter(g => !g.pinned);
        if (!plain.length) return;

        reflow(plain, on
            ? plain.slice().sort(byValue)
            : plain.slice().sort((a, b) => a.siteIndex - b.siteIndex));

        plain.forEach(g => g.row.classList.remove('sgpv-row--best'));
        if (on) {
            const best = bestOf(plain);
            if (best) best.row.classList.add('sgpv-row--best');
        }
    }

    // ------------------------------------------------------------------
    // Widget
    // ------------------------------------------------------------------
    function levelLine(acc) {
        if (acc.level === null) return '';
        const parts = [t('level', { n: nf.format(acc.level) })];
        if (acc.value !== null) {
            const next = LEVEL_STEPS.find(v => v > acc.value);
            parts.push(next === undefined
                ? t('maxLevel')
                : t('toNext', {
                    v: nf.format(Math.round((next - acc.value) * 100) / 100),
                    n: nf.format(LEVEL_STEPS.indexOf(next) + 1),
                }));
        }
        return parts.join(' · ');
    }

    function el(tag, cls, text) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function buildWidget(list) {
        const acc = readAccount();
        const plain = list.filter(g => !g.pinned);
        const best = bestOf(plain);

        let w = document.getElementById(WIDGET_ID);
        if (!w) {
            w = el('div', null);
            w.id = WIDGET_ID;
            document.body.appendChild(w);
        }
        w.textContent = '';
        w.classList.toggle('sgpv-w--min', recall(MIN_KEY) === '1');

        const head = el('div', 'sgpv-w__head');
        head.appendChild(el('span', 'sgpv-w__title', t('title')));
        const min = el('button', 'sgpv-w__min', recall(MIN_KEY) === '1' ? '+' : '–');
        min.type = 'button';
        min.title = t('minimise');
        min.addEventListener('click', () => {
            const now = recall(MIN_KEY) !== '1';
            store(MIN_KEY, now ? '1' : null);
            w.classList.toggle('sgpv-w--min', now);
            min.textContent = now ? '+' : '–';
        });
        head.appendChild(min);
        w.appendChild(head);

        const body = el('div', 'sgpv-w__body');

        if (acc) {
            const atCap = acc.points >= POINTS_CAP;
            const amount = el('div', 'sgpv-w__amount' + (atCap ? ' sgpv-w__amount--cap' : ''),
                nf.format(acc.points) + 'P');
            if (atCap) {
                amount.title = t('cappedTip');
                amount.appendChild(el('span', 'sgpv-w__cap', ' ' + t('capped')));
            }
            body.appendChild(amount);
            const lvl = levelLine(acc);
            if (lvl) body.appendChild(el('div', 'sgpv-w__line', lvl));
        }

        const afford = acc
            ? plain.filter(g => !g.levelBlocked && g.points <= acc.points).length
            : plain.length;
        body.appendChild(el('div', 'sgpv-w__line', t('counts', {
            n: nf.format(plain.length), afford: nf.format(afford),
        })));

        if (best) {
            body.appendChild(el('div', 'sgpv-w__line sgpv-w__line--best', t('bestIs', {
                odds: fmtOdds(best), value: fmtPerPoint(best),
            })));
        }

        const sortBtn = el('button', 'sgpv-w__btn');
        sortBtn.type = 'button';
        const label = on => { sortBtn.textContent = on ? t('sortSite') : t('sortValue'); };
        label(recall(SORT_KEY) === '1');
        sortBtn.addEventListener('click', () => {
            const on = recall(SORT_KEY) !== '1';
            store(SORT_KEY, on ? '1' : '0');
            label(on);
            applySort(list, on);
        });
        body.appendChild(sortBtn);

        const aboutBtn = el('button', 'sgpv-w__btn sgpv-w__btn--ghost', t('about'));
        aboutBtn.type = 'button';
        const about = el('div', 'sgpv-w__about');
        T.aboutBody.forEach(p => about.appendChild(el('p', null, p)));
        about.style.display = 'none';
        aboutBtn.addEventListener('click', () => {
            about.style.display = about.style.display === 'none' ? 'block' : 'none';
        });
        body.appendChild(aboutBtn);
        body.appendChild(about);

        const langRow = el('div', 'sgpv-w__lang');
        langRow.appendChild(el('span', null, t('language')));
        const sel = el('select');
        [['', t('auto')], ['es', 'Español'], ['en', 'English']].forEach(([v, txt]) => {
            const opt = el('option', null, txt);
            opt.value = v;
            if (v === LANG_PREF) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', () => { saveLangPref(sel.value); location.reload(); });
        langRow.appendChild(sel);
        body.appendChild(langRow);

        w.appendChild(body);
        return w;
    }

    // ------------------------------------------------------------------
    // Estilos
    // ------------------------------------------------------------------
    // Paleta del propio SteamGifts: la barra oscura de su cabecera, su azul
    // de enlaces y el verde de los avisos correctos.
    function injectCss() {
        if (document.getElementById('sgpv-css')) return;
        const css = el('style');
        css.id = 'sgpv-css';
        css.textContent = [
            // Píldora de fondo sólido: con solo borde, el badge se perdía
            // entre los enlaces azules de "entries" y "comments" de la misma
            // fila.
            '.' + BADGE_CLASS + '{display:inline-block;margin-left:10px;padding:2px 9px;',
            'border-radius:11px;font-size:11px;font-weight:700;line-height:1.5;',
            'white-space:nowrap;cursor:help;color:#fff !important;text-shadow:none;background:#4b72d4;}',
            '.' + BADGE_CLASS + '--good{background:#3d8b37;}',
            '.' + BADGE_CLASS + '--mid{background:#4b72d4;}',
            '.' + BADGE_CLASS + '--low{background:#7b8794;}',
            '.' + BADGE_CLASS + '--blocked{background:#b9c0c8;}',
            '.sgpv-row--best > .giveaway__row-inner-wrap{box-shadow:inset 4px 0 0 #3d8b37;}',

            '#' + WIDGET_ID + '{position:fixed;right:16px;bottom:16px;z-index:9999;width:230px;',
            'background:#2f3947;color:#e6e9ee;border:1px solid #1d2530;border-radius:6px;',
            'box-shadow:0 4px 14px rgba(0,0,0,.3);font-size:12px;line-height:1.45;}',
            '#' + WIDGET_ID + ' .sgpv-w__head{display:flex;align-items:center;justify-content:space-between;',
            'padding:6px 10px;background:#242c37;border-radius:5px 5px 0 0;}',
            '#' + WIDGET_ID + ' .sgpv-w__title{font-weight:700;letter-spacing:.02em;}',
            '#' + WIDGET_ID + ' .sgpv-w__min{cursor:pointer;background:transparent;border:0;color:#9aa4b2;',
            'font-size:15px;line-height:1;padding:0 2px;}',
            '#' + WIDGET_ID + ' .sgpv-w__min:hover{color:#fff;}',
            '#' + WIDGET_ID + '.sgpv-w--min .sgpv-w__body{display:none;}',
            '#' + WIDGET_ID + ' .sgpv-w__body{padding:10px;}',
            '#' + WIDGET_ID + ' .sgpv-w__amount{font-size:24px;font-weight:700;color:#fff;}',
            '#' + WIDGET_ID + ' .sgpv-w__amount--cap{color:#ffcf66;cursor:help;}',
            '#' + WIDGET_ID + ' .sgpv-w__cap{font-size:11px;font-weight:600;}',
            '#' + WIDGET_ID + ' .sgpv-w__line{color:#b8c1cd;margin-top:2px;}',
            '#' + WIDGET_ID + ' .sgpv-w__line--best{color:#8bd67f;}',
            '#' + WIDGET_ID + ' .sgpv-w__btn{display:block;width:100%;margin-top:8px;cursor:pointer;',
            'font:inherit;font-weight:700;padding:5px 8px;border-radius:4px;border:1px solid #4b72d4;',
            'background:#4b72d4;color:#fff;}',
            '#' + WIDGET_ID + ' .sgpv-w__btn:hover{filter:brightness(1.12);}',
            '#' + WIDGET_ID + ' .sgpv-w__btn--ghost{background:transparent;color:#9fb4e8;}',
            '#' + WIDGET_ID + ' .sgpv-w__about{margin-top:8px;color:#b8c1cd;}',
            '#' + WIDGET_ID + ' .sgpv-w__about p{margin:0 0 6px;}',
            '#' + WIDGET_ID + ' .sgpv-w__lang{display:flex;align-items:center;justify-content:space-between;',
            'gap:6px;margin-top:10px;color:#9aa4b2;}',
            '#' + WIDGET_ID + ' .sgpv-w__lang select{font:inherit;padding:2px 4px;border-radius:3px;',
            'border:1px solid #4a5568;background:#1f2733;color:#e6e9ee;}',
        ].join('');
        document.head.appendChild(css);
    }

    // ------------------------------------------------------------------
    // Arranque
    // ------------------------------------------------------------------
    function collect() {
        const list = [];
        Array.from(document.querySelectorAll(SEL.row)).forEach((row, i) => {
            const g = parseRow(row);
            if (!g) return;
            // El orden original se guarda la primera vez y sobrevive a las
            // reordenaciones, que si no se perderían al volver a leer el DOM.
            g.siteIndex = row.dataset[MARK] !== undefined ? parseInt(row.dataset[MARK], 10) : i;
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
        buildWidget(list);
        if (recall(SORT_KEY) === '1') applySort(list, true);
        return true;
    }

    function boot() {
        if (!run()) return;
        // El listado se repinta cuando otro script inserta filas (scroll
        // infinito de terceros). Se reprocesa con retardo para no correr una
        // vez por cada nodo insertado.
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
