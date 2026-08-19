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
            countsOne: '1 giveaway · {afford} within reach',
            noRows: 'no giveaways on this page',
            sortTip: 'Puts the listing best-first by value per point. Featured stay in their own section, and the site\u2019s own blocks keep their place.',
            aboutTip: 'What each number means, what the colours say and which site settings this assumes.',
            langTip: 'English and Spanish only: the site itself exists in one language. Auto follows your browser.',
            levelTip: 'Your contributor level and the giveaway value still missing for the next one.',
            countsTip: 'Giveaways on this page, and how many your current balance covers.',
            bestTip: 'The best value per point on this page, ignoring the ones your level cannot reach.',
            bestIs: 'Best: {odds} · {value}',
            sortValue: 'Sort by value',
            sortSite: '✓ Sorted by value — undo',
            about: 'ℹ️ Learn more',
            close: 'Close',
            language: 'Language',
            auto: 'Auto',
            minimise: 'Minimise',
            holes: 'Hide empty gaps',
            kwPlaceholder: 'keyword, -keyword, several, at once',
            kwHint: 'Enter to add — commas separate several at once · click a keyword to search the site for it · × removes it',
            kwCount: '{n} match your keywords',
            kwCountOne: '1 match for your keywords',
            kwNone: 'nothing matches your keywords',
            kwSearchTip: 'Search SteamGifts for "{k}"',
            kwDelTip: 'Remove',
            kwNegTip: 'Negative: hides anything containing it, even if another keyword matches',
            holesTip: "For blocker users. SteamGifts slots its own bundle banners and ad slots between the rows; when a blocker empties them the container keeps its reserved height and leaves a ~200px gap. Ticking this folds away the blocks where nothing is painted — ads do not count as content, since a blocked one and a served one look the same from outside. A bundle banner that does load is left alone.",
            aboutTitle: 'What does this script do?',
            aboutName: 'Name:',
            aboutVersion: 'Version:',
            aboutAuthor: 'Author:',
            aboutBody: [
                '▸ What it works out',
                'Odds are copies ÷ entries: SteamGifts prints how many people entered, but the copies are what decides your chance, and a row without a copies label is a single copy.',
                'Value is those odds ÷ what the giveaway costs, shown as a percentage per point: how much of a chance each point buys. That is the number that says where a full balance is worth spending, and no page on the site shows it.',
                '▸ What the colours mean',
                '• Green — the best quarter of this page.',
                '• Blue — the middle of the pack.',
                '• Dark grey — the worst of what is on offer here.',
                '• Pale grey — your level does not reach it.',
                'They compare the giveaways on the page against each other, not against fixed thresholds: a 0.4%/P can be the best of a quiet afternoon and the worst of a good one.',
                '▸ Settings this script assumes',
                '⚠ It filters nothing. SteamGifts does that server-side and better, in Account → Settings → Giveaways.',
                '• 2. Hide games you already own → Yes',
                "• 3. Hide DLC if you're missing the base game → Yes",
                '• 4. Hide giveaways above your level → Yes',
                "• 5. Hide giveaways you've already entered → Yes",
                '• 6. Hide games you manually filtered → Yes',
                'Leave 1 on All and 7 to taste. Without those, half the listing can be giveaways you cannot enter, and they drag the colour ranking with them.',
                '▸ Privacy',
                'Nothing is sent anywhere and no network request is made: everything shown is arithmetic on what the page already printed. Only your sort choice, whether the widget is folded and the language you picked are stored, on your own machine.',
            ],
            tipOdds: 'Real odds: {copies} copies shared between {entries} entries.',
            tipOddsOne: 'Real odds: a single copy shared between {entries} entries.',
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
            countsOne: '1 sorteo · {afford} a tu alcance',
            noRows: 'no hay sorteos en esta página',
            sortTip: 'Ordena el listado de mejor a peor por valor por punto. Los destacados se quedan en su sección y los bloques del sitio no se mueven de sitio.',
            aboutTip: 'Qué significa cada número, qué dicen los colores y qué ajustes del sitio da por supuestos.',
            langTip: 'Solo inglés y español: el sitio existe en un idioma. Automático sigue al navegador.',
            levelTip: 'Tu nivel de contribuidor y el valor en sorteos que falta para el siguiente.',
            countsTip: 'Sorteos de esta página y a cuántos llega tu saldo actual.',
            bestTip: 'El mejor valor por punto de esta página, sin contar los que tu nivel no alcanza.',
            bestIs: 'Mejor: {odds} · {value}',
            sortValue: 'Ordenar por valor',
            sortSite: '✓ Ordenado por valor — deshacer',
            about: 'ℹ️ Saber más',
            close: 'Cerrar',
            language: 'Idioma',
            auto: 'Automático',
            minimise: 'Minimizar',
            holes: 'Ocultar huecos vacíos',
            kwPlaceholder: 'palabra, -palabra, varias, de una vez',
            kwHint: 'Intro para añadir —las comas separan varias de una vez— · pulsa una palabra para buscarla en el sitio · × la quita',
            kwCount: '{n} coinciden con tus palabras',
            kwCountOne: '1 coincide con tus palabras',
            kwNone: 'nada coincide con tus palabras',
            kwSearchTip: 'Buscar «{k}» en SteamGifts',
            kwDelTip: 'Quitar',
            kwNegTip: 'Negativa: descarta lo que la contenga, aunque case otra palabra',
            holesTip: 'Para quien use bloqueador. SteamGifts intercala entre las filas sus banners de bundles y sus huecos de anuncio; cuando un bloqueador los vacía, el contenedor conserva la altura reservada y deja un hueco de unos 200 px. Al marcarlo se pliegan los bloques donde no se pinta nada —la publicidad no cuenta como contenido, porque un anuncio bloqueado y uno servido se ven igual desde fuera—. Un banner de bundle que sí carga se queda como está.',
            aboutTitle: '¿Qué hace este script?',
            aboutName: 'Nombre:',
            aboutVersion: 'Versión:',
            aboutAuthor: 'Autor:',
            aboutBody: [
                '▸ Qué calcula',
                'La probabilidad es copias ÷ entradas: SteamGifts imprime cuánta gente entró, pero son las copias las que deciden tu opción, y una fila sin etiqueta de copias es de copia única.',
                'El valor es esa probabilidad ÷ lo que cuesta el sorteo, en porcentaje por punto: cuánta posibilidad compra cada punto. Ese es el número que dice dónde conviene gastar un saldo lleno, y no aparece en ninguna página del sitio.',
                '▸ Qué dicen los colores',
                '• Verde: el mejor cuarto de esta página.',
                '• Azul: el término medio.',
                '• Gris oscuro: lo peor de lo que hay aquí.',
                '• Gris claro: tu nivel no llega.',
                'Comparan los sorteos de la página entre sí, no contra umbrales fijos: un 0,4 %/P puede ser lo mejor de una tarde floja y lo peor de una buena.',
                '▸ Ajustes que este script da por supuestos',
                '⚠ No filtra nada. Eso lo hace SteamGifts del lado del servidor y mejor, en Account → Settings → Giveaways.',
                '• 2. Hide games you already own → Yes',
                "• 3. Hide DLC if you're missing the base game → Yes",
                '• 4. Hide giveaways above your level → Yes',
                "• 5. Hide giveaways you've already entered → Yes",
                '• 6. Hide games you manually filtered → Yes',
                'Deja el 1 en All y el 7 a tu gusto. Sin eso, media página pueden ser sorteos en los que no puedes entrar, y arrastran con ellos el reparto de colores.',
                '▸ Privacidad',
                'No se envía nada a ninguna parte ni se hace ninguna petición de red: todo lo que ves son cuentas sobre lo que la página ya había impreso. Solo se guardan tu elección de orden, si el widget está plegado y el idioma que elegiste, en tu propia máquina.',
            ],
            tipOdds: 'Probabilidad real: {copies} copias repartidas entre {entries} entradas.',
            tipOddsOne: 'Probabilidad real: una sola copia repartida entre {entries} entradas.',
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

    // La mayoría de los sorteos son de copia única, así que el singular no es
    // un caso raro: sin esto se leía "1 copias repartidas" y "1 coinciden".
    function tn(n, key) {
        return t(n === 1 ? key + 'One' : key, arguments[2]);
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
    const HOLES_KEY = 'sgpv-holes';
    const KW_KEY = 'sgpv-keywords';

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
    // Palabras clave
    // ------------------------------------------------------------------
    // Mismo trato que en los dos scripts de drops: positivas y negativas en
    // UNA lista, las negativas con un `-` delante, y se separan al usarlas y
    // no al guardarlas. Así el almacenamiento sigue siendo un array de
    // cadenas y una versión vieja leería "-yakuza" como una palabra que no
    // casa con nada, que es el fallo inofensivo.
    function readKeywords() {
        const raw = recall(KW_KEY);
        if (!raw) return [];
        try {
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr.filter(k => typeof k === 'string') : [];
        } catch (e) { return []; }
    }

    function saveKeywords(list) {
        store(KW_KEY, list.length ? JSON.stringify(list) : null);
    }

    function splitKeywords(list) {
        const positive = [];
        const negative = [];
        (list || []).forEach(raw => {
            const k = String(raw || '').trim().toLowerCase();
            if (!k) return;
            if (k.startsWith('-')) {
                const body = k.slice(1).trim();
                if (body) negative.push(body);
            } else {
                positive.push(k);
            }
        });
        return { positive, negative };
    }

    // Casa si toca al menos una positiva Y ninguna negativa. La negativa manda
    // a propósito: "yakuza" pero no "yakuza kiwami" solo sirve si gana lo
    // segundo.
    function matchesKeywords(text, list) {
        const { positive, negative } = splitKeywords(list);
        if (!positive.length) return false;
        const hay = String(text).toLowerCase();
        if (negative.some(k => hay.includes(k))) return false;
        return positive.some(k => hay.includes(k));
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
        const lines = [tn(g.copies, 'tipOdds', { copies: nf.format(g.copies), entries: nf.format(g.entries) })];
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
        g.row.classList.toggle('sgpv-row--kw', !!g.kw);
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
        // Solo filas que sigan colgando del documento: SteamGifts reemplaza
        // una fila entera por AJAX cuando entras o sales de un sorteo con el
        // botón rápido, y la lista en memoria se queda apuntando a un nodo
        // huérfano. Sin esta guarda, el primer parentNode nulo lanzaba a
        // mitad del reparto y dejaba el listado barajado: unos marcadores
        // puestos, unas filas movidas y el resto en su sitio.
        const live = plain.filter(g => g.row.isConnected && g.row.parentNode);
        const wanted = ordered.filter(g => g.row.isConnected && g.row.parentNode);
        if (live.length !== wanted.length || !live.length) return false;

        const anchors = live.map(g => {
            const mark = document.createComment('sgpv');
            g.row.parentNode.insertBefore(mark, g.row);
            return mark;
        });
        try {
            wanted.forEach((g, i) => {
                const mark = anchors[i];
                if (mark && mark.parentNode) mark.parentNode.replaceChild(g.row, mark);
            });
            return true;
        } finally {
            // Pase lo que pase, ningún marcador se queda en la página.
            anchors.forEach(m => { if (m.parentNode) m.parentNode.removeChild(m); });
        }
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
        const plain = list.filter(g => !g.pinned && g.row.isConnected);
        if (!plain.length) return false;

        const done = reflow(plain, on
            ? plain.slice().sort(byValue)
            : plain.slice().sort((a, b) => a.siteIndex - b.siteIndex));

        plain.forEach(g => g.row.classList.remove('sgpv-row--best'));
        if (on) {
            const best = bestOf(plain);
            if (best) best.row.classList.add('sgpv-row--best');
        }
        return done;
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

        // El widget se queda aunque el listado venga vacío —una búsqueda sin
        // resultados es justo cuando hacen falta las palabras clave y el
        // saldo—, pero fuera de las páginas de sorteos no pinta nada: con
        // @match a todo el dominio, si no, saldría en el foro y en los
        // ajustes.
        const old = document.getElementById(WIDGET_ID);
        if (!isGiveawayPage() || !acc) {
            if (old) old.remove();
            return null;
        }

        let w = old;
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
            if (lvl) {
                const lvlEl = el('div', 'sgpv-w__line', lvl);
                lvlEl.title = t('levelTip');
                body.appendChild(lvlEl);
            }
        }

        if (plain.length) {
            const afford = plain.filter(g => !g.levelBlocked && g.points <= acc.points).length;
            const countEl = el('div', 'sgpv-w__line', tn(plain.length, 'counts', {
                n: nf.format(plain.length), afford: nf.format(afford),
            }));
            countEl.title = t('countsTip');
            body.appendChild(countEl);
        } else {
            body.appendChild(el('div', 'sgpv-w__line', t('noRows')));
        }

        if (best) {
            const bestEl = el('div', 'sgpv-w__line sgpv-w__line--best', t('bestIs', {
                odds: fmtOdds(best), value: fmtPerPoint(best),
            }));
            bestEl.title = t('bestTip');
            body.appendChild(bestEl);
        }

        const sortBtn = el('button', 'sgpv-w__btn');
        // Sin filas que reordenar el botón sigue visible pero inerte: quitarlo
        // movería de sitio todo lo de debajo cada vez que una búsqueda no
        // devuelve nada.
        sortBtn.disabled = !plain.length;
        sortBtn.type = 'button';
        // La etiqueta dice el ESTADO, no la acción: con "Orden del sitio" no
        // se sabía si el listado estaba ya ordenado o si el botón lo iba a
        // devolver a su sitio.
        const label = on => {
            sortBtn.textContent = on ? t('sortSite') : t('sortValue');
            sortBtn.classList.toggle('sgpv-w__btn--on', on);
        };
        label(recall(SORT_KEY) === '1');
        sortBtn.addEventListener('click', () => {
            const on = recall(SORT_KEY) !== '1';
            store(SORT_KEY, on ? '1' : '0');
            label(on);
            // Se relee el DOM en el momento del clic: la lista con la que se
            // construyó el widget puede tener minutos y filas ya sustituidas.
            applySort(collect(), on);
        });
        body.appendChild(sortBtn);

        const aboutBtn = el('button', 'sgpv-w__btn sgpv-w__btn--ghost', t('about'));
        aboutBtn.type = 'button';
        aboutBtn.title = t('aboutTip');
        aboutBtn.addEventListener('click', showAboutModal);
        body.appendChild(aboutBtn);

        // Palabras clave: la caja añade, los chips buscan y la × quita.
        const kws = readKeywords();
        const kwWrap = el('div', 'sgpv-w__kw');
        const kwInput = el('input');
        kwInput.type = 'text';
        kwInput.className = 'sgpv-w__kw-input';
        kwInput.placeholder = t('kwPlaceholder');
        kwInput.title = t('kwHint');
        kwInput.addEventListener('keydown', ev => {
            if (ev.key !== 'Enter') return;
            ev.preventDefault();
            // Las comas separan: pegar "doom, fallout, -eternal" añade tres.
            const parts = kwInput.value.split(',').map(v => v.trim()).filter(Boolean);
            if (!parts.length) return;
            const next = readKeywords();
            parts.forEach(value => {
                if (!next.some(k => k.toLowerCase() === value.toLowerCase())) next.push(value);
            });
            saveKeywords(next);
            kwInput.value = '';
            run();
        });
        kwWrap.appendChild(kwInput);

        if (kws.length) {
            const chips = el('div', 'sgpv-w__chips');
            kws.forEach(k => {
                const negative = k.trim().startsWith('-');
                const chip = el('span', 'sgpv-w__chip' + (negative ? ' sgpv-w__chip--neg' : ''));
                const text = el('a', 'sgpv-w__chip-text', k);
                // Un enlace de verdad: se puede abrir en pestaña nueva y
                // copiar la dirección, como los botones de los otros scripts.
                const term = negative ? k.trim().slice(1).trim() : k.trim();
                text.href = '/giveaways/search?q=' + encodeURIComponent(term);
                text.title = negative
                    ? t('kwNegTip') + ' · ' + t('kwSearchTip', { k: term })
                    : t('kwSearchTip', { k: term });
                const del = el('button', 'sgpv-w__chip-x', '×');
                del.type = 'button';
                del.title = t('kwDelTip');
                del.addEventListener('click', ev => {
                    ev.preventDefault();
                    saveKeywords(readKeywords().filter(x => x !== k));
                    run();
                });
                chip.appendChild(text);
                chip.appendChild(del);
                chips.appendChild(chip);
            });
            kwWrap.appendChild(chips);

            // Sobre la lista entera, destacados incluidos: si no, una
            // coincidencia en la sección "Featured" quedaba resaltada en la
            // página mientras el widget decía que no había ninguna.
            const hits = list.filter(g => g.kw).length;
            kwWrap.appendChild(el('div', 'sgpv-w__line' + (hits ? ' sgpv-w__line--kw' : ''),
                hits ? tn(hits, 'kwCount', { n: nf.format(hits) }) : t('kwNone')));
        }
        body.appendChild(kwWrap);

        const holesRow = el('label', 'sgpv-w__check');
        const holesBox = el('input');
        holesBox.type = 'checkbox';
        holesBox.checked = recall(HOLES_KEY) === '1';
        holesBox.addEventListener('change', () => {
            store(HOLES_KEY, holesBox.checked ? '1' : null);
            foldEmptyBlocks(collect());
        });
        holesRow.appendChild(holesBox);
        holesRow.appendChild(el('span', null, t('holes')));
        holesRow.title = t('holesTip');
        body.appendChild(holesRow);

        const langRow = el('div', 'sgpv-w__lang');
        langRow.title = t('langTip');
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
    // Modal «Saber más»
    // ------------------------------------------------------------------
    // Misma estructura que el de los demás scripts: ficha en rejilla arriba,
    // cuerpo scrollable con marcadores (▸ sección, ⚠ aviso, • punto) y un
    // único botón de cierre. Cambia solo la paleta, que aquí es la de la
    // cabecera de SteamGifts.
    const ABOUT_ID = 'sgpv-about-overlay';
    const ABOUT_NAME = 'SteamGifts Points Value';
    const ABOUT_REPO = 'g31w0fw0rld/steamgifts-points-value';
    const ABOUT_BG = '#2f3947';
    const ABOUT_FG = '#e6e9ee';
    const ABOUT_ACCENT = '#9fb4e8';
    const ABOUT_BTN = '#4b72d4';
    const ABOUT_WARN = '#ffcf66';
    const ABOUT_LINE = '#3c4757';
    const ABOUT_MUTED = '#9aa4b2';
    const ABOUT_ITEM = '#d5dbe4';

    // El separador de las etiquetas se toma de una ya traducida, para que
    // "GitHub" y "Ko-fi" —que no se traducen— no contradigan la puntuación
    // del idioma activo.
    function aboutColon() {
        const m = String(T.aboutVersion || ':').match(/\s*[:：]\s*$/);
        return m ? m[0] : ':';
    }

    // Marca inerte el resto de la página mientras el modal está abierto, y
    // guarda lo que hubiera para devolverlo tal cual al cerrar: sin esto el
    // tabulador se pasea por la página que hay detrás del overlay.
    function aboutSetInert(overlay, on) {
        if (on) {
            const saved = [];
            Array.from(document.body.children).forEach(node => {
                if (node === overlay) return;
                saved.push({ el: node, ariaHidden: node.getAttribute('aria-hidden') });
                try { node.setAttribute('aria-hidden', 'true'); node.inert = true; } catch (e) { /* noop */ }
            });
            overlay._savedInert = saved;
        } else {
            (overlay._savedInert || []).forEach(sv => {
                try {
                    if (sv.ariaHidden === null) sv.el.removeAttribute('aria-hidden');
                    else sv.el.setAttribute('aria-hidden', sv.ariaHidden);
                    sv.el.inert = false;
                } catch (e) { /* noop */ }
            });
            overlay._savedInert = null;
        }
    }

    function aboutRow(raw, prevKind) {
        const text = String(raw).replace(/^\s+/, '');
        const row = el('div');
        let kind = 'plain';
        if (text.startsWith('▸')) {
            kind = 'head';
            row.textContent = text.slice(1).trim();
            Object.assign(row.style, {
                color: ABOUT_ACCENT, fontWeight: '700', fontSize: '15px',
                marginBottom: '8px', marginTop: prevKind ? '20px' : '0',
            });
        } else if (text.startsWith('⚠')) {
            kind = 'warn';
            row.textContent = text;
            Object.assign(row.style, {
                color: ABOUT_WARN, fontWeight: '600', marginBottom: '10px',
                paddingInlineStart: '26px', textIndent: '-26px',
            });
        } else if (text.startsWith('•')) {
            kind = 'item';
            row.textContent = text;
            Object.assign(row.style, {
                paddingInlineStart: '24px', textIndent: '-14px',
                marginBottom: '7px', color: ABOUT_ITEM,
            });
        } else {
            row.textContent = text;
            row.style.marginBottom = '10px';
            // Un párrafo suelto detrás de una lista es la coda del bloque, no
            // otro punto: sin este respiro se lee pegado al último.
            if (prevKind && prevKind !== 'plain' && prevKind !== 'warn') row.style.marginTop = '16px';
        }
        return { row, kind };
    }

    function showAboutModal() {
        if (document.getElementById(ABOUT_ID)) return;

        const overlay = el('div');
        overlay.id = ABOUT_ID;
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0', width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px', boxSizing: 'border-box',
            background: 'rgba(0,0,0,0.6)', zIndex: '2147483647',
            transition: 'opacity 180ms ease', opacity: '0',
        });

        const box = el('div');
        Object.assign(box.style, {
            background: ABOUT_BG, color: ABOUT_FG, borderRadius: '14px',
            padding: '26px 30px', minWidth: 'min(340px, 100%)', maxWidth: '580px',
            maxHeight: '100%', boxSizing: 'border-box',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid ' + ABOUT_BTN,
            fontFamily: 'system-ui, sans-serif', fontSize: '14px', lineHeight: '1.55',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            transform: 'translateY(8px) scale(0.98)', opacity: '0',
            transition: 'transform 180ms ease, opacity 180ms ease',
        });

        const hairline = () => {
            const hr = el('div');
            Object.assign(hr.style, { height: '1px', background: ABOUT_LINE, margin: '14px 0', flexShrink: '0' });
            return hr;
        };

        const head = el('div');
        head.style.flexShrink = '0';
        const title = el('div', null, t('aboutTitle'));
        title.style.cssText = 'font-weight:bold;font-size:17px;margin-bottom:12px;color:' + ABOUT_ACCENT + ';';
        head.appendChild(title);

        const meta = el('div');
        Object.assign(meta.style, {
            display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)',
            columnGap: '10px', rowGap: '5px', fontSize: '13px',
        });
        const colon = aboutColon();
        [
            { label: t('aboutName'), value: ABOUT_NAME },
            { label: t('aboutVersion'), value: SCRIPT_VERSION },
            { label: t('aboutAuthor'), value: 'g31w0fw0rld' },
            { label: 'GitHub' + colon, value: 'github.com/' + ABOUT_REPO, isLink: true },
            { label: '☕ Ko-fi' + colon, value: 'ko-fi.com/g31w0fw0rld', isLink: true },
        ].forEach(r => {
            const label = el('div', null, r.label);
            Object.assign(label.style, { fontWeight: '600', color: ABOUT_MUTED, whiteSpace: 'nowrap' });
            meta.appendChild(label);
            const val = el('div');
            // Sin esto la URL no parte y estira la caja más allá de su maxWidth.
            Object.assign(val.style, { minWidth: '0', overflowWrap: 'anywhere' });
            if (r.isLink) {
                const a = el('a', null, r.value);
                a.href = 'https://' + r.value;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.style.color = ABOUT_ACCENT;
                a.style.textDecoration = 'underline';
                val.appendChild(a);
            } else {
                val.textContent = r.value;
            }
            meta.appendChild(val);
        });
        head.appendChild(meta);
        head.appendChild(hairline());
        box.appendChild(head);

        const body = el('div');
        Object.assign(body.style, { overflowY: 'auto', minHeight: '0', paddingInlineEnd: '4px' });
        let prevKind = null;
        (T.aboutBody || []).forEach(p => {
            const { row, kind } = aboutRow(p, prevKind);
            body.appendChild(row);
            prevKind = kind;
        });
        box.appendChild(body);
        box.appendChild(hairline());

        const closeBtn = el('button', null, t('close'));
        closeBtn.type = 'button';
        closeBtn.style.cssText = 'flex-shrink:0;align-self:center;padding:8px 18px;background:'
            + ABOUT_BTN + ';color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;';
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.opacity = '0.85'; });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.opacity = '1'; });
        box.appendChild(closeBtn);

        // El listener de Escape vive en document —el modal no tiene por qué
        // tener el foco dentro cuando llega la tecla—, así que hay que
        // quitarlo SIEMPRE al cerrar, también desde el botón: si no, se
        // acumula uno por cada apertura.
        const closeIt = () => {
            document.removeEventListener('keydown', onKey);
            overlay.removeEventListener('click', onClick);
            overlay.style.opacity = '0';
            box.style.opacity = '0';
            box.style.transform = 'translateY(8px) scale(0.98)';
            setTimeout(() => { aboutSetInert(overlay, false); overlay.remove(); }, 180);
        };
        const onKey = e => { if (e.key === 'Escape') closeIt(); };
        // Solo el fondo: un clic dentro de la caja no debe cerrar.
        const onClick = e => { if (e.target === overlay) closeIt(); };
        closeBtn.addEventListener('click', closeIt);
        overlay.addEventListener('click', onClick);
        document.addEventListener('keydown', onKey);

        overlay.appendChild(box);
        document.body.appendChild(overlay);
        aboutSetInert(overlay, true);
        setTimeout(() => {
            overlay.style.opacity = '1';
            box.style.transform = 'translateY(0) scale(1)';
            box.style.opacity = '1';
        }, 10);
        // Sin esto el foco se queda en el botón del widget, que aboutSetInert
        // acaba de marcar inert, y se cae a <body>.
        setTimeout(() => { try { closeBtn.focus(); } catch (e) { /* noop */ } }, 120);
    }

    // ------------------------------------------------------------------
    // Tooltip propio
    // ------------------------------------------------------------------
    // Sustituye al del navegador dentro del widget y en los badges. Va por
    // delegación y leyendo el `title` que los controles ya llevan puestos, en
    // vez de engancharse a cada uno: el widget se repinta entero en cada
    // pasada, así que cualquier enganche por elemento se perdería.
    //
    // Mientras la caja está arriba, el `title` se guarda en TIP_STASH y se
    // quita del elemento —es lo que evita ver los dos avisos, el nuestro y el
    // del sistema, uno encima del otro—. Al cerrarla se devuelve, así que el
    // `title` sigue estando para el nombre accesible y como respaldo si algo
    // falla.
    const TIP_ID = 'sgpv-tip';
    const TIP_STASH = 'data-sgpv-tip';
    const TIP_DELAY_MS = 250;
    const TIP_GAP = 10;
    const TIP_MARGIN = 8;
    // Un elemento deja de casar con [title] en cuanto se le guarda el aviso,
    // así que el escondite entra también en el selector: sin él, volver a
    // entrar en el mismo control se leería como salir de la zona con tooltip.
    const TIP_SELECTOR = '[title], [' + TIP_STASH + ']';
    const TIP_SCOPE = '#' + WIDGET_ID + ', .' + BADGE_CLASS;

    let tipEl = null;
    let tipAnchor = null;
    let tipPending = null;
    let tipTimer = null;
    let tipBound = false;

    function ensureTipNode() {
        if (tipEl && tipEl.isConnected) return tipEl;
        tipEl = el('div');
        tipEl.id = TIP_ID;
        tipEl.setAttribute('role', 'tooltip');
        document.body.appendChild(tipEl);
        return tipEl;
    }

    // Dos reglas según dónde viva el control, porque el sitio libre no está en
    // el mismo lado: los del widget salen a su izquierda y alineados entre sí
    // —el widget está pegado al borde, así que anclando a él los avisos no
    // bailan—; los badges, encima de la fila, y debajo si arriba no cabe.
    function positionTip(anchor) {
        const inWidget = !!anchor.closest('#' + WIDGET_ID);
        const scope = inWidget ? document.getElementById(WIDGET_ID) : anchor;
        const box = tipEl.getBoundingClientRect();
        const a = anchor.getBoundingClientRect();
        const s = scope.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;

        let left, top;
        if (inWidget) {
            left = s.left - box.width - TIP_GAP;
            if (left < TIP_MARGIN) left = s.right + TIP_GAP;
            top = a.top + a.height / 2 - box.height / 2;
        } else {
            left = a.left + a.width / 2 - box.width / 2;
            top = a.top - box.height - TIP_GAP;
            if (top < TIP_MARGIN) top = Math.min(a.bottom + TIP_GAP, vh - box.height - TIP_MARGIN);
        }
        tipEl.style.left = Math.max(TIP_MARGIN, Math.min(left, vw - box.width - TIP_MARGIN)) + 'px';
        tipEl.style.top = Math.max(TIP_MARGIN, Math.min(top, vh - box.height - TIP_MARGIN)) + 'px';
    }

    function showTip(anchor) {
        if (!anchor.isConnected) return;  // el widget se repintó durante el retardo
        const text = anchor.getAttribute('title') || anchor.getAttribute(TIP_STASH);
        if (!text) return;
        ensureTipNode();
        tipEl.textContent = text;
        anchor.setAttribute(TIP_STASH, text);
        anchor.removeAttribute('title');
        tipAnchor = anchor;
        // Primero texto y posición, y solo después visible: si no, la caja
        // aparece un fotograma en la esquina anterior antes de recolocarse.
        positionTip(anchor);
        tipEl.classList.add('sgpv-tip--on');
    }

    function hideTip() {
        clearTimeout(tipTimer);
        tipTimer = null;
        tipPending = null;
        if (tipAnchor) {
            const stashed = tipAnchor.getAttribute(TIP_STASH);
            if (stashed != null && !tipAnchor.title) tipAnchor.title = stashed;
            tipAnchor.removeAttribute(TIP_STASH);
            tipAnchor = null;
        }
        if (tipEl) tipEl.classList.remove('sgpv-tip--on');
    }

    function tipTargetFrom(node) {
        if (!node || !node.closest) return null;
        const target = node.closest(TIP_SELECTOR);
        return target && target.closest(TIP_SCOPE) ? target : null;
    }

    function tipEnter(target) {
        if (!target) { if (tipAnchor || tipPending) hideTip(); return; }
        if (target === tipAnchor || target === tipPending) return;
        hideTip();
        tipPending = target;
        tipTimer = setTimeout(() => { tipPending = null; showTip(target); }, TIP_DELAY_MS);
    }

    function initTooltips() {
        if (tipBound) return;
        tipBound = true;
        // mouseover salta en CADA elemento al que se entra, también en los que
        // no llevan aviso: por eso cierra la caja el simple hecho de salir del
        // control, sin necesidad de un mouseout aparte.
        document.addEventListener('mouseover', ev => tipEnter(tipTargetFrom(ev.target)));
        document.addEventListener('mouseleave', hideTip);
        // Por teclado sale sin retardo: llegar tabulando ya es intención.
        document.addEventListener('focusin', ev => {
            const target = tipTargetFrom(ev.target);
            hideTip();
            if (target) showTip(target);
        });
        document.addEventListener('focusout', hideTip);
        window.addEventListener('scroll', hideTip, { passive: true, capture: true });
        window.addEventListener('resize', hideTip, { passive: true });
        document.addEventListener('click', hideTip, true);
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

            '#' + WIDGET_ID + '{position:fixed;right:16px;bottom:16px;z-index:9999;width:248px;',
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
            '#' + WIDGET_ID + ' .sgpv-w__btn:hover:not(:disabled){filter:brightness(1.12);}',
            '#' + WIDGET_ID + ' .sgpv-w__btn:disabled{opacity:.45;cursor:default;}',
            '#' + WIDGET_ID + ' .sgpv-w__btn--on{background:#3d8b37;border-color:#3d8b37;}',
            '#' + WIDGET_ID + ' .sgpv-w__btn--ghost{background:transparent;color:#9fb4e8;}',
            // SteamGifts trae sus propios estilos de formulario, y con solo
            // display:flex el <span> se comprimía hasta partir la etiqueta en
            // tres líneas con la casilla suelta a un lado. Cada pieza lleva
            // aquí su tamaño y su comportamiento de flex, sin heredar nada.
            // Marco completo y no un fondo tenue: sobre el gris del listado, un
            // amarillo al 16% se perdía. El de "mejor valor" es una barra a la
            // izquierda, así que cuando una fila es las dos cosas se ven ambas.
            '.sgpv-row--kw > .giveaway__row-inner-wrap{background:rgba(255,207,102,.28);',
            'box-shadow:inset 0 0 0 2px #e0a92e;}',
            '.sgpv-row--kw.sgpv-row--best > .giveaway__row-inner-wrap{',
            'box-shadow:inset 0 0 0 2px #e0a92e, inset 5px 0 0 #3d8b37;}',
            '#' + TIP_ID + '{position:fixed;z-index:100002;max-width:290px;padding:8px 10px;',
            'background:#3a4655;color:#f2f5f9;border:1px solid #4b72d4;border-radius:6px;',
            'box-shadow:0 4px 16px rgba(0,0,0,.55);font-family:system-ui,sans-serif;',
            // pre-line y no normal: los avisos de los badges vienen en varias
            // líneas y con `normal` se leerían todas seguidas.
            'font-size:12px;line-height:1.4;white-space:pre-line;pointer-events:none;',
            'opacity:0;transition:opacity .12s ease;}',
            '#' + TIP_ID + '.sgpv-tip--on{opacity:1;}',
            '.' + BADGE_CLASS + '[' + TIP_STASH + ']{cursor:help;}',
            '#' + WIDGET_ID + ' .sgpv-w__kw{margin-top:10px;}',
            '#' + WIDGET_ID + ' .sgpv-w__kw-input{width:100%;box-sizing:border-box;font:inherit;',
            'padding:4px 7px;border-radius:4px;border:1px solid #4a5568;background:#1f2733;',
            'color:#e6e9ee;}',
            '#' + WIDGET_ID + ' .sgpv-w__kw-input::placeholder{color:#7d8899;}',
            '#' + WIDGET_ID + ' .sgpv-w__chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;}',
            '#' + WIDGET_ID + ' .sgpv-w__chip{display:inline-flex;align-items:center;gap:3px;',
            'padding:1px 3px 1px 7px;border-radius:11px;border:1px solid #4a5568;background:#1f2733;',
            'font-size:11px;}',
            '#' + WIDGET_ID + ' .sgpv-w__chip--neg{border-style:dashed;border-color:#c26a6a;}',
            '#' + WIDGET_ID + ' .sgpv-w__chip-text{color:#cfd6e0;text-decoration:none;cursor:pointer;}',
            '#' + WIDGET_ID + ' .sgpv-w__chip--neg .sgpv-w__chip-text{color:#e29a9a;}',
            '#' + WIDGET_ID + ' .sgpv-w__chip-text:hover{text-decoration:underline;}',
            '#' + WIDGET_ID + ' .sgpv-w__chip-x{cursor:pointer;border:0;background:transparent;',
            'color:#8b95a4;font:inherit;line-height:1;padding:0 3px;}',
            '#' + WIDGET_ID + ' .sgpv-w__chip-x:hover{color:#fff;}',
            '#' + WIDGET_ID + ' .sgpv-w__line--kw{color:#ffcf66;}',
            '#' + WIDGET_ID + ' .sgpv-w__check{display:flex;align-items:center;gap:7px;',
            'margin-top:10px;color:#b8c1cd;cursor:pointer;user-select:none;',
            'line-height:1.3;float:none;position:static;width:auto;}',
            '#' + WIDGET_ID + ' .sgpv-w__check input{flex:0 0 auto;width:13px;height:13px;',
            'margin:0;padding:0;cursor:pointer;accent-color:#4b72d4;float:none;position:static;}',
            '#' + WIDGET_ID + ' .sgpv-w__check span{flex:1 1 auto;min-width:0;}',
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

    // Entre las filas, SteamGifts intercala sus propios bloques de promoción
    // de bundles —clase ofuscada que cambia en cada carga, uno cada trece
    // filas—. Si un bloqueador los vacía, el div conserva la altura reservada
    // y deja un hueco de unos 200 px en mitad del listado.
    //
    // Va detrás de una casilla y apagado por defecto: el hueco no lo crea
    // este script, y esos banners son del sitio. Quien no use bloqueador no
    // tiene nada que plegar.
    //
    // "No muestra nada" no es "no tiene contenido": el bloque trae el banner
    // de Fanatical entero —con su título, su fecha y su precio— pero con la
    // clase `hide` del sitio, y debajo un <div> con 25px de padding arriba y
    // abajo envolviendo el <ins> de Google. O sea que hay texto de sobra en el
    // DOM; lo que no hay es nada pintado. Por eso se mide lo que ocupa en
    // pantalla, no lo que existe en el árbol.
    function isVisible(node) {
        if (!node.getClientRects || !node.getClientRects().length) return false;
        const r = node.getBoundingClientRect();
        return r.height > 1 && r.width > 1;
    }

    function showsNothing(node) {
        // Si el propio bloque no ocupa alto, no hay hueco que plegar. Además
        // sirve de red de seguridad donde no haya layout: sin medidas, esto
        // devuelve false y no se toca nada.
        if (!node.getBoundingClientRect || node.getBoundingClientRect().height <= 8) return false;

        for (const child of node.querySelectorAll('*')) {
            const tag = child.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
            if (!isVisible(child)) continue;
            if (tag === 'IMG') {
                if (child.naturalWidth > 0) return false;
                continue;
            }
            // La publicidad NO cuenta como contenido, y es deliberado: un
            // <ins> de Google bloqueado y uno servido se ven igual desde
            // fuera —ambos reservan su alto, y el iframe es de otro dominio,
            // así que no hay forma de mirar dentro—. Marcar la casilla es la
            // declaración del usuario de que usa bloqueador y de que ahí no
            // ve nada; quien no la marque no pliega nada.
            if (tag === 'INS' || tag === 'IFRAME') continue;
            if (tag === 'VIDEO' || tag === 'CANVAS' || tag === 'SVG') return false;
            // Texto propio del nodo, no el heredado de sus descendientes: si
            // no, el contenedor de más arriba contaría por todos.
            for (const n of child.childNodes) {
                if (n.nodeType === 3 && n.textContent.trim()) return false;
            }
        }
        return true;
    }

    function foldEmptyBlocks(list) {
        const host = list.find(g => !g.pinned && g.row.parentElement);
        if (!host) return 0;
        const on = recall(HOLES_KEY) === '1';
        let folded = 0;
        Array.from(host.row.parentElement.children).forEach(node => {
            if (node.classList.contains('giveaway__row-outer-wrap')) return;
            if (node.id === WIDGET_ID) return;
            if (on && showsNothing(node)) {
                node.dataset.sgpvFolded = '1';
                node.style.display = 'none';
                folded++;
            } else if (node.dataset.sgpvFolded === '1') {
                // Se devuelve a su sitio al apagar la casilla, y también si el
                // banner acaba cargando más tarde.
                delete node.dataset.sgpvFolded;
                node.style.display = '';
            }
        });
        return folded;
    }

    // Con @match a todo el dominio, el widget solo tiene sentido donde hay
    // sorteos: la portada y todo lo que cuelga de /giveaways, búsquedas
    // incluidas. En el foro, el soporte o los ajustes no pinta nada.
    function isGiveawayPage() {
        const path = location.pathname;
        return path === '/' || path.startsWith('/giveaways');
    }

    function run() {
        const list = collect();
        injectCss();
        initTooltips();
        const kws = readKeywords();
        list.forEach(g => { g.kw = matchesKeywords(g.name, kws); });
        rankAll(list);
        list.forEach(paint);
        foldEmptyBlocks(list);
        buildWidget(list);
        if (recall(SORT_KEY) === '1') applySort(list, true);
        return true;
    }

    function boot() {
        run();
        if (!isGiveawayPage()) return;
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
