// ==UserScript==
// @name         SteamGifts Points Value (odds & cost per giveaway)
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Works out the real odds of every open SteamGifts giveaway — copies against entries, not the entry count alone — and what those odds cost you in points, so you can see where your balance is worth spending. Adds odds and value per point to each row and to the giveaway page, sorts the listing by value, and shows a widget with your balance, your level and how far the next one is. Filtering by level, library or already-entered is left to the site's own settings, which do it server-side.
// @match        https://www.steamgifts.com/*
// @author       g31w0fw0rld
// @license      MIT
// @downloadURL  https://github.com/g31w0fw0rld/steamgifts-points-value/raw/main/steamgifts-points-value.user.js
// @updateURL    https://github.com/g31w0fw0rld/steamgifts-points-value/raw/main/steamgifts-points-value.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_VERSION = '1.1.0';

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
            sortTip: 'Puts the listing best-first by value per point. The ones your level cannot reach go to the end, whatever their value. Featured stay in their own section, and the site\u2019s own blocks keep their place.',
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
            kwClear: 'Clear all ({n})',
            kwClearSure: 'Click again to clear',
            kwClearTip: 'Removes every keyword. Asks once before doing it.',
            holesTip: "For blocker users. SteamGifts slots its own bundle banners and ad slots between the rows; when a blocker empties them the container keeps its reserved height and leaves a ~200px gap. Ticking this folds away the blocks where nothing is painted — ads do not count as content, since a blocked one and a served one look the same from outside. A bundle banner that does load is left alone.",
            aboutTitle: 'What does this script do?',
            aboutName: 'Name:',
            aboutVersion: 'Version:',
            aboutAuthor: 'Author:',
            aboutBody: [
                '▸ What it works out',
                'Odds are copies ÷ entries: SteamGifts prints how many people entered, but the copies are what decides your chance, and a row without a copies label is a single copy.',
                'Value is those odds ÷ what the giveaway costs, shown as a percentage per point: how much of a chance each point buys. That is the number that says where a full balance is worth spending, and no page on the site shows it.',
                'One button pulls the pages after the one you are on into this one, keeping whatever search and filters you already have, so a whole search can be read, ranked and sorted in a single page instead of thirteen at a time.',
                'Inside a giveaway it reads that one too: the same odds and value next to its title and in the widget, plus what your balance is left at if you enter. There is nothing else on that page to compare against, so that badge carries no ranking colour.',
                '▸ What the colours mean',
                '• Green — the best quarter of this page.',
                '• Blue — the middle of the pack.',
                '• Dark grey — the worst of what is on offer here.',
                '• Pale grey — your level does not reach it.',
                'They compare the giveaways on the page against each other, not against fixed thresholds: a 0.4%/P can be the best of a quiet afternoon and the worst of a good one.',
                '▸ Settings this script assumes',
                '⚠ It repeats none of the site\u2019s filtering. SteamGifts does that server-side and better, in Account → Settings → Giveaways.',
                '• 2. Hide games you already own → Yes',
                "• 3. Hide DLC if you're missing the base game → Yes",
                '• 4. Hide giveaways above your level → Yes',
                "• 5. Hide giveaways you've already entered → Yes",
                '• 6. Hide games you manually filtered → Yes',
                'Leave 1 on All and 7 to taste. Without those, half the listing can be giveaways you cannot enter, and they drag the colour ranking with them.',
                'The one view that does cut anything is "show matches only", and it cuts by your own keyword list, which the site knows nothing about. Nothing is removed: the rows stay on the page with their badges and their place in the order, and unticking it brings them all back.',
                'And when anything matches, a second panel appears on the other side listing those giveaways. Click one to jump to it: with twenty pages loaded, that is the difference between finding your three and scrolling for them.',
                '▸ Privacy',
                'Nothing is sent to the author or to any third party. Everything you see on a page is arithmetic on what that page had already printed.',
                '⚠ One thing does go to the network, and only when you press it: "Load every page" asks this same site for the pages after this one, with your session, exactly as clicking a page number in its own pagination would. Nothing else leaves your browser.',
                'What is stored, on your own machine: whether you left the listing sorted by value, whether the widget is folded, the language you picked, whether you asked for the empty gaps to be folded, and your keywords.',
            ],
            tipOdds: 'Real odds: {copies} copies shared between {entries} entries.',
            tipOddsOne: 'Real odds: a single copy shared between {entries} entries.',
            tipCost: 'Costs {points}P, so each point buys {v}% of a chance.',
            tipFree: 'Costs no points.',
            tipLevel: 'Your level does not reach this one.',
            gaHead: 'This giveaway',
            gaCopies: '{copies} copies · {entries} entries',
            gaCopiesOne: 'a single copy · {entries} entries',
            gaValueTip: 'Odds and value of the giveaway you are looking at, worked out exactly as in the listing: copies against entries, and that chance divided by what it costs.',
            gaSolo: 'There is only one giveaway on this page, so the colour ranks nothing here.',
            gaLeft: 'Costs {points}P · {left}P left if you enter',
            gaShort: 'Costs {points}P · {miss}P short',
            gaSpent: 'Cost {points}P, already off your balance',
            gaCostTip: 'What your balance is left at if you enter, or how many points you are still missing.',
            gaFree: 'Costs no points',
            gaIn: '✓ You are already in',
            gaKwHit: 'Matches your keywords',
            loadAll: '⬇ Load every page',
            loadStop: 'Loading page {n}… — stop',
            loadTip: 'Asks the site for the pages after this one and drops their giveaways at the end of this listing, so the whole search fits on one page. It keeps whatever search and filters the address bar already has. This is the only thing in the script that goes to the network: one request per page, {delay}s apart, up to {max} pages, and you can stop it at any point.',
            loadDone: '{pages} pages more · {n} giveaways added',
            loadDoneOne: '1 page more · {n} giveaways added',
            loadNoMore: 'nothing more to load: this was the last page',
            loadFail: 'page {n} did not answer — what had loaded stays',
            side: 'Move to the other side',
            kwOnly: 'Show matches only',
            kwOnlyTip: 'Hides the rows that do not match your keywords, so a long list stops painting half the page amber. It hides nothing the site chose to show you for a reason: this is your own keyword list, which SteamGifts knows nothing about, and it is a view — untick it and everything is back. Featured stay put, and so do the site\u2019s own blocks.',
            kwOnlyEmpty: 'matches only: none on this page',
            kwOnlyNeeds: 'Add a keyword first: with none, there is nothing to match and this would empty the listing.',
            matches: 'Your matches',
            matchesTip: 'Every giveaway on the page whose name matches your keywords, in the order they appear. Click one to jump to it — useful when the listing is twenty pages long and three of them are yours.',
            jumpTip: 'Jump to this giveaway on the page',
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
            sortTip: 'Ordena el listado de mejor a peor por valor por punto. Los que tu nivel no alcanza van al final, valgan lo que valgan. Los destacados se quedan en su propia sección, y los bloques del sitio conservan su sitio.',
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
            kwClear: 'Vaciar todas ({n})',
            kwClearSure: 'Pulsa otra vez para vaciar',
            kwClearTip: 'Quita todas las palabras. Pregunta una vez antes de hacerlo.',
            holesTip: 'Para quien use bloqueador. SteamGifts intercala entre las filas sus banners de bundles y sus huecos de anuncio; cuando un bloqueador los vacía, el contenedor conserva la altura reservada y deja un hueco de unos 200 px. Al marcarlo se pliegan los bloques donde no se pinta nada —la publicidad no cuenta como contenido, porque un anuncio bloqueado y uno servido se ven igual desde fuera—. Un banner de bundle que sí carga se queda como está.',
            aboutTitle: '¿Qué hace este script?',
            aboutName: 'Nombre:',
            aboutVersion: 'Versión:',
            aboutAuthor: 'Autor:',
            aboutBody: [
                '▸ Qué calcula',
                'La probabilidad es copias ÷ entradas: SteamGifts imprime cuánta gente entró, pero son las copias las que deciden tu opción, y una fila sin etiqueta de copias es de copia única.',
                'El valor es esa probabilidad ÷ lo que cuesta el sorteo, en porcentaje por punto: cuánta posibilidad compra cada punto. Ese es el número que dice dónde conviene gastar un saldo lleno, y no aparece en ninguna página del sitio.',
                'Un botón trae a esta página las siguientes a la que estás, respetando la búsqueda y los filtros que ya tengas, para poder leer, valorar y ordenar una búsqueda entera de una vez en vez de de trece en trece.',
                'Dentro de un sorteo lee también ese: la misma probabilidad y el mismo valor junto a su título y en el widget, además de en cuánto queda tu saldo si entras. Ahí no hay nada con lo que comparar, así que esa píldora no lleva color de rango.',
                '▸ Qué dicen los colores',
                '• Verde: el mejor cuarto de esta página.',
                '• Azul: el término medio.',
                '• Gris oscuro: lo peor de lo que hay aquí.',
                '• Gris claro: tu nivel no llega.',
                'Comparan los sorteos de la página entre sí, no contra umbrales fijos: un 0,4 %/P puede ser lo mejor de una tarde floja y lo peor de una buena.',
                '▸ Ajustes que este script da por supuestos',
                '⚠ No repite ningún filtro del sitio. Eso lo hace SteamGifts del lado del servidor y mejor, en Account → Settings → Giveaways.',
                '• 2. Hide games you already own → Yes',
                "• 3. Hide DLC if you're missing the base game → Yes",
                '• 4. Hide giveaways above your level → Yes',
                "• 5. Hide giveaways you've already entered → Yes",
                '• 6. Hide games you manually filtered → Yes',
                'Deja el 1 en All y el 7 a tu gusto. Sin eso, media página pueden ser sorteos en los que no puedes entrar, y arrastran con ellos el reparto de colores.',
                'La única vista que sí recorta es «mostrar solo coincidencias», y recorta por tu lista de palabras, que el sitio no conoce. No quita nada: las filas siguen en la página, con su badge y su sitio en el orden, y al desmarcarla vuelven todas.',
                'Y cuando algo casa, aparece al otro lado un segundo panel que las lista. Pulsa una para ir a ella: con veinte páginas cargadas, esa es la diferencia entre encontrar tus tres y bajar buscándolas.',
                '▸ Privacidad',
                'No se envía nada al autor ni a ningún tercero. Todo lo que ves en una página son cuentas sobre lo que esa página ya había impreso.',
                '⚠ Una sola cosa sale a la red, y solo cuando la pulsas: «Cargar todas las páginas» le pide a este mismo sitio las páginas siguientes a esta, con tu sesión, igual que si pulsaras un número en su propia paginación. Nada más sale de tu navegador.',
                'Lo que se guarda, en tu propia máquina: si dejaste el listado ordenado por valor, si el widget está plegado, el idioma que elegiste, si pediste plegar los huecos vacíos y tus palabras clave.',
            ],
            tipOdds: 'Probabilidad real: {copies} copias repartidas entre {entries} entradas.',
            tipOddsOne: 'Probabilidad real: una sola copia repartida entre {entries} entradas.',
            tipCost: 'Cuesta {points}P, así que cada punto compra un {v}% de posibilidad.',
            tipFree: 'No cuesta puntos.',
            tipLevel: 'Tu nivel no llega a este.',
            gaHead: 'Este sorteo',
            gaCopies: '{copies} copias · {entries} entradas',
            gaCopiesOne: 'una sola copia · {entries} entradas',
            gaValueTip: 'Probabilidad y valor del sorteo que estás viendo, calculados igual que en el listado: copias contra entradas, y esa posibilidad dividida entre lo que cuesta.',
            gaSolo: 'En esta página solo hay un sorteo, así que aquí el color no ordena nada.',
            gaLeft: 'Cuesta {points}P · te quedan {left}P si entras',
            gaShort: 'Cuesta {points}P · te faltan {miss}P',
            gaSpent: 'Costó {points}P, ya descontados de tu saldo',
            gaCostTip: 'En cuánto queda tu saldo si entras, o los puntos que aún te faltan.',
            gaFree: 'No cuesta puntos',
            gaIn: '✓ Ya estás dentro',
            gaKwHit: 'Coincide con tus palabras clave',
            loadAll: '⬇ Cargar todas las páginas',
            loadStop: 'Cargando la página {n}… — parar',
            loadTip: 'Le pide al sitio las páginas siguientes a esta y deja sus sorteos al final del listado, para que la búsqueda entera quepa en una sola página. Respeta la búsqueda y los filtros que ya tenga la barra de direcciones. Es lo único del script que sale a la red: una petición por página, cada {delay} s, hasta {max} páginas, y se puede parar en cualquier momento.',
            loadDone: '{pages} páginas más · {n} sorteos añadidos',
            loadDoneOne: '1 página más · {n} sorteos añadidos',
            loadNoMore: 'no hay nada más que cargar: esta era la última página',
            loadFail: 'la página {n} no contestó — se queda lo que se había cargado',
            side: 'Pasar al otro lado',
            kwOnly: 'Mostrar solo coincidencias',
            kwOnlyTip: 'Oculta las filas que no casan con tus palabras clave, para que una lista larga deje de pintar media página de ámbar. No esconde nada que el sitio haya decidido mostrarte por algún motivo: esto es tu lista de palabras, que SteamGifts no conoce, y es una vista —al desmarcarla vuelve todo—. Los destacados se quedan, y los bloques del sitio también.',
            kwOnlyEmpty: 'solo coincidencias: ninguna en esta página',
            kwOnlyNeeds: 'Añade antes una palabra: sin ninguna no hay nada que casar y esto vaciaría el listado.',
            matches: 'Tus coincidencias',
            matchesTip: 'Los sorteos de la página cuyo nombre casa con tus palabras clave, en el orden en que aparecen. Pulsa uno para ir a él: sirve cuando el listado son veinte páginas y tres son tuyas.',
            jumpTip: 'Ir a este sorteo en la página',
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
        // Ficha de la página de un sorteo: el mismo dato repartido en otros
        // tres sitios —la cabecera destacada, el contador de la barra lateral
        // y el botón de entrar—.
        gaWrap: '.featured__outer-wrap--giveaway',
        gaHeading: '.featured__heading',
        gaName: '.featured__heading__medium',
        gaSmall: '.featured__heading__small',
        gaEntries: '.live__entry-count',
        gaEnter: '.sidebar__entry-insert',
        gaRemove: '.sidebar__entry-delete',
        gaPoints: '.sidebar__entry__points',
    };

    // Tope de puntos de la cuenta: por encima no se acumula nada.
    const POINTS_CAP = 400;
    // Valor en dólares regalados con el que empieza cada nivel, del 1 al 10.
    const LEVEL_STEPS = [0.01, 25, 50, 100, 250, 500, 1000, 2000, 3000, 5000];

    // Una petición por página y con pausa: el sitio es pequeño y esto se pide
    // a mano, así que no hay prisa. El tope existe para que un listado de
    // cientos de páginas no se cargue entero por un clic.
    const LOAD_MAX_PAGES = 20;
    const LOAD_DELAY_MS = 700;

    const MARK = 'sgpvDone';
    const BADGE_CLASS = 'sgpv-badge';
    const WIDGET_ID = 'sgpv-widget';
    const SORT_KEY = 'sgpv-sort';
    const MIN_KEY = 'sgpv-min';
    const HOLES_KEY = 'sgpv-holes';
    const KW_KEY = 'sgpv-keywords';
    const MATCH_ID = 'sgpv-matches';
    const JUMP_CLASS = 'sgpv-row--jump';
    const JUMP_MS = 1400;
    const SIDE_KEY = 'sgpv-side';
    const ONLY_KEY = 'sgpv-only';

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

    // Las dos etiquetas que el sitio imprime entre paréntesis. Ancladas al
    // nodo entero en el listado, donde cada una tiene el suyo.
    const RE_POINTS = /^\(\s*([\d,.]+)\s*P\s*\)$/i;
    const RE_COPIES = /^\(\s*([\d,.]+)\s*Cop(?:y|ies)\s*\)$/i;
    // En la cabecera de la página de un sorteo se busca sin anclar, dentro de
    // su texto entero. Verificado el 2026-08-19 con The Joust: la cabecera dice
    // "The Joust (50 Copies) (1P)", así que la etiqueta está ahí; en qué nodo
    // exacto cae no hace falta saberlo, y por eso se busca así.
    const RE_COPIES_LOOSE = /\(\s*([\d,.]+)\s*Cop(?:y|ies)\s*\)/i;

    // La aritmética de un sorteo en un solo sitio: la comparten una fila del
    // listado y la ficha de la página de un sorteo, que traen los mismos tres
    // datos leídos de sitios distintos.
    function derive(points, copies, entries) {
        // Sin entradas todavía, la siguiente en llegar se lleva una copia:
        // la probabilidad es 1, no una división por cero.
        const odds = entries > 0 ? Math.min(1, copies / entries) : 1;
        return {
            points, copies, entries, odds,
            oneIn: entries > 0 ? entries / copies : 1,
            perPoint: points > 0 ? odds / points : null,
        };
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
            const p = text.match(RE_POINTS);
            if (p) { points = toNumber(p[1]); return; }
            const c = text.match(RE_COPIES);
            if (c) copies = Math.max(1, toNumber(c[1]));
        });
        if (points === null) return null;

        const entriesLink = row.querySelector(SEL.entries);
        const entries = entriesLink ? toNumber(entriesLink.textContent) : 0;

        const levelEl = row.querySelector(SEL.level);
        const levelBlocked = !!(levelEl && levelEl.classList.contains(SEL.levelBad));

        return Object.assign(derive(points, copies, entries), {
            row, name: name.textContent.trim(), levelBlocked,
            pinned: !!row.closest(SEL.pinned),
        });
    }

    // La ficha de la página de un sorteo. Los mismos tres números que en una
    // fila, pero repartidos: el coste en la cabecera destacada (y en el botón
    // de entrar, como respaldo), las entradas en el contador de la barra
    // lateral —que el sitio refresca solo, de ahí su clase `live__`— y las
    // copias, si hay más de una, en la propia cabecera.
    function parseSingle() {
        if (!isSinglePage()) return null;
        const heading = document.querySelector(SEL.gaHeading);
        if (!heading) return null;

        let points = null;
        heading.querySelectorAll(SEL.gaSmall).forEach(node => {
            const m = node.textContent.trim().match(RE_POINTS);
            if (m) points = toNumber(m[1]);
        });
        if (points === null) {
            // El botón de la barra lateral dice lo mismo: "(10P)". Sirve de
            // respaldo si la cabecera cambia de maquetación.
            const side = document.querySelector(SEL.gaPoints);
            const m = side && side.textContent.trim().match(RE_POINTS);
            if (m) points = toNumber(m[1]);
        }
        if (points === null) return null;

        // La cabecera primero y la ficha entera como red: la cabecera es donde
        // está (verificado con un sorteo de 50 copias), y ampliar el sitio
        // donde se busca cuesta un querySelector y cubre que se mueva.
        const wrap = document.querySelector(SEL.gaWrap);
        const c = heading.textContent.match(RE_COPIES_LOOSE)
            || (wrap ? wrap.textContent.match(RE_COPIES_LOOSE) : null);
        const copies = c ? Math.max(1, toNumber(c[1])) : 1;

        const entriesEl = document.querySelector(SEL.gaEntries);
        const entries = entriesEl ? toNumber(entriesEl.textContent) : 0;

        // Solo se afirma lo que se ve: el botón de quitar la entrada existe
        // siempre, oculto con la clase del sitio mientras no estés dentro, y
        // se usa en positivo. Si un día no estuviera, el widget calla en vez
        // de dar por hecho que no has entrado.
        const remove = document.querySelector(SEL.gaRemove);
        const entered = !!(remove && !remove.classList.contains('is-hidden'));

        const nameEl = heading.querySelector(SEL.gaName);
        return Object.assign(derive(points, copies, entries), {
            heading, entered, levelBlocked: false, pinned: false,
            name: nameEl ? nameEl.textContent.trim() : (document.title || '').trim(),
        });
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
        // "Solo coincidencias" es una VISTA, no un filtro del listado: la fila
        // sigue en la página, con su badge y su sitio en el orden, solo que
        // sin pintarse. Los destacados nunca se ocultan —viven en su propia
        // sección y vaciarla dejaría una caja hueca—.
        g.row.classList.toggle('sgpv-row--off', !!g.hidden);
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

    // La misma píldora que en el listado, junto al título de la ficha. Se
    // cuela detrás de la última etiqueta entre paréntesis —el coste— para
    // quedar antes de los iconos del sitio, y no lleva color de rango: el
    // color compara con los demás sorteos de la página y aquí no hay otros,
    // así que se queda en el azul base y el aviso lo dice.
    function paintSingle(g) {
        let badge = g.heading.querySelector('.' + BADGE_CLASS);
        if (!badge) {
            badge = document.createElement('span');
            const smalls = g.heading.querySelectorAll(SEL.gaSmall);
            const anchor = smalls.length ? smalls[smalls.length - 1] : null;
            if (anchor) anchor.insertAdjacentElement('afterend', badge);
            else g.heading.appendChild(badge);
        }
        badge.className = BADGE_CLASS + ' ' + BADGE_CLASS + '--solo';
        badge.textContent = fmtOdds(g) + ' · ' + fmtPerPoint(g);
        badge.title = tooltipFor(g) + '\n' + t('gaSolo');
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
        // Los sorteos que tu nivel no alcanza van al final, valgan lo que
        // valgan: el orden contesta a "dónde conviene gastar el saldo" y ahí
        // no se puede gastar. Uno de 5P con 20 entradas daba 1,00 %/P y se
        // ponía primero mientras la línea "Mejor" del widget —que sí los
        // excluye— señalaba otro; esa contradicción era el fallo.
        if (!!a.levelBlocked !== !!b.levelBlocked) return a.levelBlocked ? 1 : -1;
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
    // Cargar las páginas siguientes en esta
    // ------------------------------------------------------------------
    // Lo único del script que sale a la red, y solo cuando se pulsa el botón.
    // Pide la misma URL que tienes delante con otro `page`, así que la
    // búsqueda y los filtros del sitio viajan tal cual; va con la sesión,
    // igual que si pulsaras "2" en la paginación.
    //
    // El bucle NO se guía por la paginación del sitio, se guía por lo que
    // llega: para cuando una página no trae ninguna fila nueva. Así funciona
    // igual si el listado tiene una sola página, si el sitio ignora el
    // parámetro y devuelve la misma, o si la maquetación de la paginación
    // cambia mañana.
    let loadState = null;

    function rowCode(row) {
        const link = row.querySelector(SEL.name);
        const m = link && String(link.getAttribute('href') || '').match(/\/giveaway\/([^/]+)/);
        return m ? m[1] : null;
    }

    function pageUrl(n) {
        const u = new URL(location.href);
        u.searchParams.set('page', String(n));
        return u.toString();
    }

    function sleep(ms) {
        return new Promise(done => setTimeout(done, ms));
    }

    // Las filas de aquí, sin las destacadas: la sección "Featured" se repite
    // en TODAS las páginas, así que sus sorteos llegarían duplicados.
    function plainRows(scope) {
        return Array.from(scope.querySelectorAll(SEL.row)).filter(r => !r.closest(SEL.pinned));
    }

    async function loadFollowingPages() {
        const seen = new Set();
        plainRows(document).forEach(r => {
            const code = rowCode(r);
            if (code) seen.add(code);
        });

        let page = loadState.from;
        const out = { pages: 0, added: 0, error: null, more: true };

        while (out.pages < LOAD_MAX_PAGES && !loadState.stop) {
            await sleep(LOAD_DELAY_MS);
            if (loadState.stop) break;
            page++;

            let doc;
            try {
                const res = await fetch(pageUrl(page), { credentials: 'same-origin' });
                if (!res.ok) throw new Error(String(res.status));
                doc = new DOMParser().parseFromString(await res.text(), 'text/html');
            } catch (e) {
                out.error = page;
                break;
            }

            // El ancla se vuelve a buscar en cada página y no se arrastra de
            // la anterior: si el listado está ordenado por valor, entre una
            // página y la siguiente las filas se han movido de sitio.
            const here = plainRows(document);
            let anchor = here[here.length - 1];
            if (!anchor || !anchor.parentNode) { out.error = page; break; }

            let fresh = 0;
            plainRows(doc).forEach(r => {
                const code = rowCode(r);
                // Sin código no hay forma de saber si ya está: se descarta,
                // que es mejor que duplicarla.
                if (!code || seen.has(code)) return;
                seen.add(code);
                const node = document.importNode(r, true);
                anchor.parentNode.insertBefore(node, anchor.nextSibling);
                anchor = node;
                fresh++;
            });

            // Ni una fila nueva: era la última página, o el sitio devolvió la
            // misma. En los dos casos no hay más que pedir.
            if (!fresh) { out.more = false; break; }

            out.added += fresh;
            out.pages++;
            loadState.pages = out.pages;
            loadState.added = out.added;
            // Repinta lo nuevo y, de paso, el propio botón con su cuenta: el
            // estado vive fuera del widget, así que sobrevive al repintado.
            run();
        }
        return out;
    }

    function startLoadAll() {
        if (loadState && loadState.running) return;
        loadState = {
            running: true, stop: false, pages: 0, added: 0, note: '', exhausted: false,
            // La página en la que estás: el contador del botón cuenta desde
            // ahí, que es la que se está pidiendo, y no desde 1.
            from: parseInt(new URL(location.href).searchParams.get('page'), 10) || 1,
        };
        run();
        loadFollowingPages().then(res => {
            loadState.running = false;
            // Solo se da por agotado si el sitio dijo que no había más. Si lo
            // paraste tú o si falló una página, el botón sigue disponible.
            loadState.exhausted = !res.error && !res.more;
            loadState.note = res.error
                ? t('loadFail', { n: nf.format(res.error) })
                : (res.added
                    ? tn(res.pages, 'loadDone', { pages: nf.format(res.pages), n: nf.format(res.added) })
                    : t('loadNoMore'));
            run();
        });
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

    function buildHolesCheck(body) {
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
    }

    function buildOnlyCheck(host, enabled) {
        const row = el('label', 'sgpv-w__check' + (enabled ? '' : ' sgpv-w__check--off'));
        const box = el('input');
        box.type = 'checkbox';
        box.checked = recall(ONLY_KEY) === '1';
        box.disabled = !enabled;
        box.addEventListener('change', () => {
            store(ONLY_KEY, box.checked ? '1' : null);
            run();
        });
        row.appendChild(box);
        row.appendChild(el('span', null, t('kwOnly')));
        // El estado guardado se muestra tal cual aunque esté inerte —mentir
        // sobre lo que hay guardado es peor—, y el aviso explica por qué no
        // hace nada.
        row.title = enabled ? t('kwOnlyTip') : t('kwOnlyNeeds');
        host.appendChild(row);
    }

    function buildWidget(list, solo) {
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

        w.classList.toggle('sgpv-w--left', recall(SIDE_KEY) === 'l');

        const head = el('div', 'sgpv-w__head');
        head.appendChild(el('span', 'sgpv-w__title', t('title')));
        // El widget está fijo, así que en ventanas estrechas tapa la columna
        // derecha de las filas —las carátulas—. En vez de elegir un lado por
        // el usuario, se le da el interruptor: según el ancho de su ventana,
        // el hueco libre está a un lado o al otro.
        const side = el('button', 'sgpv-w__min', '⇄');
        side.type = 'button';
        side.title = t('side');
        side.addEventListener('click', () => {
            const left = recall(SIDE_KEY) !== 'l';
            store(SIDE_KEY, left ? 'l' : null);
            w.classList.toggle('sgpv-w--left', left);
            // El panel de coincidencias vive en el lado contrario, así que se
            // cruza con él y no hay que pensar en los dos por separado.
            const panel = document.getElementById(MATCH_ID);
            if (panel) panel.classList.toggle('sgpv-m--right', left);
        });
        head.appendChild(side);
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

        // En la página de un sorteo no hay listado que contar ni que ordenar:
        // el hueco lo ocupa la ficha de ese sorteo, con lo mismo que dice su
        // píldora más lo que le pasa a tu saldo si entras.
        if (solo) {
            const wrap = el('div', 'sgpv-w__solo');
            wrap.appendChild(el('div', 'sgpv-w__solo-head', t('gaHead')));
            const valEl = el('div', 'sgpv-w__solo-val', fmtOdds(solo) + ' · ' + fmtPerPoint(solo));
            valEl.title = t('gaValueTip');
            wrap.appendChild(valEl);
            wrap.appendChild(el('div', 'sgpv-w__line', tn(solo.copies, 'gaCopies', {
                copies: nf.format(solo.copies), entries: nf.format(solo.entries),
            })));
            const costEl = el('div', 'sgpv-w__line');
            if (solo.entered) {
                // Ya dentro, el saldo de arriba YA no tiene esos puntos: decir
                // "te quedan 390P si entras" sería contarlos dos veces.
                wrap.appendChild(el('div', 'sgpv-w__line sgpv-w__line--best', t('gaIn')));
                costEl.textContent = t('gaSpent', { points: nf.format(solo.points) });
            } else if (solo.points === 0) {
                costEl.textContent = t('gaFree');
            } else if (solo.points <= acc.points) {
                costEl.textContent = t('gaLeft', {
                    points: nf.format(solo.points), left: nf.format(acc.points - solo.points),
                });
            } else {
                costEl.textContent = t('gaShort', {
                    points: nf.format(solo.points), miss: nf.format(solo.points - acc.points),
                });
                costEl.classList.add('sgpv-w__line--short');
            }
            costEl.title = t('gaCostTip');
            wrap.appendChild(costEl);
            if (solo.kw) wrap.appendChild(el('div', 'sgpv-w__line sgpv-w__line--kw', t('gaKwHit')));
            body.appendChild(wrap);
        } else if (plain.length) {
            const afford = plain.filter(g => !g.levelBlocked && g.points <= acc.points).length;
            const countEl = el('div', 'sgpv-w__line', tn(plain.length, 'counts', {
                n: nf.format(plain.length), afford: nf.format(afford),
            }));
            countEl.title = t('countsTip');
            body.appendChild(countEl);
        } else {
            body.appendChild(el('div', 'sgpv-w__line', t('noRows')));
        }

        if (best && !solo) {
            const bestEl = el('div', 'sgpv-w__line sgpv-w__line--best', t('bestIs', {
                odds: fmtOdds(best), value: fmtPerPoint(best),
            }));
            bestEl.title = t('bestTip');
            body.appendChild(bestEl);
        }

        const sortBtn = el('button', 'sgpv-w__btn');
        sortBtn.title = t('sortTip');
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
        // Fuera del listado el botón no se deja inerte, se quita: en la ficha
        // de un sorteo no hay nada que reordenar, ni ahora ni luego.
        if (!solo) body.appendChild(sortBtn);

        // El botón de cargar solo tiene sentido donde hay un listado que
        // continuar, y por eso no se pinta en la ficha de un sorteo.
        if (!solo) {
            const loadBtn = el('button', 'sgpv-w__btn sgpv-w__btn--ghost');
            loadBtn.type = 'button';
            loadBtn.title = t('loadTip', {
                max: nf.format(LOAD_MAX_PAGES),
                delay: nf.format(Math.round(LOAD_DELAY_MS / 100) / 10),
            });
            if (loadState && loadState.running) {
                loadBtn.textContent = t('loadStop', {
                    n: nf.format(loadState.from + loadState.pages + 1),
                });
                loadBtn.classList.add('sgpv-w__btn--on');
                loadBtn.addEventListener('click', () => { loadState.stop = true; });
            } else {
                loadBtn.textContent = t('loadAll');
                loadBtn.disabled = !plain.length || !!(loadState && loadState.exhausted);
                loadBtn.addEventListener('click', startLoadAll);
            }
            body.appendChild(loadBtn);
            if (loadState && loadState.note) {
                body.appendChild(el('div', 'sgpv-w__line', loadState.note));
            }
        }

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
            // página mientras el widget decía que no había ninguna. En la
            // ficha de un sorteo no se cuenta nada: el único sorteo que hay
            // ya lo dice su propia sección.
            if (!solo) {
                const hits = list.filter(g => g.kw).length;
                // Con la vista puesta y sin ninguna coincidencia, el listado
                // se queda vacío a propósito: hay que decirlo, porque una
                // página en blanco se lee como un fallo.
                const empty = !hits && recall(ONLY_KEY) === '1' && plain.length;
                kwWrap.appendChild(el('div', 'sgpv-w__line' + (hits ? ' sgpv-w__line--kw' : ''),
                    hits ? tn(hits, 'kwCount', { n: nf.format(hits) })
                        : (empty ? t('kwOnlyEmpty') : t('kwNone'))));
            }

            // Con listas largas, borrar de una en una con la × es inviable.
            // Va en dos pasos y no con confirm(): un diálogo del navegador
            // encima de la página es más intrusivo que un botón que pregunta.
            const clear = el('button', 'sgpv-w__clear', t('kwClear', { n: nf.format(kws.length) }));
            clear.type = 'button';
            clear.title = t('kwClearTip');
            let armed = false;
            clear.addEventListener('click', () => {
                if (!armed) {
                    armed = true;
                    clear.textContent = t('kwClearSure');
                    clear.classList.add('sgpv-w__clear--armed');
                    setTimeout(() => {
                        if (!armed || !clear.isConnected) return;
                        armed = false;
                        clear.textContent = t('kwClear', { n: nf.format(readKeywords().length) });
                        clear.classList.remove('sgpv-w__clear--armed');
                    }, 4000);
                    return;
                }
                saveKeywords([]);
                run();
            });
            kwWrap.appendChild(clear);
        }
        body.appendChild(kwWrap);

        // Las dos casillas van juntas en el cuerpo del widget, no dentro del
        // bloque de palabras: son ajustes de la vista, y aparecer y
        // desaparecer con la lista de palabras movería de sitio todo lo de
        // debajo. Ninguna se pinta en la ficha de un sorteo, donde no hay
        // listado ni bloques que plegar.
        if (!solo) {
            // Sin palabras positivas se queda inerte en vez de irse: marcarla
            // ocultaría el listado entero, que no es una vista, es un error.
            buildOnlyCheck(body, splitKeywords(readKeywords()).positive.length > 0);
            buildHolesCheck(body);
        }

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
    // Panel de coincidencias
    // ------------------------------------------------------------------
    // Índice de lo tuyo, no un segundo widget de ajustes: lista los sorteos
    // que casan con tus palabras y salta al que pulses. Cobra sentido justo
    // cuando el listado deja de caber en la pantalla —veinte páginas cargadas
    // y tres coincidencias—, que es cuando el resaltado por sí solo obliga a
    // buscar el marco ámbar a rueda de ratón.
    //
    // Va SIEMPRE en el lado contrario al widget, así que el botón ⇄ mueve los
    // dos a la vez y nunca se solapan.
    function jumpTo(g) {
        // La fila puede haber sido reemplazada por el AJAX del sitio entre que
        // se pintó el panel y el clic: si ya no cuelga del documento, se
        // repinta todo y no se salta a ninguna parte.
        if (!g.row.isConnected) { run(); return; }
        try { g.row.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        catch (e) { g.row.scrollIntoView(); }
        // Un destello aparte del marco ámbar que ya lleva por ser
        // coincidencia: si no, al saltar no se distingue a cuál se saltó.
        g.row.classList.add(JUMP_CLASS);
        setTimeout(() => g.row.classList.remove(JUMP_CLASS), JUMP_MS);
        // Y el foco al enlace del título, para que quien navegue con teclado
        // siga desde ahí y pueda abrirlo con Enter.
        const link = g.row.querySelector(SEL.name);
        if (link) { try { link.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
    }

    function buildMatchesPanel(list, solo) {
        const old = document.getElementById(MATCH_ID);
        const hits = solo ? [] : list.filter(g => g.kw && g.row.isConnected);
        if (!hits.length) {
            if (old) old.remove();
            return null;
        }

        let panel = old;
        if (!panel) {
            panel = el('div', null);
            panel.id = MATCH_ID;
            document.body.appendChild(panel);
        }
        panel.textContent = '';
        // El widget a la derecha (por defecto) deja este a la izquierda.
        panel.classList.toggle('sgpv-m--right', recall(SIDE_KEY) === 'l');

        const head = el('div', 'sgpv-m__head');
        head.appendChild(el('span', 'sgpv-m__title', t('matches')));
        head.appendChild(el('span', 'sgpv-m__count', nf.format(hits.length)));
        head.title = t('matchesTip');
        panel.appendChild(head);

        const body = el('div', 'sgpv-m__body');
        hits.forEach(g => {
            const item = el('button', 'sgpv-m__item');
            item.type = 'button';
            item.title = t('jumpTip');
            item.appendChild(el('span', 'sgpv-m__name', g.name));
            item.appendChild(el('span', 'sgpv-m__val', fmtOdds(g) + ' · ' + fmtPerPoint(g)));
            item.addEventListener('click', () => jumpTo(g));
            body.appendChild(item);
        });
        panel.appendChild(body);
        return panel;
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
    const TIP_SCOPE = '#' + WIDGET_ID + ', #' + MATCH_ID + ', .' + BADGE_CLASS;

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
        // Los dos paneles fijos se tratan igual: el aviso sale por su lado
        // libre, anclado al panel y no al control, para que no baile.
        const host = anchor.closest('#' + WIDGET_ID + ', #' + MATCH_ID);
        const inWidget = !!host;
        const scope = host || anchor;
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
            // El azul base, igual que --mid a propósito: en la ficha de un
            // sorteo no hay reparto de colores, y el aviso de la píldora lo
            // dice. El vertical-align la centra con el título, que ahí es
            // mucho más grande que en una fila.
            '.' + BADGE_CLASS + '--solo{background:#4b72d4;vertical-align:middle;}',
            '.sgpv-row--best > .giveaway__row-inner-wrap{box-shadow:inset 4px 0 0 #3d8b37;}',

            // Con muchas palabras guardadas, la lista de chips estiraba el
            // widget hasta salirse por arriba de la ventana. Ahora el widget
            // tiene techo y su cuerpo scrollea; los chips, además, tienen el
            // suyo propio para no comerse el resto de los controles.
            // display:none con !important porque quien lo pone es el sitio en
            // su propia hoja: sin la marca, una regla suya con la misma
            // especificidad y más abajo ganaría.
            '.sgpv-row--off{display:none !important;}',
            // Contorno y no sombra: el marco ámbar de coincidencia y la barra
            // verde de mejor valor ya usan box-shadow, y el destello tiene que
            // verse encima de los dos.
            '.' + JUMP_CLASS + ' > .giveaway__row-inner-wrap{outline:3px solid #9fb4e8;',
            'outline-offset:-3px;}',
            '#' + MATCH_ID + '{position:fixed;left:16px;bottom:16px;z-index:9998;width:222px;',
            'max-height:calc(100vh - 32px);display:flex;flex-direction:column;',
            'background:#2f3947;color:#e6e9ee;border:1px solid #1d2530;border-radius:6px;',
            'box-shadow:0 4px 14px rgba(0,0,0,.3);font-size:12px;line-height:1.4;}',
            '#' + MATCH_ID + '.sgpv-m--right{right:16px;left:auto;}',
            '#' + MATCH_ID + ' .sgpv-m__head{flex:0 0 auto;display:flex;align-items:center;',
            'justify-content:space-between;gap:6px;padding:6px 10px;background:#242c37;',
            'border-radius:5px 5px 0 0;cursor:help;}',
            '#' + MATCH_ID + ' .sgpv-m__title{font-weight:700;letter-spacing:.02em;}',
            '#' + MATCH_ID + ' .sgpv-m__count{font-weight:700;color:#ffcf66;}',
            '#' + MATCH_ID + ' .sgpv-m__body{overflow-y:auto;min-height:0;padding:6px;',
            'overscroll-behavior:contain;}',
            '#' + MATCH_ID + ' .sgpv-m__item{display:block;width:100%;text-align:left;',
            'font:inherit;cursor:pointer;padding:4px 6px;margin:0 0 3px;border-radius:4px;',
            'border:1px solid transparent;background:transparent;color:#e6e9ee;}',
            '#' + MATCH_ID + ' .sgpv-m__item:hover{background:#3a4655;border-color:#4b72d4;}',
            '#' + MATCH_ID + ' .sgpv-m__name{display:block;font-weight:600;',
            // El nombre completo en una línea: partirlo haría que el panel
            // cambiara de alto según los juegos que toquen ese día.
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
            '#' + MATCH_ID + ' .sgpv-m__val{display:block;color:#9fb4e8;font-size:11px;}',
            '#' + WIDGET_ID + '.sgpv-w--left{left:16px;right:auto;}',
            '#' + WIDGET_ID + '{position:fixed;right:16px;bottom:16px;z-index:9999;width:248px;',
            'max-height:calc(100vh - 32px);display:flex;flex-direction:column;',
            'background:#2f3947;color:#e6e9ee;border:1px solid #1d2530;border-radius:6px;',
            'box-shadow:0 4px 14px rgba(0,0,0,.3);font-size:12px;line-height:1.45;}',
            '#' + WIDGET_ID + ' .sgpv-w__head{display:flex;align-items:center;justify-content:space-between;',
            'padding:6px 10px;background:#242c37;border-radius:5px 5px 0 0;}',
            '#' + WIDGET_ID + ' .sgpv-w__title{font-weight:700;letter-spacing:.02em;}',
            '#' + WIDGET_ID + ' .sgpv-w__min{cursor:pointer;background:transparent;border:0;color:#9aa4b2;',
            'font-size:15px;line-height:1;padding:0 2px;}',
            '#' + WIDGET_ID + ' .sgpv-w__min:hover{color:#fff;}',
            '#' + WIDGET_ID + '.sgpv-w--min .sgpv-w__body{display:none;}',
            '#' + WIDGET_ID + ' .sgpv-w__head{flex:0 0 auto;}',
            '#' + WIDGET_ID + ' .sgpv-w__body{padding:10px;overflow-y:auto;min-height:0;}',
            '#' + WIDGET_ID + ' .sgpv-w__amount{font-size:24px;font-weight:700;color:#fff;}',
            '#' + WIDGET_ID + ' .sgpv-w__amount--cap{color:#ffcf66;cursor:help;}',
            '#' + WIDGET_ID + ' .sgpv-w__cap{font-size:11px;font-weight:600;}',
            '#' + WIDGET_ID + ' .sgpv-w__line{color:#b8c1cd;margin-top:2px;}',
            '#' + WIDGET_ID + ' .sgpv-w__line--best{color:#8bd67f;}',
            '#' + WIDGET_ID + ' .sgpv-w__line--short{color:#e29a9a;}',
            '#' + WIDGET_ID + ' .sgpv-w__solo{margin-top:8px;padding-top:8px;',
            'border-top:1px solid #3c4757;}',
            '#' + WIDGET_ID + ' .sgpv-w__solo-head{font-weight:700;color:#9fb4e8;}',
            '#' + WIDGET_ID + ' .sgpv-w__solo-val{font-size:15px;font-weight:700;color:#fff;cursor:help;}',
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
            '#' + WIDGET_ID + ' .sgpv-w__chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;',
            'max-height:104px;overflow-y:auto;overscroll-behavior:contain;}',
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
            '#' + WIDGET_ID + ' .sgpv-w__clear{margin-top:6px;cursor:pointer;font:inherit;',
            'font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid #4a5568;',
            'background:transparent;color:#9aa4b2;}',
            '#' + WIDGET_ID + ' .sgpv-w__clear:hover{color:#fff;border-color:#7d8899;}',
            '#' + WIDGET_ID + ' .sgpv-w__clear--armed{color:#ffcf66;border-color:#ffcf66;}',
            '#' + WIDGET_ID + ' .sgpv-w__check{display:flex;align-items:center;gap:7px;',
            'margin-top:10px;color:#b8c1cd;cursor:pointer;user-select:none;',
            'line-height:1.3;float:none;position:static;width:auto;}',
            '#' + WIDGET_ID + ' .sgpv-w__check input{flex:0 0 auto;width:13px;height:13px;',
            'margin:0;padding:0;cursor:pointer;accent-color:#4b72d4;float:none;position:static;}',
            '#' + WIDGET_ID + ' .sgpv-w__check span{flex:1 1 auto;min-width:0;}',
            '#' + WIDGET_ID + ' .sgpv-w__check--off{opacity:.45;cursor:default;}',
            '#' + WIDGET_ID + ' .sgpv-w__check--off input{cursor:default;}',
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

    // Un bloque ya plegado no se vuelve a medir, y esa es la clave: con
    // `display:none` mide 0 de alto, así que `showsNothing()` contestaba "aquí
    // no hay hueco" y la rama de abajo lo desplegaba. Cada pasada invertía el
    // estado de todos: el síntoma era que los huecos aparecían al marcar
    // cualquier casilla del widget y desaparecían al desmarcarla.
    //
    // Para uno ya plegado la única pregunta que queda es si el banner acabó
    // cargando, y eso se responde SIN layout: `naturalWidth` funciona con el
    // nodo oculto. Es justo el caso que hay que cazar, porque el propio
    // SteamGifts le quita la clase `hide` al banner de bundle en su `onload`
    // cuando el anuncio viene vacío.
    function hasLoadedImage(node) {
        for (const img of node.querySelectorAll('img')) {
            if (img.naturalWidth > 0) return true;
        }
        return false;
    }

    function foldEmptyBlocks(list) {
        const host = list.find(g => !g.pinned && g.row.parentElement);
        if (!host) return 0;
        const on = recall(HOLES_KEY) === '1';
        let folded = 0;
        Array.from(host.row.parentElement.children).forEach(node => {
            if (node.classList.contains('giveaway__row-outer-wrap')) return;
            if (node.id === WIDGET_ID) return;
            const wasFolded = node.dataset.sgpvFolded === '1';
            const fold = on && (wasFolded ? !hasLoadedImage(node) : showsNothing(node));
            if (fold) {
                node.dataset.sgpvFolded = '1';
                node.style.display = 'none';
                folded++;
            } else if (wasFolded) {
                // Se devuelve a su sitio al apagar la casilla, y también si el
                // banner acabó cargando más tarde.
                delete node.dataset.sgpvFolded;
                node.style.display = '';
            }
        });
        return folded;
    }

    // Con @match a todo el dominio, el widget solo tiene sentido donde hay
    // sorteos: la portada, todo lo que cuelga de /giveaways —búsquedas
    // incluidas— y la ficha de un sorteo. En el foro, el soporte o los
    // ajustes no pinta nada.
    //
    // Y, además, donde el sitio imprima filas de sorteo, cualquiera que sea
    // la ruta: la página de un juego (`/game/<id>/…`, el "More Giveaways" de
    // la ficha) lista lo mismo con el mismo marcado, y una lista de rutas se
    // queda corta en cuanto el sitio añade otra. Se pregunta por el
    // contenido, que es lo que de verdad decide si hay algo que calcular.
    function isGiveawayPage() {
        const path = location.pathname;
        if (path === '/' || path.startsWith('/giveaways') || isSinglePage()) return true;
        return !!document.querySelector(SEL.row);
    }

    // La página de un sorteo y sus pestañas: /giveaway/<código>/... cuelga
    // todo de ahí, incluidas "Entries" y "Stats", que traen la misma ficha
    // arriba.
    function isSinglePage() {
        return location.pathname.startsWith('/giveaway/');
    }

    function run() {
        const list = collect();
        injectCss();
        initTooltips();
        const kws = readKeywords();
        // La vista se apoya en que HAYA palabras positivas: `matchesKeywords`
        // devuelve false para todas si solo hay negativas, y entonces esto
        // vaciaría la página.
        const only = recall(ONLY_KEY) === '1' && splitKeywords(kws).positive.length > 0;
        list.forEach(g => {
            g.kw = matchesKeywords(g.name, kws);
            g.hidden = only && !g.kw && !g.pinned;
        });
        rankAll(list);
        list.forEach(paint);
        foldEmptyBlocks(list);
        const solo = parseSingle();
        if (solo) {
            solo.kw = matchesKeywords(solo.name, kws);
            paintSingle(solo);
        }
        buildWidget(list, solo);
        buildMatchesPanel(list, solo);
        if (recall(SORT_KEY) === '1') applySort(list, true);
        return true;
    }

    function boot() {
        run();
        if (!isGiveawayPage()) return;
        if (isSinglePage()) return watchSingle();
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

    // En la ficha no hay filas que vigilar, y lo que cambia no es la llegada
    // de nodos: el contador de entradas se refresca solo, y entrar o salir del
    // sorteo reescribe el saldo de la cabecera y cambia de clase los dos
    // botones. Así que se observan esos tres nodos —y no la barra lateral
    // entera, donde el anuncio de Google dispararía por su cuenta— con texto
    // y clases, no solo hijos.
    function watchSingle() {
        const targets = [
            document.querySelector(SEL.gaEntries),
            document.querySelector(SEL.navPoints),
            (document.querySelector(SEL.gaEnter) || {}).parentElement,
        ].filter(Boolean);
        if (!targets.length) return;
        let pending = null;
        const obs = new MutationObserver(() => {
            clearTimeout(pending);
            pending = setTimeout(run, 200);
        });
        targets.forEach(node => obs.observe(node, {
            childList: true, subtree: true, characterData: true,
            attributes: true, attributeFilter: ['class'],
        }));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
