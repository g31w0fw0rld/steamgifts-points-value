// ==UserScript==
// @name         SteamGifts Points Value (odds & cost per giveaway)
// @namespace    http://tampermonkey.net/
// @version      1.2.0
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

    const SCRIPT_VERSION = '1.2.0';

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
            pointsTip: 'Your balance, read from the site header. SteamGifts stops at 400P: once you are there, every point it would hand you is lost until you spend.',
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
                'And a checkbox turns those keywords into alerts: every 15 minutes it reads the whole giveaway listing, page by page, and flags every giveaway matching them in the matches panel —with a bell, a count and a beep— on whatever page of SteamGifts you have open —the forum included, which is where you would not notice on your own—. Having read those pages, it leaves them loaded in the listing too when you are on the front page with nothing filtered, which is the same thing the load button does, for free. It beeps every 5 seconds until you mark it as seen —right there in the panel—, and what you marked never alerts again. It runs that whole pass on every page you open too, not only every 15 minutes, and those do not reset the clock: the loop counts from its own last pass, so it fires on time however much you reload. Ticking or unticking it clears the alerts and checks straight away. There are no desktop notifications on purpose: the alert lives in this tab, and asking for notification permission is not something you can undo from here.',
                '▸ Privacy',
                'Nothing is sent to the author or to any third party. Everything you see on a page is arithmetic on what that page had already printed.',
                '⚠ Two things go to the network, and both only to this same site, with your session, exactly as clicking a link on it would: "Load every page", when you press it, asks for the pages after this one; and the alerts, if you tick them, read the whole listing every 15 minutes —one request per page, 0.7s apart, and only from one tab—. Nothing else leaves your browser, and nothing at all is sent to the author.',
                'What is stored, on your own machine: your keywords, the language you picked, and how you left the page — sorted by value or not, matches only or not, empty gaps folded or not, which side the widget sits on, and whether the widget and the matches panel are folded. With the alerts on it also keeps the list of giveaways it has alerted you about and which ones you marked as seen — that list is what stops the same game from alerting twice.',
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
            alerts: 'Alert me about new ones',
            alertsTip: 'Every {mins} minutes it reads the whole giveaway listing —page by page, {delay}s apart, up to {max} pages— and beeps for every giveaway matching your keywords, whatever page of SteamGifts you have open. Since it has read those pages anyway, it also leaves them loaded in the listing when you are on the front page with no search or filter, so you get the whole listing without pressing anything. It also does that whole pass every time you open or navigate to a page of the site —the whole listing, whenever the last one was— so a listing you have just landed on arrives already complete and already checked. Those do not push the clock back: the {mins} minutes are the wait of the loop itself, counted from the last pass of the loop itself, so it fires on time however much you reload. It beeps every {beep} seconds until you mark it as seen, and what you marked never alerts again. Ticking or unticking this clears the alerts and checks straight away, so turning it on tells you what is there right now. Only one tab does the asking. Nothing is sent anywhere else, and there are no desktop notifications: the alert lives in this tab.',
            alertsNeeds: 'Add a keyword first: with none there is nothing to alert about.',
            alertsSeenOne: 'Mark as seen — it will not alert again',
            alertsCount: '{n} of these turned up since you last looked',
            alertsElsewhere: 'Not on this page, so there is nowhere to jump to. Its odds and value are the ones it had when it was found.',
            alertsSeenAll: 'Mark all as seen',
            alertsLast: 'checked at {time}',
            alertsScanning: 'checking…',
            alertsFail: 'could not read the giveaway listing',
            alertsNow: 'Check now, without clearing what is already listed',
            alertsQuiet: 'nothing new since {time}',
            alertsFirstClick: 'The beep may need you to click the page once: browsers do not let a tab play sound before you interact with it.',
            matches: 'Your matches',
            matchesTip: 'Every giveaway on the page whose name matches your keywords, in the order they appear. Click one to jump to it — useful when the listing is twenty pages long and three of them are yours. It never opens the giveaway: for that, click its row in the listing as you normally would.',
            matchesAlertTip: 'Your keyword matches, and the alerts among them. What turned up since you last looked comes first with a 🔔; the eye marks one as seen, the one in the header marks them all, and what you marked never alerts again. Click an entry to jump to its row — it never opens the giveaway, for that click the row itself as you normally would.',
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
            pointsTip: 'Tu saldo, leído de la cabecera del sitio. SteamGifts se detiene en 400P: al llegar ahí, cada punto que te tocaría se pierde hasta que gastes.',
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
                'Y una casilla convierte esas palabras en avisos: cada 15 minutos lee el listado de sorteos entero, página por página, y marca cada uno que casa en el panel de coincidencias —con campana, cuenta y pitido— en cualquier página de SteamGifts que tengas abierta —el foro incluido, que es justo donde no te enterarías por tu cuenta—. Y ya que ha leído esas páginas, las deja cargadas en el listado si estás en la portada sin nada filtrado, que es lo mismo que hace el botón de cargar, gratis. Pita cada 5 segundos hasta que lo marques como visto —ahí mismo, en el panel—, y lo marcado no vuelve a avisar. Esa pasada —el listado entero— la hace también en cada página que abres, no solo cada 15 minutos, y esas no reinician el reloj: el bucle cuenta desde su propia última pasada, así que llega a su hora aunque recargues sin parar. Marcarla o desmarcarla borra los avisos y revisa al momento. No hay notificaciones del escritorio a propósito: el aviso vive en esta pestaña, y pedir permiso de notificaciones no es algo que puedas deshacer desde aquí.',
                '▸ Privacidad',
                'No se envía nada al autor ni a ningún tercero. Todo lo que ves en una página son cuentas sobre lo que esa página ya había impreso.',
                '⚠ Dos cosas salen a la red, y las dos solo a este mismo sitio, con tu sesión, igual que si pulsaras un enlace suyo: «Cargar todas las páginas», cuando la pulsas, pide las páginas siguientes a esta; y los avisos, si los marcas, leen el listado entero cada 15 minutos —una petición por página, cada 0,7 s, y solo desde una pestaña—. Nada más sale de tu navegador, y al autor no se le manda nada de nada.',
                'Lo que se guarda, en tu propia máquina: tus palabras clave, el idioma que elegiste y cómo dejaste la página —ordenada por valor o no, solo coincidencias o no, huecos vacíos plegados o no, de qué lado está el widget, y si el widget y el panel de coincidencias están plegados—. Con los avisos puestos guarda además la lista de sorteos de los que te avisó y cuáles marcaste como vistos: esa lista es lo que evita que el mismo juego avise dos veces.',
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
            alerts: 'Avisarme de los nuevos',
            alertsTip: 'Cada {mins} minutos lee el listado de sorteos entero —página por página, cada {delay} s, hasta {max} páginas— y pita por cada sorteo que casa con tus palabras clave, en cualquier página de SteamGifts que tengas abierta. Y como esas páginas ya las ha leído, las deja cargadas en el listado cuando estás en la portada sin búsqueda ni filtros, así que tienes el listado entero sin pulsar nada. Esa pasada la hace además cada vez que abres o navegas a una página del sitio —el listado entero, sin mirar cuándo fue la anterior—, así que un listado al que acabas de llegar te llega ya completo y ya revisado. Y no retrasan el reloj: los {mins} minutos son la espera del bucle, contados desde su propia última pasada, así que llega a su hora aunque recargues sin parar. Pita cada {beep} segundos hasta que lo marques como visto, y lo marcado no vuelve a avisar nunca. Marcarla o desmarcarla borra los avisos y revisa al momento, así que encenderla te dice qué hay ahora mismo. Solo una pestaña pregunta. No se manda nada a ninguna otra parte, y no hay notificaciones del escritorio: el aviso vive en esta pestaña.',
            alertsNeeds: 'Añade antes una palabra: sin ninguna no hay de qué avisar.',
            alertsSeenOne: 'Marcar como visto — no volverá a avisar',
            alertsCount: '{n} de estos han aparecido desde la última vez',
            alertsElsewhere: 'No está en esta página, así que no hay a dónde saltar. Su probabilidad y su valor son los que tenía al encontrarlo.',
            alertsSeenAll: 'Marcar todos como vistos',
            alertsLast: 'revisado a las {time}',
            alertsScanning: 'revisando…',
            alertsFail: 'no se pudo leer el listado de sorteos',
            alertsNow: 'Revisar ahora, sin borrar lo que ya está en la lista',
            alertsQuiet: 'nada nuevo desde las {time}',
            alertsFirstClick: 'El pitido puede necesitar que pulses una vez en la página: los navegadores no dejan sonar a una pestaña con la que no has interactuado.',
            matches: 'Tus coincidencias',
            matchesTip: 'Los sorteos de la página cuyo nombre casa con tus palabras clave, en el orden en que aparecen. Pulsa uno para ir a él: sirve cuando el listado son veinte páginas y tres son tuyas. Nunca abre el sorteo: para eso pulsa su fila en el listado, como harías normalmente.',
            matchesAlertTip: 'Tus coincidencias, y entre ellas los avisos. Lo que ha aparecido desde la última vez va primero con un 🔔; el ojo marca uno como visto, el de la cabecera marca todos, y lo marcado no vuelve a avisar. Pulsa una entrada para ir a su fila: nunca abre el sorteo, para eso pulsa la fila misma como harías normalmente.',
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
        // Firma de los bloques que el sitio intercala entre las filas. La
        // clase del contenedor es ofuscada y cambia en cada carga —se han
        // visto `idbknxm`, `wdisf` y `kzbjrk`—, así que no sirve para
        // reconocerlos; lo que no cambia es lo que llevan dentro: el banner de
        // bundle de Humble/Fanatical, el hueco de anuncio de Google, o los dos.
        promo: '.fanatical_container, ins.adsbygoogle',
        pagination: '.pagination',
        pagResults: '.pagination__results',
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
    const MMIN_KEY = 'sgpv-mmin';
    const ONLY_KEY = 'sgpv-only';

    // Avisos de sorteos nuevos que casan con tus palabras. No tienen panel
    // propio: viven en el de coincidencias, que es el sitio donde ya se
    // buscaban los juegos de tu lista.
    const ALERT_KEY = 'sgpv-alert-list';
    const ALERT_ON_KEY = 'sgpv-alerts-on';
    const ALERT_LAST_KEY = 'sgpv-alerts-last';
    // Dos relojes y no uno, porque no miden lo mismo: `last` es la última
    // pasada de cualquier clase y es lo que enseña el panel; `cycle` es el que
    // gobierna el cuarto de hora, y solo lo mueve el propio bucle. Con una sola
    // marca —como estaba— cada carga de página adelantaba el cuarto de hora, así
    // que navegando por el sitio el bucle no llegaba a disparar nunca: cada
    // navegación le devolvía el reloj a cero.
    const ALERT_CYCLE_KEY = 'sgpv-alerts-cycle';
    const ALERT_LOCK_KEY = 'sgpv-alerts-lock';
    // Cada cuarto de hora, y el reloj se comprueba cada minuto en vez de
    // programar un timer de 15 min: una pestaña dormida no dispara timers
    // largos con puntualidad, y así el retraso máximo es de un minuto.
    const ALERT_EVERY_MS = 15 * 60 * 1000;
    const ALERT_TICK_MS = 60 * 1000;
    const ALERT_BEEP_MS = 5000;
    const ALERT_VOLUME = 0.75;
    // Cada pasada recorre el listado ENTERO, así que el tope es el mismo que el
    // del botón de cargar a mano: es la misma idea de "todas las páginas".
    const ALERT_MAX_PAGES = LOAD_MAX_PAGES;
    // Un sorteo marcado como visto se guarda para no volver a avisar de él, y
    // eso obliga a que la lista caduque MUY tarde: si una entrada se borrara
    // mientras su sorteo sigue abierto, volvería a avisar. Sesenta días pasan
    // de largo de cualquier sorteo real.
    const ALERT_TTL_MS = 60 * 24 * 60 * 60 * 1000;
    const ALERT_MAX_ENTRIES = 400;
    // Solo una pestaña sondea. El dueño refresca su marca mientras trabaja y
    // se da por muerto pasado el plazo, así que cerrar la pestaña que sondeaba
    // no deja a las demás calladas para siempre.
    const ALERT_LOCK_MS = 90 * 1000;
    const TAB_ID = 'sgpv-' + Math.random().toString(36).slice(2) + '-' + Date.now();

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
    // Avisos de sorteos nuevos
    // ------------------------------------------------------------------
    // Lo segundo del script que sale a la red, y como lo primero, solo si lo
    // pides: detrás de una casilla apagada por defecto. Cada cuarto de hora
    // pregunta por los sorteos más nuevos y avisa de los que casan con tus
    // palabras clave, en cualquier página del sitio que tengas abierta.
    //
    // NO hay notificaciones del escritorio, y es una decisión, no un olvido:
    // el aviso vive en esta pestaña —campana, contador en el título y pitido—.
    // Pedir permiso de notificaciones al cargar es de las pocas cosas que un
    // userscript hace que el usuario no puede deshacer sin ir a los ajustes
    // del navegador, y aquí no hace falta para nada. Es la misma conclusión a
    // la que llegaron los scripts de drops de Kick y Twitch, que las tenían y
    // las quitaron.
    //
    // El pitido: sonido de «logro desbloqueado» de Steam, en base64.
    //
    //   ↓↓↓  PEGA EL DATA URI COMPLETO ENTRE LAS COMILLAS  ↓↓↓
    const ALERT_SOUND = 'data:audio/mpeg;base64,//vgQAAAD/wAS4AAAAmcgAlwAAABCUABLhQAACAAACXCgAAE//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+0BLEAAHi0AABU//vgQAAACsxlxu5+wADvDMi8z9gAGlWXU13MgDtTsuoruZAHDYkDIbEodCYUBYEBgL/0VwYATGGeggBjXBZZ/mAoAERgOQA4Z00OVGm2Fcn+YAqALsuMAcBwTAzwBzAGA2LwDQ6P8DA4KriwCCA+QMdALgMXIiwMJBBPImLGTDAZRBeAYJQtAYPAfgYhwm/Jxd0AcFgBQCYXOAUAIFoP80oMsDAiAEDA2BkCgJgMFQAgMQQRgHAV/um/cCwDwaACAwKAUBQABRFlitP//w5wXADrAwGAAC4QL6CNx0ij//Ts/8GwWHzDYDLhOmYgONIiAoMWX//7aH39Y7CCFkliPODnl9IoHDQ3Z////0zhlTUDRdZc0O//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8JBsKBQKBMYcIMML/JgAIwAoAcMItA/DGbjAr/MAmABDATgCY0U4k2M9kJjv9Dql2YXoG6mEAgKGAoAsjAM8x7gMrhHueIYToGQAOgGkk2IGM8FXjjFjJhgMSgZgMPoAgMIADAMDIFfk4tzdADDECAMvg2DAiAYHAA/skaMmDd4GBEDYRBkBg6AUBi2DQBgAAz/p+4DAGw9oDAQBACQBBBQiAfJ/+h8LjBcAMeAMBQWQHKCDw/MOP/+nb94XDiCw2AyIOEkwy+NISgILix/////k2OAiBiXRz1DNm5fJwuE45t////6ZRDQO2FxAKmaZVVqTdTklVuL/ISgaADBoQKsENWGkxUFzAxNCopEgSXEHhizbKpijOGojR1NymhseDXDTOxalSCBPlwmOVbyZAkLnr5W/ccg0YFn6WndzGMWsph5Nu3B80pWs+bir3v/L/5jFLxhYEWD+42b3ctT9Lm2d7eZ4Y4ay7rHPCvST/a9jGWXta7ASaMMxmz+Hd17tPbTQdf6aSZ08i3vmGUo3T4/qrqpY3Z/bjWOVN65l/N12MSvkoz7hSb5axwz3h+fM793fLmV2LznO/lqv/f7HY0kIIqA05KU5K6SPSgRc4w2HBWkGXjGYqCZggwmJxSmqnQJAm3zDJN8KCxuzZxU7LRQ7xdkDPEWkZ0mkLC7lAGQW89sxOuGnMpFjYq+JCsNTcVBZa5IqZ9H4nHDe6YXurBG34po7D+dfPGJmBoVpS3+Yc19ez2Horv//Xf/u63K+GVvfPsc/+R5aNfnP1+5XnT4peJ55U0k5TyLe7PK0oxp9/hVuVKTGz3Fk1jlTHWOseY3VHJXjSZ/YpM8bVW5bzw5njnbu7vXMrsDyD9ayy3u/l2SxZIQk//vgQAAAClFm1euZy2zTDOq9czltnUWdTa3jTbuis6p1vOW3sRJKaltzltyuVTLlL/MRMPz4y6C1fCgPEitLx0FJN2seZo6n+gr6dtaoUgbMVYPeohQceVRCbd/nP4lw30lpXhMINgLOQSI58EqUpqw5Cr/wzLLEeh6qwlMCNptQhuri1cJO3SFGnUNw3JFKsvs5y2KZqUy2WV6G3Kqex+P1buMH5x2ns3pHh81Kp5BNXlfZDcry6plbtCoDlV697WMuqbpOUsC/Cc7Vy/PZ48txiyvF7auVbl+hs0da23Z85FezsU+F7diZuT09a5uvrdumwx3m8MUvbxs493njubkN245f////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////6IklNSW5OW5QVTJiJZp1TE9CM1gVbwgBoYWpeOgpKPuOs0QTxQbaza+UoG3o2mfqJLLhp4otD0BoIq1WXy16QYHegUutNzLWXysQNf96ZZKK0BTCSqYMiTshyA53fKd6H7MXYm9nscufztmzjAOdjO7nrX95+t53+3c+Xp/n6rWmVXa/b1zO1U7btJbL+hd2z+NNhjKNUsC/Ca9q5fo7++UcYvLxg6r2thfocZ+tTt2fOT2O4U+GP2JmpPSK/+NPUz7Taz3m8Mgsb/7Ped5uSyHdblYAAbdl3TtlQNJgpipdJ+TBWYpZlnuaHD1Ch2IhK/9uXjACfEJz5puiB/EZC5064RaJxX2wltQQjGiugyi00qLNumIcHsQVMXkRhZzCppmLJoy/CgymIMAL4S9XSY8Os1Eh4N50kQd4wMkOgxbHOZraxj9q5A3YlCZ2dqYWN3+6yjkspKKeVzFZTXux15IuiiwSZpoCpHRlLuNdb15LSNspoL83Qyp8ocypIzAsWhqZyi01U7RRKzhYlczrPKVWLNmta1DUvq2MaL+2+crWcaOd3Ur27NJKI/U3Z1j2/2SUWVSfxrymQU2VnKwkkyTb/p23Jqq+T5L1PyYS7Dc0qNggQTR8lAiIao+T88WBAWKyXH9LYIj4eJRAsFBrAgaEmEIRXAYgvgyzy+BMEjy/rFjBGYuSlAKVbyYbT4jLnXft3UEVK3BBl2U70CoHgMDBtBWZEP/F0mdGHiPiv1Le1bmsatXDKerXeUv3rX9/mpikpLF9xbNXe5mQT7EX4mcpqklNWKQ7CZBHt28rdPN5TsszpMZDflVXd+5U3IY9O6lledwzyprHKW5LrDhXZThjOdzn7li5LbEjs7qZ352kiEllHaXdm/fygqTZVLf3YzIKbKzS//vgQAAACiJlU+uZy27RzJpdcxpt3oWfU61jTbuXs6n1rGW2sKKcts2zkkrFW3YIXbdQeCR7sKBgPQQJ1TaSxi0GQ3Yo4wkcacqxr3JBDSM1OzJOmvE4RRW7kpvI8oD1iv3HF9JhMHXpMNQc1fyzGDrWbHLo9C3rhDA2my6NRxpMJbpI91ZQ77amlzAc5QUsf3YqQTR09A2OPUMfdh5cXKlOOquUzL41nA1FN8tVrMzuZ3yklVy7ZmLNBaxh3Keo+UuGWMjrVuy3d+5qvqzW1ncu5y6tWyx5KJyW5zNJR2KSd5N6mqa/e7SV7lu3lZqT92P1a9TeW6/bErt28rFi63ef////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////6wQVJbLslG4oSxdyEw4ERKOgg5CtMh2rqqRhsCSuxIpQh8cRtencYQ7RaqdW0W9qdU1hMAvlTzCAEeFEn4h6Nz7tvushh8xi2i+aSbZ0qV44Pawsdmj3RqCFKXZaI5epXRO+ywy09QGUTEzKa81RWbOeF/HLPmHcd4/jqMwPGqdtpNJcJ6VWY7nEd40kqwqxmgvVrUxa+eo+Y4axn7Ws7O7+tZ9xufnWu2+Za1v6lFZ7VpMbFJZ5zK5TX8Pwz1nay5hb3Q4563lvPvK9u3ly8LNX0JTcm+/91tyxFpvQkfAAjgnnGP+SBHUxQQDSSlpJTGyQARqjx1jMSKWKHKvj7UkB9tlLLYcdQc4pyvRVsoTnbMhPo0w1RJ4KWQ2quu4oE5LDWAyavAUtjDdGeP21t2n0kEbkE2XtEUISnxVe7NnLhL61SAgwUuK/qzUeWIo2QKzoeAXMG9p4bZi1975awCcceWyeW24zHKakxldnOOOrAUWiOUxHXhu6h6xLH8lczR29anNS+1nS2IvqlpLtBKqkEyuan+R2rUoKKz9q5KZilqzUumLFeMXIxZt5TU7SS3k5IZmzyJUkkp+3pXJreGVPWtUeLOgBTk2u/lklSIUraIIwMcGVJwwErTsaB6egtElsogGeHGA7W7OqGIJewhVJv3bWCea3SzD2xgUMg9Eaes7EOLedBgyiDF2QIDUr4srGtRQpLxXELVbLWsLITsKgiQjKnRuvc3RSku6FrBd9kbU2f5y9vJa3VmEy12GptlrtLsf5rDsPFSxCH5a/sipXAnYvO253LdztJu3ZzsPzEqaU2qleI19S7CpLK9W3nrKxhT2u0uEv/GxvLK5Q17k98zdwmr2OVq5S1MrOVNU5ukylHM8q16xLfszt3Hk1YoLv3q9Faw+vWv5L//vgQAAACLhj1O1rAA7SzGqdrWAB4BWVR7nuAAQWMqjrO9ADrJbcm+21skrIFuaHQKpwbRMEUREEQKJKAF7BorjLXlphECFwQ7Z3MOLDktXgylfqjraRwLBcW0w4e8iIsyN2qr7S5Zr2P/QNjijGZM4UWeGaleNP2rGXicGTQp44Ecpt38VuAImXOApozF82AMpX9JaZ1aRj9WMq9gp6or+DXWXtzhUbj/YnhDN/9WabnKm6LWFflWi3MyXlnn8zuY4WqX9YU1BPfnPVqtnf3MrGGF6aw7h+eX47zr4UuXeYcv7ztZZb+rjhWt/n/ccqbL/5fsCs4R/f////////////////////////////////////////////////////////////////////////////////////////rJbcm+21skrSGO9Q5qnCs8wBJLhMhWtaBeQeKzsteWAhEAFoOrZzqL5f+kdhlKarA5uGFutfXgxIiMq1ypHPPfHG5y2pCH5emlqSuXyGQRGJ77nVpXLicSpoq/TsrqvrGELErn8YFNRBp0FNYd5Lxptps0zIYYm2wTs1Bjyq3Qa7TmR/KP2IBo/1TX+cqY3qmFrdWTbmZLjZx1zeV7DtX8OU1BR7znsqt7HGtWsfq9Ncv2OZ5dq3d54Uuu85etbztZZZ/V5hln/e581TZa/V9RRMNABLBThmFwudr3m833/jo6DbbMA4DtwmqiwaBgagFiAAIRByGE0AcZHKQD+NUMLoEogAAMOIEwwGQRHfdsxUGTSLLIgQZSKUD9uHLz2GCggCgkRpNJ5RK5iuYuDQYG0i8BUIqcWJVqxXnMuqBrvXpGA4A0EGW3fvWKWdlkZnKOOq7Swj1e88bX1Y+wfXi1LJ5yeVww9lhg0CnDnsaaFRf9Dm8BKADDQbNXlwaUJMBqCrl3n6x9NiblUPP5OP/F7svVty7i/9jn653WOtfv/t15+N/hlhynuSGHKe3hczqXe1df3WX//733vP3SV9S/8aSx+/sb+7ugtyixOxyK/ciG1goi20WNlsuJxNttwSVRhyMDgtWGWEHkEMUwXTWISSDjsNkeahxshmIHRgGABjgLhhCJDfvGY8DGaotmYJACZHBA3791jLkO2QCgICQrSyRTFXDExMCgDB+kXQA0FV6UkSgnHKdl9tVcvmyWCkKaCYvw/jQ330cSKvxRtHFgHJgUUU3x43LVjywsRx+J52JWGApARZExlD84icg0MEgwLAsRgOvglAow4EM0VJgIQ0eBPC7nrm8LOlcNLgZ10eGgNbi8rgdBLhnVcuxhzXO6x/X7/Wde3L/1lrCnuQK7kbn9XM6lDlM6/9d3//++//52M9S/8aTD88LG/u7mLcovUVBO4ajl4m//vgQAAACUtnVddzYA7uLNqq7nAB3NmfT65rTZPGs+n1zXGz+aZdNxEqXB8XlbvGF7ouFnhiEGxTYZnOhx1kmOgyDgS+SeznrbHiGUzTWhGQCxXS9QDrCzPJu9DqtphBIEAUVX77M4F7NRPEkAk47UayrU0WjNJZxbA42Wq018P1aXbqz2cqaaPAVmj7RVH1RZldnGI5UbhQYmiQAJjv2DgdPVdruWIXZdqWS92y12Uup9/27zVilhVzHczv/yu3qbmNiSW8t4/zeWW8cZJBk/D+WtVsd4Z8jFiN8blflOE9LLM3Fq7qvA785ejUzRV6kS5NJHQ7vcusTlu7YhTsL2kOFivcpI3KqTMr/////////////////////////////////////////////////////////////////////////////////////////yzLpuElOe9LOZBfVWLzGAQEOKYz2PjPKGOtssyEHQMEXUQTM3SlHhbDNZnQyJigp02kM0HYLd2V2V2ommHBIAgc1lNWyxlkt+mrxEkAg0E6kDS6YlUDQzSS2lU6ZdTVLkS5D8RlN2Ha1ejdFUVNlyzNxlIGUy2Ox+mfp5i7krBAPMo3EzEB12uyxWMP3bf6QO+08BAqLQ9E8d/Jf+xLXmrUuMR3/1rs7Gr2NiCp+1jj+ONNa3jSwZKL8vy125jv/5Scr4PtapdUdJjXprr8x6N2LFare3haubRCnJndNevfj2jdhLqYt3N4YU9NUalZJRSSt0Tv7REwlYmYtBEYHRlfYwPHDMgaBgLNTDAZBKaipbnCQCYQHDVuiBtYDvoPlowDEkUK3zHOiLNyyQFvm2S1p70y9kPCIcHQo1yNUG2Iyl3nXb8mNTWbLFuuosKuqfl1MtL5myKEkSuWbs7LIIWLljzud5hKE22vY8ikrisUo79DRdq4U1eM2f3j/4446y3z/xxx/LKtS0uOOrXdZf8r/n/lRt9BFuzqimpNuSRGWUsolkMIGy6Kw/CZmfyluM615WKdpp+Wczt13wjCGMp3y9fnozb1TOg28VkuHb0owpcKHGZolFJK3Ru/t0WtE0JrQEJyCV4DA8aMyBwGA01QLB0BqkZzW4SATCBX2n5AF6B4QUbiowDEkUKzx5asA4PUlhdqD0bYtTV5BIhgkHRnSz1EOMNlLtO+25QGqCsyRbryMtR+daL1lVo1C4iIgcPAq5VzuTTVGE93Zr0MoJQCFhC4pEBzcENMyg8IAjT3lfuIS6ZsU1eM2f///eOOsv5/444/lWpqWzjjq13LLH5X/P1lRvNBHaW5OTUU+SR2WUsxGIYQNl0Ji8HTM/fncJYw5NaVPdPyzl+3JYhCS1N6Lfenp6bxynWFMfsQ9JvvUlTHC70u//vgQAAACeBn02tYq27YrPptbxVt3SWdUa3nTbvINGq1rGm21SAaJSlrAMqhCdFlLSNigNNJTQE9im6rYbUKh0bDOSeiLB0s+6zGaC4rfaV5u3917NUxGbu35c1sy0olBTkxuJknA20vd1b0GUsTWlAYhMHIg4ICE5DibGwKTE2k4HpDSQGqThTHGBgMDBjIgpdMiHE6JYF5poKoJl0fQ9BhIDGKcACEw+zpOrNf/////+YP5iVBzT5XGfFKGAuMzJgkyLFEqEDGWCzRBh/jnHimx4sk2iRMfaBPoDiLxfH83JoQCLBImxmLjURK5fLBNE6TKZNlCkQwzIcqb////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////9WiGiUpagDKoQlZpBh3woDFxFADC9ojpWGAJrEQBBsmkVESDRjv4ZEsBd2faV5u3+U9mCwVR43nLmtmWVBT0O7NwWQcDfTi6Fns8iq+13KViyg5EHBAVuM8RUiAx4pEuCEwgGbkqZqIuA8CCcidPu5cLAXuTUqxuQ0eRbgHgIDC66AGKQyqZgma//////8wfzEiAyp8+L8XAocaZMEmTRiVCHi5gseIMP7DnHibQKpTNydIumxXSHEXifH2cIsJ+I4eSuT4yZwtmpwrGBFidLSJNqTOEwZkOsfxEOtyf+kO4oAVbk4wIAPeWhSRWIYChDYbShgAXDbhKW1WmGGl4sb9IQvDW29N0p8ZnGpPwQYpsFpzAaZtKkCoLuw/SaJiaHSU3iJq7Eh2fO2qwSMYi/LgNq0sGCRUFTQSmi1lSbju0hRAC0wYHLapPJhN8/KarhhhLvNYVsY81p/VKTGwShA90tx3z//////////////9//////////186DtNyfjzNHmhDrJtw9uGtWHxgeTVakWa4605A+FJZkcVqR54ItCLU5DMtnq+5iV9fmDI/VhWVWIOLDtyNv7KnFhuFRatWj9Cm/bJmjs/9Qm6eK5mTl9LZUACAChIBKwTYykIULnaxKWoqHgqAVFjajgjkRmzwWxDdmZlFa/KAMulYkhck2okkSms+lEX9MXB5ysDci8TBkz1+soCwGipcxKExGnRCnsF4rvRrZTLVaZx2SwHhlpCRUXbs2duaP1+zcwmpa2BHpyUJJw15FgbeQxml5///////////////////P/v//P+brxzKm5I4KWYxZ1GXFUK5XXC3FHheeERGUQ8qRf0YafQSy897q0kBNIe5zIGljgw6/VLUXqlPOOK787G3uvzMMMldWs/7izS6X3bO71BGpuZs1Zs//vgQAAACklm0+tYy27X7Np9axlt3VWbQ61jTZuRsyj1rGW32aJkTs21QkqtL8pztUrigRVrSE1g/q9AcLRAZC7kGyhBpNizu4OuRqjVykceOPvPdqQ0iZdU1NIWOQWrlUjYodiQ6Z67DClHX5q7lDW4lNNZh2ffRqa6ERYPW9AMsfpeqjj9s+SggFr7+qxqcNWfWlr27EvsQWsmrA5/Fhx8CXcM+f/////////////////3Zbbtyu3XyqWbNBR2JdRyytBOr0qsROnjVLWqQVnKIvazgHDmcflXdUFScx5hTW6G5J86t6UW60AY3K9zOpS5XnpwqTUfpbm5LTmSf//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////tWQ4lbtqQ5U8YdVXYFAocDQqXwmEH0ZhC9bTj2ILhhG4rFZzuKpEQrXrYRziFt2Ib7D5aRkJZFmzflzVor4SRoktgQx1mKLAK3uAvNERJtoS1WsMpfhnCjDHmSLCv27zW4oz6VpQWUxWnLJTCWWhst1yEeM918M95wDSs/Ny1TWtjr//////////////////+bpc/r933WONy1y1fsamcsKaxH6eNcrVIKzjEv7dgHGxnH5V36CpLP5hKrdW5J98+CKPKWSGgr1M6lLzF6cLkcm5bc5QyunOwkBxqS7VvbIks8U3WJTkABaaqgjUnYAyRGgMFrdnE8X2LZmUtuKQYSm3jLIIHnOw5cCP80OG0y1D2LpzuavVsCdysF9lKCixVdu6+jPUj12qctZXYsO1RXr7KggyPsNZM2jlR5pFNDbaSRUL1M3Urdh6HdL+4TsgjsRnKkYh5NozdoFEoF1v9//////P/////9f+pRZp89zLTo1BckpYxk40bxympTAz+RfKNWJmdepxMrcklk3nfp43LZfH60zi7zzS+zLZ3Kkwmc4tfs0ucqkWVfGXWY3BuLwR1+Zy3HrVLSWZZKZXKMh09rZLjdluiLcVpeBH9MBnYoXR9BgYRrT7A3ERYBodw2JstjAXGAS0cUgxcwnaGeEhGbMakT9xuU1xQ4jOTKL5yJaDdH3SWfiKjoJc3FEKWMzS6d5NRAKjoBgnkfUvlAUFUSjK1lcK6fBrKhiZb2oTE13ZqRxGxV15ptmZkluK3n3on7WwaeQflK8t//////6w//////1/6scz32q/Uuj9BSyjKBqfHWVLLoxT2o1hVsx5+LVuYsV7tunldm3Q1qXGNQNfxs2dUnKuM9bs2cqae7v6azbm70ESWHb3aC1VvVb1WvU2R//vgQAAACZdm0e1rIA7Y7HotrOQB3kGZSbnNABPJMyk3O6ACrJJbTjkjSbisK76iRkVKoBnZe8yt8zqVCtWohBSte7Q2bN0L1Z/oYCUvzisOMvbXk/a7WboyuhY7G2/ZtAUHu7FojLX2moPleToSdw3egyRNCltJ2HYteryqbeXNlDlNDXpeh99HhZM3R5oTAlPjOPBcdyTJ7mTWmpB1nvdUeqlJXt4Ry7jY3N1pblq7Ks+dk7+5W5i1XhGGMjqVpirhuvOvplT5T+NWpHqm7tepPfb+Yr2K9uTztHSSuRYxuX1sbVurhGJqBs5dSzPe9pJm7PfjyNXa2dz+0mrlsp///////////////////////////////////////////////////////////////////////////////////////////////////////////////////1ogJtxyRpJNPlh+kZGurKYGXvMO8KntDLxlBTL0U0V1amQHKM7+VIp26ECSBPRmEHQ+6tHWd9wlitbZhPy9tmEPcoKuJujrvswWWw2u1oz7LidZsE+9kWpu0U/OyuSS+BZmVN8MGL3XmxFOuAHjXc4UjisrfqRNcpLMuio7KZyiakovZ/I+1JZXn9RyrSSuN261LrLcq3n9+U6o+ZZzlJjb+tcx1+dmUVt9v/dwrYYbz73PusLeHc6OzfqV6PGnt3MbVurhUrS7trG73v4Xbt/WPKbevuWMhjSWSSSm23JLJJJJbLbbcFEsGFQ6kUQF8MH5KUR4tEpDMbgUw8BkTDHpuDDQCZ6Bh3B7SttZlzSY6rjJGdbcqEBc6oFtqCUQWzJhaCrE36jjkrsZfDkYaZGZfH83TbyvTPupixHPkos1mzWdu/XduPw/BkERbjnNKcNucfZALBZ+tSw4wmlTxX9yFwiFtFCC1FWfmL00/unxsYw7EqyIkKgCjlmGclaWEB5fjqnq1MsKTLdXVbPCU0GPZ27JpfjHocq07+yOelF2WTUYjWdDukvZzlNWmae//K9NS3efSWrksmbdPhztyxcgqW/yXzlmkub3XbZJKSTTUbkckjckttthxjD6MIiqfZIKpgeA4gE0wZAgGCGDhGMIgCQEGR7JGYANGXN0ggH2hQbtstKnTXVB0w4sZHxwhEhJOFMJiEroYAlLpuvJYSuht5JD7WJHfks0ueMVq9OzHGphMUrR4fuXHHpW4uFC30eKahh6aSpDFplYBJlBS1yWUE8KD5fY7Q1IEJCE/qW261/u94cpZq4pZaudsYdgtkZlQsrs5SurlasUnfs4Vs8IrQXb0ms2ZfVv5Usrd2NxeCJXDkqhNf6G7SXs5ytWma9rmFeepd4dpLVykmbdPhzUawuSS7/JfYs0n63d//vgQAAACehn0+9vIAzsDMp97eQB2/mfR65jbZubs+k1zPGyzbJRkbdsZUqFrAWMKRcFKoeAbkvBxssYcARANnJGx9aMBg5m1RChPVXMMoc0JD8uo6R3WIbP1jG5ZqH52RxSgrpbg7+1ZuKVvot9/YtBcrkoQUSChxT+NWV44UNwywcvg3GVtNb96kOAcA9aIK7orPMDhb/vswSMOJNRuncSNv5AiaIJJHiHfj79u3P//MP+/E1VF6kMomGt+kr8zww3n+Nrv6+v+H6ncfz1nbww7hV+5FZ6aYI5ExK6WL5ZXJyO7mIdgTORR+MUd+rHonP00M14MjEYjOdt/Y3D1azWuS+O4/GXzhjKglX40+VjK7v////////////////////////////////////////////////////////////////////////////////////////////////////////NkkiNJyVFSoWq2sIS5dkhAlab1cMPkii94EFzYB040oLpQrFIhMlBVxaBRHGEvscBSFUW7Xsbl0Yv0kvlIjJB+9HZml30iw9Lap35S1SKKppWfGNX5l/5+OQuV5zbGgoAyAeJSQf1ejd2SO0igt5FVgUP09ePSivKKCfggKkpm2LGoxe/+YYUEsfcQBCwJU9E0ka45N4Z27e+/jay/va/4fqzjjXuW7eGF/CZxuO7biTBHcmJuMxemzmpDdo6RxYc7J4nGJ63VaMzeTy6GbsFRiWRmntvrK36uXq1ynjtLuYnZRlQSq/jXysF1Y0QCm03LW3dIGyt1L606LynF90FJRhAUSA4xPKjGYQRfdB20oYEgexSiUWs3GBn/Ot8p6l7kARK3W0O3DfT932dOK/kdh6JWmcr7Aih4KY7HFBWkR5GVdDCXSbhB7pI+0k6lsgPT6AoAvtBxShL2sjbCp23PTNLZv0LZQYOrPo78cr/vmrf5XYujwNBIq0nQGkG5Xcvyx+x/8///XO/9rX83rmXO7vf9L3ULq4X7k/38b+HdWq+7UUwpZvKZXHRy+XzdrdJfzsw7empXvtuFTuHxh+L1uV3tP7ZnJfDVH5etEoqxNyWN3NmUfdlG2uksRAWXigGDhMwAKAIVCBgWAGQQYqrBj7oDVQKTZTYFj1xtUVXO0GNb7K7lE/rKJVP72Qyg5qX3eoXQKzSHY1VfdeK1wUQPA5rL5UsxGWRNPa/qGIjKi+qVSXBMCFrvOYSAbMoHVgbzTImyZSuMbjkvguROIYEALO4pt9I9jvms/v15OFAANA0RmU4ITGYyqZtb5l97/5///8//y1/N65rnd8/7OWpHVwv3J//xz13Vqvu1OYVZvsQSzo7c/Xv7wtbxjPJVK96txadw+MzFjtPe1GbNi3DVrNY//vgQAAACh1m0Wtao2bYbNotZzRs3XmZQ6zrTZuhM2h1nWmzqSJKrckthEy9EUFLVL27CMwgLWFVUGhbTRCBQtOWxIsCJTyszLItAf1iRUBKhfxsIMCAl5A1NfbyrKGtrIc936kUHZosauRGPCQOOscgh+3BxbIusCjgGhgYLQEKkCI4OQImI4D0At5EaicwMeGGfBEMIIOITmTZWC5Y5gWWjKh/RAcOlHcKiTx+OaQMfQGQOAwGNA3LAxxKLZbePoeQkZAmNJZ7/////1vUvOJe9a1pJGyKjNoesQEejIkSSLyyGE0RFmKxE1EUHASZqXSYPk+RyA3SgTiJdIQqHTBn///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////9SRIUbjdrImVgRQU1SvaMX2QAs9IGC7DygIuqJrlDKMbZnTHg527ADtiwUibCCChFJdf6fgiZcJQ5Aqw/8v2QXvLWmY40/j2zFp/Y7D1CFyguoD1xnhKIjcng9gc8MaB+AWUidRB4GHBB64AwAeBGQ6jwYLAOBCFAaixZodCQIbpeIci6iyQ8iwIVQ2zq1FIuLZbdAV4kAiZAD6kQTU/////616l5QNvd9aSRsiozQPgiFEBHowIiSSlkMKROpsTxPpEAIISZ4ukUNyHkdGuTBOGZOjyTh0LajRKKscktaFzUSrMrCOCPCoUTJTa8iK9sKWCPZ7YrzjldhKHijkIdkAhDEAmIs8EYQ4hVtYGjtHOwEnKzx3Gfs3bcKNWTsRla91LnGhxsTkPw462C4YhEoEl1NfWEYm96NzQXZQ6sTkDWUWVZ443Fe000dDRjseRKbKl7qzK4flcOTt+dg0xJx/rkRw3Wz7cy1yb40qWDic8AF1KTlu/n///////////////////w46DPHVn5fhxvIEsaxwqQXDUafejt0kWqzObTaDCTSuHH3qX4k/tPXguAaj9yeFw/EqeEbmKub+Xd3LT6HiI2ygZFJLYRM1EsSLNIBFqmGCjo7qsQu6zFoC6zSth+g3ULeOFJoKUDHkD8uwwIDRbN+lgWdWygnEBBXLxr/ecLQ5lhrS1AlMmtRBpS0JNE1Ok7wSBTUUMeJULD2hJGEQF60ObJ552UgUJYKFOyt9FdKRMZyXsgebEIejh6POW15yG1eZYN9jDjiIcnlANirNb/WWuV+NKkhVHgcTTY3P/f//////////////////7wqVMf/Ucyww/HDCphald/PC1jdeuB5RyQS+HH3uX4Kf2nqwG6NA78jfOH4lPwjcolN1/KfWFqGPi6//vgQAAACehmUOsYy2TabNoaZxlsnZ2fO6xjTZOvM+epnGWzaJJLjcktjGsCs2CHPLBCi40K0gQFzP+nG0Q06ZNLbSHdlsrtNEXgg/EMk/5FGoxfzl0fQua5EGFVoEHDo/OVHpxAnHmuwHebExaGnBfdhLSWwssgtRdnMFLMT5aNCpXKV+pmSpMZL5ZKbhfpbLMXBpmTMCnW+suK7sONQR9UdAwEuuRqdrTN2U55XbNllUQHKz+R5La0qppd3/////////////////+gUujjDom3R5tsusuA4M43ZgEF22oyOC4aXXOPZfwZ/T4Rvvz96iwqxiYs0GrlJlP3a9LMWKtabkmX/csp///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////qVv5JLELYFXUGFOaxpMsoEiQjNQzhocIYkKdL+b2aoFEJXayS0Sb1KVUQkbrTtm3FomxQgBGJ6ebQlu+fHOfJIKHmuyh2n0ac8S767ws01nMrlYbEGCqWuBInyUrZg8CsD7oNQ6/5a5WVL1UCabEmXP82KMxiisy1siBoMCg+blV6tV3V7reOLxR4cbG8Zdjl+8v//////////////////2y53JylkX/A79xyrySP9dh92KOV0z/2KLLFusj1G+/Pzkg1VjExO0H3KT7e85TMTlWtNzXe/cpdrSkQAXEnJY27ZYmSp+DGsF/Uz+komROmlisMgYGbY/ighCgH3mGlMCQHXYLgQflZfWSS2BHkSxY0xtWKGHCIGoB16P1JHCUJtO49jAU+0gXVJTCRckBq8bm8rD11uYX3nVyvnDMocx3msJHJDK5cFB2LWEQn7gZ3G5wigzzfunZGFCKlsqlcolkT3jHal2ar/k/grRZ+zaM6mcd////////////75h+8rtu92PP1FuzLgQ5G4hSWo3cjO8JHadmEv62Ogjz+OhEoCvNepPjLpR/6SmlTtw7hnNyKXQJQyqZd6Xyl64fx+nj0TmpZmq5V6pLa0rZYmink8Smis5EA/Y4yHpOUlayo0TBZ1GqgaYTE/KYUWH5SHFrBfyTR6IRVOhmaSYVMBAutAMCJG1oAhKHRbyh73LxQuZMyZ8EBppArpd8KViYCXPVeEEo7rLWtDyCdOCLpFLVMMVurrlmXyFiHqLlIrSmJvHB1HDb+Uk2+xhkvTFZnWFPe5dw3rPUFS0kdD4ab87Nr////////////////LefO5WcIBhlpkslcMRiek9aWztNCnxj8Jhl65iIP4+kqtddKj5FIPjcgsZSp/5bUlf4T0Mu3TVLcvpYm/dnlPHpXcsbx//vgQAAACepnztM4y2TYDPoNYxlsnkGbM6zjLauiM2h1jGW3/Ab5uSJORgi0AEagOgVWwoL0otDMAJVMEJNFbo+/jxqZv5I3Wa+W7k+cSJ+cjudVw26evhk8vlK8WEubbylI87i5rLN2MtwdV/4yw2LxSVQFSyNdllkM24LvQVdf5+0xmqNBdBh0HWG7PpHbErzk0UpYtnKxEIrX23Wnq+djDPlnW84OGJRo61z9f//////+8Ofveef/Wvf9L9nPtnV/PedPflVHbuVLOdJydmK0kwxr2atuPyzWvsVbdaV2qK3q/SXaeX1LFWrlFe4xTf2KHu7Pq//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////bQBMbclsbdr+M8Qkq6uINqIbaKk0ys7gV2kSlxSKauUhTKrdGvgaX8SgpS9s0MTcrk8fbVPyHmZwxGYLCB0MUm0Yn503NnK5YW/zQ2DQQrqWxmls3Fhl4tZa89r6SBmbuPuv9RxYsilr+NflUqbd/4bq00iyzsQABA08rE/lhbs2MM+UutQVLRAaE4Y9+5//////////////W5/4/j3styo+7ty+/HoXfqTFL2xydmK0kws18aXPGWT05+pZK56V2pNnq3Es3/l+NFjZfqHevPDm+3qG3nRalgJDzU20IdynCqyVkGqwNMLpRQRggcOuhi2ExXSsaSQa9YhFATMHkHSi1uXmjiypZSUjLWAonF4n4aym9DC7kb0LYysI7Rb94WBIoJBqlkzXGZqoruXAvOB3cbgpSrVBqYb2JKTyCFeCwwqCqZuUNp+proar7T5VtrVqHCpPS67uqSnEQ9/v3e50v5U9TfK7ykNYCUk3d3ubw///+/q7JZRG5RudlVifvVt/QztLBWUX1A8oxxoH1eCG8eUMVcRxpl5YRDsNxJrUopIrLJVx9HtnX1hiHYnOOxFKCIwi5K4jnNbjsswdiZhb60Nqs5tV1ASQkkyNyStAuPYsMlYse8h3SZvKzvE3EGDdEsunS6Ft2EmH3wkCqw06W0scQSw7lbfyINIWUhMbV6mQSh9EHl1w2uVQVfTXWSKfdGgmGextx2fxVpresmlJeBKZOBDqk4sAm6+0OtQll56WttYU6a6sMx5jlyaylsIkFPONUMFBFKUZbm7+8f1nhvCJXZQN4wdf5vn////////////75l/3ccZr6bK3AHw5dg1uzr43rstcR3pl5YQ/MNxJwpRKIdootEWIQJRMpisVn7DsRSYhmBZyV0blvE6zY6SUwVQx2CaG1aeW66hKg//vgQAAACk9nzmtPw2rhrPm9YxltHBmbP6xjLbONs+e1jOWz9tJV9t21il6/Z1OplsPgCYlW5Cio0ugRDs1ImAoKkMZ12LWX85FES0egrVeaALuFBe3MA6wjaihqczDOaylQkfB7nkm1VCQseRK2IP8vMFOw3WVtkycFMphENR9+V2zGaYTts2RPdJoDOHket9FbWXw3DDJ5bPQewDNVUiMgCgiP4RW5zX/jc/d9wQRk+7hO5699TP//X7/t2Oxmkm8IzG70tp7v/Vs7x1NalFflBfmIamae3L70Z7Kr1TKzhem68p5GI/ADyTczKqakh+GJuJ0Euf6OSh29Q1KrcXeuOvnSVMsKlyre8h//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////oAWG5f/7CblmxRazw1iQKeM0SrHgtdVuZeBPj23ItvAtzWoZlA9KZzXQqhAth94w8TO2Is4f1LtTNSouATsjLEGaNtQM2akx5/oIuRhWN930f1skudWA2nS2pI27sUi7d15wGztecLVWftNGUS9W1YFwZSumMJcMAbOz53ASWwWNwBhK6Pmv/HWqsPP8QHGhOuKz3n/////////////+e//fP39Sk+J/I/jFqhzl8P3n97Kr1S1O0liP3YzSRqXVJNK5LHJq9DdPDc3NS6HspJIt5vFPw3Dd63KLFvVS5VseqQskqNuSJApscji924+QsE/RB6x4UTNbI0QeRjy3iGIfWAYwKGfVjtO3RaK37csVnXlKFBI22zOFSvsxdgKGbSxIUYV6paoCXhViKo10hnm9f8uzKmBPbPy9HmHnLYUz6GHVl6wDwsckinmYvJF2Gx+TNRSua+zWkmZbOY0ZEi1CRVo7Ep3X//63cflpMBm1Iq2ewx/LL/7///45f//ulxrVO///utlZmLW4IiMrj8xWj9LLbkuj8ShmxcpH13Vr386k9lMU12khifxuSucvVJPqNz8lp9dxqTMnzpvwmZDIXAAi23LLG3a9j0J1vzkp2nholDKxQAMQuQxOG5MjiSqyTM1AUCq3ITIRfa8WZfOVvdGH8a6/zjt2HoDEAYwXKA6K2m3b2syGAIPhtrT0r6m3jlKOjW1+O8qdTSGIKZOwVL6rHIs2j7tKXfLXld5ReWv0yxeUCOpDyBUtpnVuwHLAgSLTD42r+uf//rGHIs25gaMWs5V//////////////Vzv///rtyN193npg+G7covxmlmYG5QP7ORjtn8nhn5PXnsodoK8BR2+8sJpv+WZvFLHyh2tqw3kIwoaStLMpG7PyblA//vgQAAACg9n0GsYy2ThbPodYxht3AWZN6w/LZuys+a1nGm1kJILjdtsjdrUL7IXKwJQJ5264sagR9ZQKqU+0Okxbu2C+6BYc78om30fxPKhmnvXizxmy3oiCQL4ictVracmg26uF91mgpy00RZ+3McSqKBpe6b3LjjrMqrZHEbWAFsPa1uMNKYwpJpTz224wG6qjs1J5RYdyGM5KQEAgNPHcD2oF3vn/+sPhc+IBCXuQ81l//////////////e///95/luBtynC1uOz1J2pWsyWdl2pTUms6a3lHb03YsV8Z+3WqXfxt2pdKaW7T2uZ00tsXr+Hc43P52/R/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////yokmWSSRoJRzIfTRdLSwKWGioUmG2IKje9CqKL3jGKQLcWyyzIui6kooTK6BnVawrppb0o3qOLkQ8ibbQt8m4uOxtsDKGkrDKegCHVglaYKVTb91JUz57ZC9EAQ1elL+vE62LXX9bynh9hMdsJQKNOC88LlU2p3NOS6DoBkw0Mar1qW3vn/+sMo9eZyQNgfuNb///////7///4f+5Dr9/9WvrU/b7Z3Y+9rC9UoN6xnrleI1892JiclrNYEbWUw1EXfnLcRbs7jP89xeKw26rMr7A4fmZ+DWuzFezLrz5v3udskAuJSSxpSLhm2mMGwEJAg1PQKFwQGfW+I2MoGerDjEaHqOUJ4CSNZ2gFAAkMSNXn7YIWELHIWM8wHFEC3Fxag40CRYBaJIM9BEtLoK+wEsByTU0qnRQlIPPopasI/oNAYeyhYBrC61ZUDUJiRCtSBIOKSZjTd1nO7ZSCrv601nixFKjRML8wNA92Mb3z94dqYxWLofGP5F73//////////////57////v/ubufYsfnV7TclcvnKW92UW6CtSd5hLpTbpavMqK1Xj83y7UzpO1p3Vidi1uKWqSQzWFeN0zFuBAe22/rKvU4Z6uCCFxpipM2xgkW+ni/jBxiNp8w+c2hbSwuBU5J5AA4ScjJCYjwSeji8aSQVAmPJYQ66uF/vOFyrPa6iqHLfMSKjow0uGqBCpHZ8kAy5nObir1nCfLmQ1CZiq9rbshYevWTT6gTiAkGzZM1OpT6ymmNhWEcZPmYTtAAsvy601VqUP8/eH1MYNjUQA4xAnb/H/////////////u4////LX1YJpMbOss7/MqKNw/LJjD5RK6CzWtYPFDz4N7BH3lixuAHDb6DWUrlwp2kxOhl0Vpb8eooecCPyl2mfNNcN/KZ3vm//vgQAAACfdm0OsYw27WzPm9YxltHQ2dNexjDaPGs+a1nOW1khJLkkkjRSbUI4o5FGtJDqT+DGPT4cRxxUcbe7GZjcch9sqb49yA3ecpC9/XmbrFWp2VsNWg9Tzdn9XUmbJ4OpGDsobuutlFLA7+PKqSHqOtH4k3dzrMVa65zcH/a2qEs7URXdlOVrj7q+d2KukryaghdKlD4uTP8mF6MUdqvvGr2992d3VwkUBjpAbtmtrnf//7//r/u3vucuUl67N0ff/+0E938ZZyasXa9rtXmqlPlexobEtq1Na1au2MKez+Vixjhb7ScmuWqso+1Q5VaHVS7jfwsWDy3////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////2xpF6y2+MqZjkALsqRIREYrfbqNOftE5kRs8v6J0kRXDHnCizMlaXVx6IIvJMcfiFNo7DPm5LAstXS2d5U4JtWR1WEOjZsupD7C4pC8r7+MtlskkDW26w41xzMpmVyvF0IAgll80qg4i7VHmIs4gdxl2KMw4905mW5TPfLs3T1Na+7e3jMNgtuECzoet5f/////////////3b////cv/nXkF7WXa9/e7N3UnqWNzeUtoLlNe3NvVf7XpJdTUtLEakupZ63TVp+fsU9TOcxl8/Um86+FndviuoiInCpr/mpcpxktttV5JiIAtkgCIzgF4n0MnSdUu7JVNXFRMXKQnHmrGfenLi14ZjitqDyYaJqmxbpPpcMmf5aTHXVvoopprHSUXRFkV0h1Bqd12Ds8h1YRkkkfhMZWJThhzPYFUimsXpfl012OWn4oKoRtYOWwMoKwRSp+W3fZvWLjLEooTO3JXLrc5zHH72MEyIckIpIRzW//8O///v/od9j/5Si9MZ95+//WWvrwzzOM6moxqasWOVKKlmr/LUvllPQy2pjKJqWSzGVZWIB+H8vkVNRzOMtiu/ltPKZuU8pNYYblyb22S/v//YRspxGmC3JUQHBxkMpkrWbqiiGAGzAGQMn1JUp7bXWdrzRKl7KURQFETHOSvlvFbR4ORKBr+b9FV5n1UFXipYociCy0vWkFCS24+GghQ9W42rMmexmGk0W9aUWaTOT4QPXWtN0WgLNaa+yl7WE3wIIj+o84zqtfKwJlTdSMRa3RKHEIC7F03nNjDdvkPOf/JLBdZIQ7q521Idf/5/////////////////8y0qxL+wG5kJkV2YfHNzn+eGCX8lMxDe4biM8y1UsojvZZLM4CeCWO31+6G9JKCFWJdFJTPUD+xCzE4xuM/hyTUWxA//vgQAAACkFnTnsYy2jWrNnPZxhtXMGfOaxjLbusMyZ0/Om3WFMQFHVtt9HLmzXVh3bZ4peqGolMxebQkuQVVFE6XJ8WtuI7rRU6Wl260AhcjJoZg2dWK1yWv27TvO/JGiLOpICnXdtwh4XtxehR1UNZrMeTdTMVcgBcJ+2usciTmxuCINa1bh9vmvK+el43/TFUAXayqGqFp6BTMXOfR40NXadbU9TXMZ3XP1T4RyNCFAPDQ2fvn/+u/////vv8/eH1v//////zpedwl2qb72N7OpblOF2x9PW5Nz9PKs7krsY3a967Tc5aux7tellWsKardoqPDDOnsWLer3///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////6wREAmyrtvonc5vGXwrSdxQJO5LPp0eWBkMIsrGrsQROoqWiYCLHhrB9gAyQU1SJxp0GDKzprNjqMtZQ3qyVMn5dlvdKcOvRNMXirUoe9cagGB2CTWSY16UQOzaWs/ZSj67LG2al/XVgBEZ3rbDpmdeJkzuPuzZ9lcIKg1yXsYq0Wsq+Osf+3yIUbvHdDjWK3P/WX67/////8/////////eFvs9zHk9Wrazt5X5TnKbN2XTti/FqWa+W5XruEusz9Hubllq9Uv9iVNW5hjGct2d37GFuwpuVEAyOSWxEplAJtNhp2ZUqPIxT8W/LRhCTLS0cnJtqyhv20h9pA6hHqXS++ZlORbizoylugWQrBQw5P2y5xQ+VuI5CQEUkM+mC2rvLiJhGQhcB2qjJIKQB31dIhIigppQNdCtgYmlIg0mSiAg4RAIlUrKyEBMFwIhGG5SZ+n6aS/LRQ6NPpq8Qt3ePhYr87umuqdq3CJw0JUaZr+f9ejx/n//87//vX7/+YfzX/9DOY/+OvuzcoppbWrTdLqUZW71NWq3ZiT26fKfoZXu9RS+5ambOs71abtzNBM2J+gwpK1FZpPotpnUiA43JI0CUFhCQ88VOCNAOqSuCDM8DtDAsgi1oNPIBkzaRnwsUX8AJTUaBe5h/yeG5vNVUCCCEhyg5Z6EiXxEDAeVKmOs7lKwrzI9OWEIuUPHFl2ukgJIZTCUw2kG6rEYFT0b9pKz12zRdERiAAIVsLLsCBIYs6qq3AAB0imvRubp2huHYegkCq2Aq1VgFn0qiWF7f5Z67KHJKgMx0NAY/GNjn97+Os/1W/uWvw7j+sd/3m/19BTd/mXd6p6GX5YyqnvXMsorRZWeUWrV/C5llL6SVyq1Hbd+rjln2rRTtmltW5djy5SWLIxk//vgQAAACvdnzmsY027UTKm9Zzlt2+GfNaznTbN2M2e1jGm3lSADjdkkZKZWCaCgFWZIMhzZgsCJhytD+qggc6kj8TDDOlGZeIQERJfKJsvMlBqo4KNbIgqsIQhVEX4gCDUU2xufDrgq1NOj1HHcplxypBYrwQNalcvZk02sm+w6jLypGMoJgs0iwhJEYRBhZSkwaHUsCwduShjlL+VO05TynSq5ZVxFiyltn85M3KtXnN6zdCRpfHZOK9r0f63Vy/////Xf//5///efv+4/Vou7x3n27S2a+O+03MrMns5Z1aOmhqcysUtHc3TSivctXsOWrsZt5YXcsKluzXv3spm5uc7l///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+62QVZJJGQSlaeo6Oy9ZCMNBYLzHu7ZdWiFPg4alzhouk6jgqQC7A8QsBGVMCFJtqVpzLWcshQEqgZewd3qIciBTTlPE3F6GvQq2+UNXKZ/AIgyF/4fWHv13vZ88CwrT29UbSueJniKKmcKayslWFCSjSoGOB0l68/cBwZOyaXzil4tNLOU//qlxx/f7pHZJFz4QFgXl3//vLv/z+//9/uX48/W+5c3/91l+9b/msbNjuv/uH2sssqf7eHJ3tq/ud7vCzn3WF7HuWNrly1l/cMrGQLJW62SXZJJGiSlELkOl/JMQpjS8oKsgqA3EEloHGOopBks7TExLRX3ZmKlgA9EZ8LAABFoZbJmKOYrIvGB5UtCWPsSpHQM0ZnL1PzJYHjU1xt5Yl2nOslYR6keFzKsU+mMHBBIKpwr5kQqEZ8m6gUtYoLvxIFlKDribKmE6T0QXRWbD+v+3aaIjhQEh+TRv6lPSfzmXMnhaaXbF0q52tTuX9x3+t/rWtd/uff/v77/f//3hjvPuufj3mO62fNf/1rFj7n6rWK+dqtezrS7tLf+tbwx7lV3c7zG9vHDeOWr21zRkmaS22NJNQmUoiLunQoQFvoGMjQqcmlD4hYrQuuQR4Lhao3VIQLjQ6ttOUYtl7a8+wh5nCbgmQXyZe0FqhDYLiU1jqGL2Om5EMtSh+BElGnLsaRPymQS14IgsErxKwqg3IctMhTJKyGkli+EOLAILK0Rct8oOuZ9GcxZkEbmXtnCUqgyChCaur3a+FjeeGHZhTJtDAqztEF6yie1zf/+u5c/v653mt953v81/Nf/M/x7z/7hvLCr3ufdX8OWK3LFal73CxvV3P7lL3lP3c12tvPWNuthlcs1atfptI//vgQAAACjxmTWsZw27iDNnNYzpt3CmbNaznTbuUs2b1jGm3cbADjckjRJSbFCXXTAfpLVGKOJlLpohAjRVCxR5LtRRCH3HhhAK3Rj2cYBxV2/ZXM19TN0kB9q9L6YhuB0LWHOWEcKKRNfcsdVgKwMkEJsVfd61gHGZ0u+CGPMPRDUofxECHSz7HrasaZMLAAUm0bwxjWH5mWJuTYj1JG4k9RK1DvJ38jErl1DPZ6/mWMHs3ChBC8oVN83r/w/9fr//H99y/vM+f///43eVu/c5y9jX5q7j2t21jIs6am13va3bWs79rLdT9WuU8okfO3q1vmWNS/nnrtumw////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+VEkyySSNoppYQEl6yS2ooNGrsZIpbAWIMC41aEkp2PG6Un24rTQISLhQqQpvpRQxhGrDvq3M2WYvmAquQgCMEVpTTYq2Jk03Yk08415+VHKd643Pu5SwS9TXmaLRWVAiqq4WnKBMTlLtKUQbJoGV3BCE15VqsRdxg7XWXqCuoCiBig6dEw6kojOb8W9Vf7UcZnBmJZFch2U8zqf+ef//////8/X//6/L//88aG5N1cu28qn61KsqtirTR/cctV79BUs0c/jVnqWrMU/8pqlDOW8JdKqS9GrduST3e8zl/aRAWdrRMrckjRJSiEFu/TLCGKCA1IQ55MlSmK200CAEQK1bLiAkKC05YCHBlzW6N0AEbcrSl4GVrAr5iaZzTo9shUOsdyHgY/I0+X7gJ/HgpFN3qWisImpG6VlMukipkiWuJ7N8zppaxUgX+SedYqA2Rw+wR/FKEEDoS1lLY35lCmL/uSiaYkQmq+zGbc1Z3KreGeNarGVdmQgDi5L6V91rXceYd3zeHda3h39fhlj/8//u38u42bNPW7dzr/SdqW7OOGOuY8+7Wwz1vKhypuapNzVjDLmsa1qkv2KtfL9Y95PKjZWyTNJJI2imVitXp9lhUIggdlF2Hq4tZuIga0CEU6swyJYdf4OADSF0mhwLCDrpPCq60arPUiY3aKWY50sAH5Q+/S13DljOV/wC+zatyljxsqn4vG6WB7kxKYq/bNXdkCKjE2ywE1pbT5NcXQmDKX6XMmG8jA2uF+i9EJUNDhiUIiAvys2AXdl02/V/Kvq2+lyDjLwQU6FmkqlH9z/Df/3//Xf/ev5////z//G1jzOczjc7YmqSnoMrVSkt6r09urLrM1LKfKbrWbW9xS3MSee3HqfcZjcNY0ULtyuxVv3N45WaohO//vgQAAACsZmzWsYy27cDOmtYzltnB2fLezjLaNoNGXxnGm2liRLskkjRJRMyUoKOu/JIIPjslG+0PijLhpOxynxgoMKuR2kQBXwfBS6GIqXCW7EqCXV2GIvsUmqWXPSyJBM6MBJGuu+sXg15XsiKlKwMEqud6QuSpUn03N3abkh1lftSpwZRHYJeVkroo5qboWreb5p0/QKZt4x+IsSJTgwaKTmdnv0Wvo+wXVljczJEE3loxL+8y/v5Y/3f/z957/nN//Nf3X7/ev/6X8LUzhnT/NdufnWnf127eq4cwrZZ457v4zNDvdWZ1VuX8sOZ6/LveY1MM/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////91slStySNolKMe50caSFVhxXcKp1j0pyKs5CQ/6MDvtxKDVMpTPkII1JnadoDEtRlVH+n0YyrA9cOwNBKHMNGbR/F8yd522hmDKk0oIsZ61vMPZLD76wPrGMvxCoZcJ52sPcz1O9M1yEOK/48pYj2zNYJhKQSVyd6ExX0EFnRUwcUBILxyWHu49kGXZFltjSwNkBeHfeLqu/O1sdXMb3563z8c/5rv//P7j+Gu/z/7vm6t/K1fuZ0337+u81hVy7lrLesrH6sa3byu6rY6rVLdS9Wr54Z/lnYvcoOoWGMzFJZv/tq5UYZIog09UoBBIhYPHGYVLi3rLTK3UtdyXvQKIR/hxYQC2Q6yK7Ggu+Q1McPgFFl8FYo5Mvo1Q1hVdpVV64AfmlfR0I077O0nHpzjeEPVNxOH6K1RWYAk9+HGHSVzqiAhOx+UvUJ0DJFI6gAFOciNa+uh3y8oUBUYhENvfP3q9vO7jLpmgXytoG7IciAB97cQ5Uzu/vfP1//n9PlvWV7PX93vP8uY8pJykn88LG5TnKsLmu9xldaxVwxnNXN37drd6b7nju3VxwlfbHbEuvVsMv5V7RztevXU44AVEv+gYoFqPrONFC2pkAKblgEmXegs8wwcwd+i3wig0vJhxCkSDIM6QCht6v6rwplDk13YiM0qnATk23Bfqsv9vm0hqVSZnDBHnf2clNWlrUOEqjsTdNpzZnCVhZjWVDDC/X6Yc/9dT8MuLOJWoEXML0KFAkEioTG1AoJh2USy73PesfrSnAKwjYFUsYxnMf/f/Xf/X/3+1MdZ438P/f/h/1rtikpLEot1rPJVbprGNqv9bC9yis7ym6C5jU1a58xZvz+GVSS2OWsrcrkGu1+X52xGbOdj6mI//vgQAAACmlmyus5y2rnzPm9Yxpt22mXJ6zjLat+M2V9jGW1vkmL+2210bhMDaLltVjopKRAQ8M0g7txhkBYYyNF7UvaBXMrpmqLYAIkKjDgEGTWMJfh8Yn4w1K5bpniCoVNNUmM040zaghp7uUzfM6hUUn4cgdyW5QQ4cehdJQwfDLJ2UPJEIFjUBqMxNHMAivCgkRTWYXil0Ya85CfAC+jL6wh1nn5auffncNYteMB44fQg90J+tlJMe/+tc/XKn3L97VBlX33n1r+OXcLs5ViGsN2v/8easbvb3VxsTOGH0lfKrdvYWM8svxw+1X3f+/Zq0lmUS3L+8x7ZIhf////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////yyEq2SSRtJMmDXrNJiaFiETisJJnPWQvZSAWNkFjyZuCMEPx2Uha7VoPup6AwTz3cLsNthZCgReeA5t63ADiwSzd+Z2+7EEP1SMGa/MqwPNSPY+sadaRwXUpmYyFokudh2WPr+mGFxOOS51WFO2w2OtNZEwN/HcWY97AGCgYw/UFSqDIv9bXMZ+pK15AEYIaRs27cF+01BlHss8M/1cx5hSWas5I6s3jSVMLfaGdt/hW3LJRHJLvCU2McauGF6h5TxWgw+kqduY4VqeL29y/OU3+zU5FaOpfpabOzypWxtUuVfCvepKv5ztGK6S221pNAlHVH1F6YRAoWVSwORloqhQFg57kKsijqWg5kNu+05aY9TOwy4VOoTlcoa7lOBDD1RarH7E1LI7UbZ/HXnpRWrwe+VE31mBX7vXMKGLNq/kvgSAkwr67pluLIVglZGuM6S/WYxJmqR7AFpo9Qy7LGSqCXNAgebfulfou2ZmnytzEyvFcQFiDmQcVOWsb/2eYa5r8P7bz/LuOWeVWt/y+5c3nu/9vOPVsJ3etfnu7Vr7rV7uVLhnfqYVMa2Fic7b3ljel05T6udu7va/O7W1S51k+i6w0CIxDv9ttG4ljdZy6NAQ+BQVh2sCQnTO1G3JU3UHJ0dQkK4WDABSRwBBsEI7EQA5lPKZc8LMELVb4frym69C94XDkJgOKr8l0VkUPvHWJQRq08EDswbeIQqi7fllNAs/DsrYSumyypWJoaAckLLnF4FC2RxpfgXHiyZjMlKyQcsw+zjNafam1jM1q+N2vGVdAIY1bEa5b27+vwy/Hfc9fnvHHm6v49y5lhZw1nd1hljlZwym6+6en3jXvZ/vOZrc5ZzsU1LM3+2McLvccMOWK/bVavvm6fWFi5QZ51mCI//vgQAAAC0tnyes4y2rVLLk9YzhtWrmbJaxnDatvM+R1nOG1mjLD21tsrSZQBpZqB+BUDKCX9UbHwoJIBHbBl7TMLErSgmYS9aOpFSJ0TiGTSZlSnjVd+ofhb/y6YoY0pfNTL+T8WvPRQROlhqPvQ82dqxT/Py92N3qCQQjNyG3X81mo7LusokcsqDQMudVGWEpsMBRdYgFEWGgIleEaypd2q8e7LPqcZ4ysLlAf6TSGtumllS5fz1/f5zHOvlrX8s1M6+8t/h+OF/Otjcwv2e4WbOF7lLn3L9apMqtfHu95b/DDHkzVt17FvHmqCx2vjcu/XqZV7Vrxf/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////fKwb7brZWkyhEAOCWbsjBjEKOl9ld3C3/DD9IKDq7pAYp/oAbsI3hMFvItWDAysbXI/HpbDU6/FIv5yWlJyP+9DX7MuhdLKZfA2UatslmbENU9PKeWq+HJVVpIZoow8l16Yy8bY38jqAFYzoIpOgPEnEp3gozCxIR5Ze60mmpy3Nan8btyUsxIHj80SHPyr95lnl+sO//3e5aywzv1KOXX8JvLvb1FW1bpcssNd3zHHnK9fO/TXrt2tUuXsu51qHlyz29rDeG9X8cPvZ0uP2u7xv8raxf1BW21skiKaWNYvMptPo6hyZt/RITSwbdHIswkSlDI0lUuaskgkcCIhXCjqVYpyumjf6JNvA0QijAJFKMXjVxbmnq7MxHnLsslD4tijWPb16dh2kkty/EpJaftl652Kspct7mRNyfZ0lJonNLUqkKibasoa91n8qVeyV6b/0NqrvurVTKncgdK48plGOdqi/f93/7/G5qr3v6+7u/rDtJlrtS1Z7a+pym7+Pa1TVibvZWd9s2sdVd25u3duWs5fnTWbHLNyzyXdtTed+W1atS5EJ2xmUYdqJV20sjiJSbF/JwFplugy2UOGNFqLCwrBzMxDq0mZW+AGASFmWwp5oTXvf9yzi3QAyajvyx0nnd+jYdFnGFAg5CLyln8pllBF3TiM0/FVKWUXJfBkFs7lkAuQ+MBz77y+aic1Zl8w8sdi6omEOQw1L2VNcTBXU1qaaorYvdXLT4Ei8ImqWrnvtrlaSuyOBAy0gHe5nfvYZZ48y/X/KK+OrtL2mw7+H51eW6vNYfcuS7Pl3P8rFz7NrLdnP7nLO/5T561f5b/PmFShv6pc53LK/3WVFnlzf4T9/EJ//vgQAAADHhlRuM5e2DQbMk9YzhtWdmdG4w97YMHs2R1jD21TjQDbn9/UTC5vfEF5FnYaniUWXLZMCJIMIChb9U1CzSmr++6WD0bdU3aCId/Wuww/0LbNEKWfifwUoLJ5VSwqYopXQz/NV4dms11+XHMaLArGKBeMxSwQvV4+zOJ+qyVrjCGw2p/h8/MokJIixNsGNmO+pdrixI1WEogvAAELYjaTT23Wfer3zredyeHI1djtGVmoTHFg4hWu/tWPrMe1t1vjO/PbTVjU1av9QYG7yZi2p4Ue0uawJ4MWkbbdCnxIEA6MP6hbdY04Vj63ov1Hk+FU9CP////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////m8gN29tsjSaWFnF3GRhDBKEqTfQ3jgOM1AgoTOlVvBFG9SRYUCSwj0OOKcZjLHDciigC1A0Ft9MzsAKzNbgiUtJn4pSTH0/ZiVODCsIJe2KTcpcaFu3Wgt0n+dyUN1faxKqsnhTAc5FDz3NrKZHRPm7zTWDpWuxGn7pZblPc+O8vVrtSCAQoFigG5ju/hf1l+VTC5Y7dx5Sbzyzt7x1ax1vXd4a/PXbtvtBcwww3hnhj2kl2GqmeW6mGHLX8/HeWX0Na3e53WssMauGec198TWnGCW5Pv+pFjkOwA4YXCPMh9F2G2An9q3k6Ro6asrx45UB+kjCMrapCkCQBFNemc9J4yPnQ+I3tT5d0jW7tylibkhPXULtqhYl4ty6ohRvqeU6YKdLe1q9ZRkjgpqIthiGqzqBKk2wphqlIg4doTzSutXF38LeggAgZbdUbtNkH1vRktI+x8zUzBzWDEzBnguWIcLDyZ+xarisJwjVg31q2qvIUfV95i7xSC+r95viS1oc+dxMXeS2lvAvu+6QtGHsnqLF4rlkpZp/nWNUn9MtqJs2kkbJKIi5SunbiF0FnekoSkb7hTbkkJoejWUlvV+WFdD0ZqHVkCWSgt2lkcozgSG37ldmhZhZis5IK9LB1NJYg+kdjcMHlcup/HI6erDkuVC9TK8hDmSlRNEdsVB+XaTqLyp21VvXTM1m8T0eEzPiNBi5m3T524bhQg53KH877l8QIUHwd5tVyzmuc1xiMxb3bzR40PWN3e63TG4Gp4m300G8HNMRIdLXzvN6R8Y9758TeZ4O7yxpdY1mDLUeM//vgQAAADFhnRmM4e2DBLNkMYw9tGmmfFSy97YtCM2Lll72wSjJTbdX1UUCVKGXtsIlU57ZIORNswIhKIYcDX4O6yFmjkuhJc2vQNOQ+HEeCGXaj2eMstT8qznZe8sVlGpVhYlNbDdND8Ft6tOdganq8znBGUR/mKfDiYKhGgej8uLAnh1XNFyhMi1BfxzrRz5jOh/PZ5qRXQIkDzaYZxhLkxs58RsnpF1TwouXHUHX0rsOoL/cTWH+oMR7D1SuN0zmHCfQoapixPB73WmveYsXUKs7DTUeJHgvvLmW07y2LTVhuemW+7wHRnxbi55WyjjK3s++u5fcN//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////9y0kyW//KyWGdBLsSG40KG0XVnUJCpq5ABak99t5MJFcX6s2xKK5gOq2k1Q2YjBE/do7GEegO5jjQzWqkTlPMLEzGngUgrTTZ7FQ9StJQnS7TSML6eqQgKUkKKlQmzfbyOmbTG+aY76eHPiBrFN6zEqWYAKgqp7Cu3V+p77mvqfFGGJrNfG+qR4eI0SsLcTMKPB3aXV29rgbcIcCsd64v8vNyxNQoz15WaJ7Ulj7gzRcYZteXWoMeLTEOKTC7f/X/0Kyi0yqqkwNqtZpaYu9PEL5E81os1IyC4WCjyNqlTm4BRoQx4bwD9rVCvcXkeProq1RuoexqREPF1EitkSrqE5wmyOiXtk+zK+I9vMqXNifzpuZxWVamFlU5xtSK9kxVjXSdmhbhPIW93bq6tCljHiK4locZ/pivH3qfNsUo5wcU3D3HgXzD1LR7DncqbvelI9vBvikl2OTW2zLjEmf9/BpjVHmbtlIOme8+YVGTWNRpbx9Qs0j0km1Er78r/SXF2/39dLJtcMP9h1HrNSrXnuz/rP0tBNVVUqlDuPf0YDQMxIB6KqXxQtM28FcuXgFbdOrQnBDGOY9Qj7uSAp2huRKtbTpzAUysVLlEeMDcf3cXq5nUq20Klzc29WpGSPlWzJ1ldoSpIywkdn0kaG9bS3Eu4vGxkV8Ryb4lnmfCbW2Z7HcGyqgBanIz0mq1xXF7aLvVMe7umr5rh56UjQ8VziDjea2n0/mk01zwexZpPF3TT2XFaS7r96gbzHmkze8sesaLAjN9M/dHsOHAKNEsgMqfF7EyAdc7vLp3sUGBqlVihs4bW//vgQAAADslnRUMMY2LEbRi5YY9sVXWdFywZLYKbMyLhhKGwWZlX/ygHZbQTyh8ioRB8fXES2qnJtApC9nYjt/QWW2lwboMtZp2wwy2uuhnj107b0TH45r8dlpNciXQw7tHzg5cfRlJNAmucGh+ORy+dD6psujIKocmIV7VPR5GktetKpwBjM6OVDH0beSwQda0sUYgnFNYftYpPUoncYa2CzLMP2JF1t+sfzeJ3+dgiciimu44ndw5PlrHPVXNwONIFan76w8SsvI7NY6j7f+SPim+85fYobrnXpPugnqebRzmBIXbN79////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+thTLVKqohdo8NKOosxkqhfu0gjUtOnx5jFysax7UctMruvPbT4Gm+f9CTPhSkTrF5OjwnMsMrWVepVZh2zR4zuA2R9MrYoqPKQVTF1pXNjjWVz3JVrh7b3FsxjN95jT4fQa+Md5MzU3PNSu/4MXNY8Ol3kuNQo97fwcZ1Dsz6r2OkfU+tbfx6408hzapuNAfVf0rlrzrN92j7zFxen1i/s8gZvSmra9q5mvy5nLmf/LbnGyyClVvfqo26ir377yRe//B9uq/VVVlVFntuausBdrJKkSM96ApoYkB0Un2Cvs+LFHX5MPrSiWSzFHMRjklU7OOfVcQSjUk4wRJkW4UVjGC+SdpEs0Koql5Kw0RkDazU/2l/KW00YfKTPlGNJNJW0pK1nJzT2CatKL8i1Epccko83UysaUQooM6/F9ei/xdf5Cus+U23QvwLzTtp8UEL7KH1GKGiIZaWLWlxRuylChRtVht69jpcXOk2PFTDiyVXLf+ljn/3I6p6lGCregsLsYKpU45LpmClLWgrEAEsIzC/1nXqtSxX1HHsKpJyjDZHIccJDVe2s4eZQoMg4zvsPzxFUcLlHtA2oioHDEIGkiyi5yQFAjkihqyspFvYvb0h8wJE7WElCzlNIuSSXKsVki2lKc8taIOtGPuR0OOIUxc6tyQ4R4cP4x7QSZNIWEHOZGCjFsx0xG3MiJ80mxKSkWjaGLpU//vgQAAAD/pixkmDM2Gcx/ioMGNcSoABLgAAACAAACXAAAAE6u1lmlVBErVXY+7CeCTVahAkP2zcNYys9hkeTVyDATMBN557LPOLCWJVTvVxRsXkbPlGKpjY1nnv++bLPGbLetqm3y1q1o3Pm5/nn///1v/fs2tTbLa81SUzLU8y255fHn1Wzldn7zjbPw7TTglDQldR/PO9P/rK1PyOV////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+VpAUACUoGX2utqOJOFIHRKpk0PY16oYCP/VeMFEtVDF+zVf/ux9VSY/1VdmNVZrt9U1/ak0AmZuHxm4a//SY4GIqaKm87fxku/CooL8Vl3USU74uTZvnG9Niu6K6Kx//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////vgQAAAD/wAS4AAAAmcgAlwAAABCoABLgAAACAAACXAAAAE//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////vgQAAAD/wAS4AAAAmcgAlwAAABCoABLgAAACAAACXAAAAE//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////vgQAAAD/wAS4AAAAmcgAlwAAABCoABLgAAACAAACXAAAAE////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////';
    //   ↑↑↑  tiene que empezar por  data:audio/…;base64,   ↑↑↑
    //
    // Mientras esté vacío suena un pitido sintetizado en su lugar, así que la
    // función no depende de tener el fichero: se oye igual, solo que sin la
    // campanita de Steam.
    let audioCtx = null;

    function synthBeep() {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            if (!audioCtx) audioCtx = new Ctx();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            // Dos notas cortas hacia arriba: un pitido plano se confunde con
            // cualquier otro sonido del sistema.
            [[880, 0], [1320, 0.12]].forEach(([hz, at]) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.value = hz;
                const t0 = audioCtx.currentTime + at;
                gain.gain.setValueAtTime(0, t0);
                gain.gain.linearRampToValueAtTime(ALERT_VOLUME * 0.3, t0 + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
                osc.connect(gain).connect(audioCtx.destination);
                osc.start(t0);
                osc.stop(t0 + 0.13);
            });
        } catch (e) { /* sin audio disponible */ }
    }

    function playAlertBeep() {
        if (!ALERT_SOUND) { synthBeep(); return; }
        try {
            const audio = new Audio(ALERT_SOUND);
            audio.volume = ALERT_VOLUME;
            // El navegador puede negarse a sonar en una pestaña con la que no
            // has interactuado; se calla en vez de lanzar, y el aviso visual
            // sigue estando.
            audio.play().catch(() => { });
        } catch (e) { /* noop */ }
    }

    let beepTimer = null;

    function startBeeping() {
        if (beepTimer) return;
        playAlertBeep();
        beepTimer = setInterval(playAlertBeep, ALERT_BEEP_MS);
    }

    function stopBeeping() {
        if (!beepTimer) return;
        clearInterval(beepTimer);
        beepTimer = null;
    }

    // El título se compone en UN SOLO SITIO y se rearma entero desde el
    // original: si cada cosa lo escribiera por su cuenta, la que se pone a
    // cero borraría la marca de la otra sin saber que existía.
    const ORIGINAL_TITLE = document.title;

    function paintTitle(pending) {
        const want = pending > 0 ? '(' + nf.format(pending) + ') ' + ORIGINAL_TITLE : ORIGINAL_TITLE;
        if (document.title !== want) document.title = want;
    }

    function readAlerts() {
        const raw = recall(ALERT_KEY);
        if (!raw) return [];
        try {
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return [];
            return arr.filter(a => a && typeof a.code === 'string');
        } catch (e) { return []; }
    }

    function saveAlerts(list) {
        const cut = Date.now() - ALERT_TTL_MS;
        let out = list.filter(a => (a.found || 0) > cut);
        if (out.length > ALERT_MAX_ENTRIES) {
            // Se tiran las más viejas, no las últimas de la lista: el orden de
            // guardado no tiene por qué ser el de antigüedad.
            out = out.slice().sort((a, b) => (b.found || 0) - (a.found || 0)).slice(0, ALERT_MAX_ENTRIES);
        }
        store(ALERT_KEY, out.length ? JSON.stringify(out) : null);
        return out;
    }

    function alertsOn() {
        return recall(ALERT_ON_KEY) === '1'
            && splitKeywords(readKeywords()).positive.length > 0;
    }

    function pendingAlerts() {
        return readAlerts().filter(a => !a.seen);
    }

    function markAlertSeen(code) {
        const list = readAlerts();
        list.forEach(a => { if (code === null || a.code === code) a.seen = true; });
        saveAlerts(list);
        run();
    }

    // Solo una pestaña sondea, o con tres abiertas se pediría tres veces lo
    // mismo. No hay comparar-y-cambiar en localStorage, así que esto es "lo
    // mejor que se puede hacer": el dueño refresca su marca y el resto respeta
    // la que no haya caducado. Si dos pestañas se pisaran en el mismo
    // milisegundo, lo peor que pasa es una pasada de más.
    function takeAlertLock() {
        const now = Date.now();
        let lock = null;
        try { lock = JSON.parse(recall(ALERT_LOCK_KEY) || 'null'); } catch (e) { lock = null; }
        if (lock && lock.tab !== TAB_ID && now - (lock.at || 0) < ALERT_LOCK_MS) return false;
        store(ALERT_LOCK_KEY, JSON.stringify({ tab: TAB_ID, at: now }));
        return true;
    }

    function holdAlertLock() {
        store(ALERT_LOCK_KEY, JSON.stringify({ tab: TAB_ID, at: Date.now() }));
    }

    function dropAlertLock() {
        let lock = null;
        try { lock = JSON.parse(recall(ALERT_LOCK_KEY) || 'null'); } catch (e) { lock = null; }
        if (lock && lock.tab === TAB_ID) store(ALERT_LOCK_KEY, null);
    }

    // El listado del sitio, desde la raíz y no desde la página que tengas
    // delante: un aviso que dependiera de dónde estás parado avisaría de cosas
    // distintas según la pestaña, y en el foro no avisaría de nada. La raíz es
    // el listado completo, y como va con tu sesión respeta los filtros de tu
    // cuenta —nivel, biblioteca, ya-entrados— igual que el botón de cargar.
    //
    // Se recorre ENTERO en cada pasada, que es lo que se pidió: la lista no
    // está ordenada por fecha de creación, así que un sorteo nuevo puede
    // aparecer en cualquier página y mirar solo las primeras se lo saltaría.
    //
    // Si la primera página no trajera ni una fila, no se inventa nada: se
    // devuelve el fallo y el panel lo dice. Un aviso que calla porque no supo
    // leer se parece demasiado a "no hay novedades".
    function alertFeedUrl(page) {
        const u = new URL('/', location.origin);
        if (page > 1) u.searchParams.set('page', String(page));
        return u.toString();
    }

    function rowRecord(row) {
        const g = parseRow(row);
        if (!g) return null;
        const code = rowCode(row);
        if (!code) return null;
        const link = row.querySelector(SEL.name);
        return {
            code,
            name: g.name,
            href: link ? link.getAttribute('href') : '/giveaway/' + code,
            points: g.points,
            copies: g.copies,
            entries: g.entries,
            found: Date.now(),
            seen: false,
        };
    }

    // La pasada lee el listado entero de todas formas, así que dejar sus filas
    // en la página no cuesta ni una petición más: es el mismo trabajo del botón
    // de cargar a mano, gratis.
    //
    // Pero solo se inyecta si lo que tienes delante ES ese mismo listado: la
    // portada, sin búsqueda ni filtros en la barra de direcciones. Si estás en
    // `?q=doom`, meterle las filas del listado general convertiría una búsqueda
    // en otra cosa sin avisar, y eso es peor que no cargar nada. En el foro ni
    // se plantea, y en la ficha de un sorteo tampoco.
    function canInjectHere() {
        if (isSinglePage() || location.pathname !== '/') return false;
        return !new URL(location.href).search;
    }

    let scanning = false;
    let scanFailed = false;
    // Una pasada tarda lo que tarda —una petición por página, con pausa—, así
    // que es fácil pedir otra mientras la anterior está a medias: marcas la
    // casilla, o pulsas el ⟳. Antes esa segunda petición se perdía en silencio y
    // había que esperar al siguiente cuarto de hora; ahora se apunta y se
    // atiende en cuanto la que está corriendo acaba.
    let rescanWanted = false;
    // Y de quién era la que se apuntó, porque de eso depende que la pasada
    // reencolada mueva el reloj del cuarto de hora o lo deje quieto.
    let rescanFromCycle = false;

    // Cada pasada recorre el listado completo y avisa de todo lo que casa con
    // tus palabras y no estuviera ya en la lista. Ese "ya estaba" es lo único
    // que evita el aviso repetido, y es lo que hace que marcar algo como visto
    // lo calle para siempre.
    //
    // La parada es la misma que la del botón de cargar a mano, y por el mismo
    // motivo: se para cuando una página no trae ni un código que no se haya
    // visto YA EN ESTA PASADA. Así funciona igual si el listado tiene tres
    // páginas o veinte, si el sitio ignora el parámetro y devuelve siempre la
    // misma, o si mañana cambia su paginación.
    //
    // Hubo aquí un recorrido corto —guardar el sorteo más nuevo de la pasada
    // anterior y parar al reencontrarlo— y se quitó a petición del usuario: la
    // lista de SteamGifts no va por fecha de creación, así que un sorteo nuevo
    // puede caer en cualquier página y pararse pronto se lo salta. Cuesta una
    // petición por página cada cuarto de hora, y eso está dicho en el aviso de
    // la casilla, en el modal y en el README.
    async function scanForAlerts(fromCycle) {
        if (scanning) { rescanWanted = true; if (fromCycle) rescanFromCycle = true; return; }
        scanning = true;
        scanFailed = false;
        run();
        const kws = readKeywords();
        const already = new Set(readAlerts().map(a => a.code));
        const seenNow = new Set();
        const fresh = [];
        // Lo que YA está en la página, para no duplicar filas al inyectar.
        const inject = canInjectHere();
        const inPage = new Set();
        if (inject) {
            plainRows(document).forEach(r => {
                const code = rowCode(r);
                if (code) inPage.add(code);
            });
        }
        let added = 0;
        let pagesDone = 0;
        let rowsSeen = 0;
        let more = true;
        try {
            for (let page = 1; page <= ALERT_MAX_PAGES; page++) {
                if (page > 1) await sleep(LOAD_DELAY_MS);
                holdAlertLock();
                let doc;
                try {
                    const res = await fetch(alertFeedUrl(page), { credentials: 'same-origin' });
                    if (!res.ok) throw new Error(String(res.status));
                    doc = new DOMParser().parseFromString(await res.text(), 'text/html');
                } catch (e) {
                    scanFailed = true;
                    break;
                }
                const rows = plainRows(doc);
                rowsSeen += rows.length;

                // El ancla se rebusca en CADA página y no se arrastra de la
                // anterior: si el listado está ordenado por valor, entre una
                // página y la siguiente las filas se han movido de sitio.
                const here = inject ? plainRows(document) : [];
                let anchor = here[here.length - 1] || null;

                let unknown = 0;
                for (const row of rows) {
                    const rec = rowRecord(row);
                    if (!rec || seenNow.has(rec.code)) continue;
                    seenNow.add(rec.code);
                    unknown++;
                    if (inject && anchor && anchor.parentNode && !inPage.has(rec.code)) {
                        inPage.add(rec.code);
                        const node = document.importNode(row, true);
                        anchor.parentNode.insertBefore(node, anchor.nextSibling);
                        anchor = node;
                        added++;
                    }
                    if (already.has(rec.code)) continue;
                    if (matchesKeywords(rec.name, kws)) fresh.push(rec);
                }
                pagesDone++;
                // Ni un código que no estuviera ya en esta pasada: se acabó el
                // listado, o el sitio devolvió otra vez la misma página.
                if (!unknown) { more = false; break; }
            }
            if (!rowsSeen) scanFailed = true;
            if (fresh.length) saveAlerts(readAlerts().concat(fresh));
            // La hora se apunta también cuando falla: si no, un endpoint roto se
            // reintentaría cada minuto en vez de cada cuarto de hora.
            store(ALERT_LAST_KEY, String(Date.now()));
            // Pero el reloj del cuarto de hora SOLO lo mueve el bucle. Una
            // pasada por cargar la página o por el ⟳ no lo adelanta: si lo
            // adelantara, ir pinchando enlaces por el sitio dejaría al bucle
            // permanentemente a quince minutos de disparar. (La casilla sí lo
            // reinicia, pero al marcarla y no aquí: es borrón y cuenta nueva.)
            if (fromCycle) store(ALERT_CYCLE_KEY, String(Date.now()));

            // Las filas inyectadas cuentan igual que las del botón: comparten
            // el mismo estado, así que la paginación del sitio se pliega por el
            // mismo camino y el widget no lleva dos cuentas distintas de lo
            // mismo.
            if (added) {
                if (!loadState) {
                    loadState = { running: false, stop: false, pages: 0, added: 0, note: '', exhausted: false, from: 1 };
                }
                loadState.pages += Math.max(0, pagesDone - 1);
                loadState.added += added;
                loadState.exhausted = !scanFailed && !more;
                loadState.note = tn(loadState.pages, 'loadDone', {
                    pages: nf.format(loadState.pages), n: nf.format(loadState.added),
                });
            }
        } finally {
            scanning = false;
            dropAlertLock();
            run();
            if (rescanWanted) {
                rescanWanted = false;
                const wasCycle = rescanFromCycle;
                rescanFromCycle = false;
                maybeScanForAlerts(true, wasCycle);
            }
        }
    }

    // `force` salta el cuarto de hora, y lo usan las tres cosas que NO son el
    // reloj: cargar la página, marcar la casilla y el ⟳. El cuarto de hora
    // gobierna solo al reloj; al abrir o navegar a una página se revisa
    // siempre, porque es entonces cuando hay un listado delante que llenar y
    // cuando quieres saber si apareció algo mientras no mirabas.
    //
    // El turno entre pestañas se respeta en los DOS casos, y es el único freno
    // que queda: sin él, ir pinchando enlaces por el sitio lanzaría un
    // recorrido completo por cada navegación. Con él, mientras haya uno en
    // vuelo —suyo o de otra pestaña— la siguiente carga no pide nada.
    //
    // `fromCycle` dice quién llama, y es lo único que puede mover el reloj del
    // cuarto de hora. Las tres cosas que fuerzan recorren el listado entero sin
    // mirar la marca de tiempo Y sin tocarla, así que el bucle sigue contando
    // desde su propia última pasada y llega a su hora aunque entre medias hayas
    // recargado la página veinte veces. Al contrario que antes, cuando cada
    // recarga le devolvía el reloj a cero y el bucle solo disparaba si dejabas
    // la pestaña quieta un cuarto de hora entero.
    function maybeScanForAlerts(force, fromCycle) {
        if (!alertsOn()) return;
        // Con una pasada en marcha, la petición NO se tira: se apunta y se
        // atiende al acabar. Aquí estaba el escape que la perdía.
        if (scanning) { rescanWanted = true; if (fromCycle) rescanFromCycle = true; return; }
        if (!force) {
            const last = parseInt(recall(ALERT_CYCLE_KEY), 10) || 0;
            if (Date.now() - last < ALERT_EVERY_MS) return;
        }
        if (!takeAlertLock()) return;
        scanForAlerts(fromCycle);
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

    // Misma forma que las otras dos casillas, y por el mismo motivo se queda
    // inerte en vez de irse cuando no hay palabras: sin ninguna no hay de qué
    // avisar, y una casilla que desaparece mueve de sitio todo lo de debajo.
    function buildAlertsCheck(host, enabled) {
        const row = el('label', 'sgpv-w__check' + (enabled ? '' : ' sgpv-w__check--off'));
        const box = el('input');
        box.type = 'checkbox';
        box.checked = recall(ALERT_ON_KEY) === '1';
        box.disabled = !enabled;
        box.addEventListener('change', () => {
            store(ALERT_ON_KEY, box.checked ? '1' : null);
            // Encender Y apagar borran los avisos: el interruptor es el borrón y
            // cuenta nueva. Así, al volver a encenderla, la primera pasada avisa
            // de todo lo que casa —incluido lo que ya habías marcado antes—, que
            // es lo que se espera de empezar de cero.
            store(ALERT_KEY, null);
            store(ALERT_LAST_KEY, null);
            // El interruptor es lo ÚNICO que reinicia el reloj del bucle sin
            // ser el bucle, y por eso mismo: encenderla revisa ahora, así que
            // la siguiente pasada del reloj toca un cuarto de hora después de
            // ahora, no un cuarto de hora después de lo que hubiera antes.
            store(ALERT_CYCLE_KEY, String(Date.now()));
            run();
            // Y se revisa YA, sin esperar el cuarto de hora: quien acaba de
            // marcarla quiere saber qué hay ahora, no dentro de quince minutos.
            maybeScanForAlerts(true);
        });
        row.appendChild(box);
        row.appendChild(el('span', null, t('alerts')));
        row.title = enabled
            ? t('alertsTip', {
                mins: nf.format(Math.round(ALERT_EVERY_MS / 60000)),
                beep: nf.format(Math.round(ALERT_BEEP_MS / 1000)),
                max: nf.format(ALERT_MAX_PAGES),
                delay: nf.format(Math.round(LOAD_DELAY_MS / 100) / 10),
            })
            : t('alertsNeeds');
        host.appendChild(row);

        // Estado del sondeo, solo con la casilla puesta: sin él no hay forma de
        // saber si esto vive. La hora es más útil que un «hace 3 min» que
        // habría que refrescar.
        if (!enabled || recall(ALERT_ON_KEY) !== '1') return;
        const last = parseInt(recall(ALERT_LAST_KEY), 10) || 0;
        let text = t('alertsScanning');
        if (!scanning) {
            const when = last ? new Date(last).toLocaleTimeString(LANG === 'es' ? 'es' : 'en') : '';
            text = scanFailed ? '⚠ ' + t('alertsFail')
                : (last ? t(pendingAlerts().length ? 'alertsLast' : 'alertsQuiet', { time: when })
                    : t('alertsScanning'));
        }
        const line = el('div', 'sgpv-w__line sgpv-w__line--small');
        if (scanFailed && !scanning) line.classList.add('sgpv-w__line--short');
        const label = el('span', null, text);
        label.title = t('alertsFirstClick');
        line.appendChild(label);
        const now = el('button', 'sgpv-w__now', '⟳');
        now.type = 'button';
        now.title = t('alertsNow');
        now.disabled = scanning;
        now.addEventListener('click', () => maybeScanForAlerts(true));
        line.appendChild(now);
        host.appendChild(line);
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
            // El tope se explica SIEMPRE, no solo estando en él: el dato sirve
            // ANTES, que es cuando aún se puede gastar para no perder nada. Al
            // llegar, el aviso cambia al que habla en presente.
            amount.title = atCap ? t('cappedTip') : t('pointsTip');
            if (atCap) amount.appendChild(el('span', 'sgpv-w__cap', ' ' + t('capped')));
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
        // Esta sí va también en la ficha de un sorteo: los avisos no son del
        // listado que tengas delante, son de lo que aparece en el sitio.
        buildAlertsCheck(body, splitKeywords(readKeywords()).positive.length > 0);

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
        const alerts = alertsOn() ? pendingAlerts() : [];

        // Las coincidencias que están EN la página, por su código: es lo que
        // permite cruzarlas con los avisos y no listar dos veces el mismo
        // sorteo cuando la revisión acaba de dejarlo cargado aquí.
        const here = new Map();
        if (!solo) {
            list.filter(g => g.kw && g.row.isConnected).forEach(g => {
                const code = rowCode(g.row);
                if (code && !here.has(code)) here.set(code, g);
            });
        }

        // Los avisos van PRIMERO, del más nuevo al más viejo: es lo que acaba
        // de aparecer, y enterrarlo en medio de treinta coincidencias sería
        // esconderlo. Detrás, el resto de las coincidencias en el orden de la
        // página, que es como se leen.
        const items = [];
        const listed = new Set();
        alerts.slice().sort((a, b) => (b.found || 0) - (a.found || 0)).forEach(a => {
            listed.add(a.code);
            const g = here.get(a.code) || null;
            items.push({ g, alert: a, name: a.name, num: g || derive(a.points, a.copies, a.entries) });
        });
        here.forEach((g, code) => {
            if (listed.has(code)) return;
            items.push({ g, alert: null, name: g.name, num: g });
        });

        const show = items.length || (alertsOn() && scanFailed);
        if (!show) {
            if (old) old.remove();
            paintTitle(0);
            stopBeeping();
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

        // Se pliega igual que el widget, y por el mismo motivo: los dos están
        // fijos y tapan una columna del listado. La diferencia es que aquí las
        // cuentas se quedan VISIBLES al plegar —son el dato que hace falta de
        // un vistazo—, así que la cabecera sigue diciendo «7 · 🔔 2» con la
        // lista recogida.
        panel.classList.toggle('sgpv-m--min', recall(MMIN_KEY) === '1');

        const head = el('div', 'sgpv-m__head');
        head.appendChild(el('span', 'sgpv-m__title', t('matches')));
        head.title = alerts.length ? t('matchesAlertTip') : t('matchesTip');
        const side = el('span', 'sgpv-m__side');
        side.appendChild(el('span', 'sgpv-m__count', nf.format(items.length)));
        if (alerts.length) {
            // La campana con su cuenta, aparte del total: "de estos siete, dos
            // son nuevos" es una frase distinta de "hay siete".
            const bell = el('span', 'sgpv-m__bell', '🔔 ' + nf.format(alerts.length));
            bell.title = t('alertsCount', { n: nf.format(alerts.length) });
            side.appendChild(bell);
            const all = el('button', 'sgpv-m__eye', '👁️');
            all.type = 'button';
            all.title = t('alertsSeenAll');
            all.addEventListener('click', () => markAlertSeen(null));
            side.appendChild(all);
        }
        const min = el('button', 'sgpv-m__min', recall(MMIN_KEY) === '1' ? '+' : '–');
        min.type = 'button';
        min.title = t('minimise');
        min.addEventListener('click', () => {
            const now = recall(MMIN_KEY) !== '1';
            store(MMIN_KEY, now ? '1' : null);
            panel.classList.toggle('sgpv-m--min', now);
            min.textContent = now ? '+' : '–';
        });
        side.appendChild(min);
        head.appendChild(side);
        panel.appendChild(head);

        const body = el('div', 'sgpv-m__body');
        if (alertsOn() && scanFailed) body.appendChild(el('div', 'sgpv-m__fail', '⚠ ' + t('alertsFail')));
        items.forEach(it => {
            const item = el('div', 'sgpv-m__item' + (it.alert ? ' sgpv-m__item--new' : ''));

            // NUNCA un enlace al sorteo, y es una decisión del usuario: para
            // abrirlo ya está la propia fila del listado, que es donde se
            // pulsa normalmente. Aquí el clic solo SALTA a esa fila; y si el
            // sorteo no está en esta página —el foro, o una búsqueda, donde la
            // revisión no inyecta nada— no hay a dónde saltar y el elemento se
            // queda quieto en vez de llevarte a ninguna parte.
            const go = el(it.g ? 'button' : 'div', 'sgpv-m__go');
            if (it.g) {
                go.type = 'button';
                go.title = t('jumpTip');
                go.addEventListener('click', () => jumpTo(it.g));
            } else {
                go.title = t('alertsElsewhere');
                go.classList.add('sgpv-m__go--flat');
            }
            go.appendChild(el('span', 'sgpv-m__name', (it.alert ? '🔔 ' : '') + it.name));
            go.appendChild(el('span', 'sgpv-m__val', fmtOdds(it.num) + ' · ' + fmtPerPoint(it.num)));
            item.appendChild(go);

            if (it.alert) {
                const eye = el('button', 'sgpv-m__eye', '👁️');
                eye.type = 'button';
                eye.title = t('alertsSeenOne');
                eye.addEventListener('click', () => markAlertSeen(it.alert.code));
                item.appendChild(eye);
            }
            body.appendChild(item);
        });
        panel.appendChild(body);

        paintTitle(alerts.length);
        // El bucle está atado a que HAYA avisos sin marcar, así que se apaga
        // solo en cuanto marcas el último: no hay que pararlo desde cada botón.
        if (alerts.length) startBeeping(); else stopBeeping();
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
    let tipPoint = null;

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

    // El widget se rehace entero en cada pasada, así que el control señalado
    // puede haber desaparecido mientras corría el retardo. Eso no es motivo
    // para tragarse el aviso: lo que cuenta es qué hay AHORA bajo el ratón, y
    // el control equivalente está en el mismo punto de la pantalla.
    function liveAnchor(node) {
        if (node.isConnected) return node;
        if (!tipPoint) return null;
        return tipTargetFrom(document.elementFromPoint(tipPoint.x, tipPoint.y));
    }

    function showTip(node) {
        const anchor = liveAnchor(node);
        if (!anchor) return;
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
        document.addEventListener('mouseover', ev => {
            tipPoint = { x: ev.clientX, y: ev.clientY };
            tipEnter(tipTargetFrom(ev.target));
        });
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
            '.sgpv-off{display:none !important;}',
            // Contorno y no sombra: el marco ámbar de coincidencia y la barra
            // verde de mejor valor ya usan box-shadow, y el destello tiene que
            // verse encima de los dos.
            '.' + JUMP_CLASS + ' > .giveaway__row-inner-wrap{outline:3px solid #9fb4e8;',
            'outline-offset:-3px;}',
            '#' + WIDGET_ID + ' .sgpv-w__line--small{font-size:11px;color:#9aa4b2;display:flex;',
            'align-items:center;justify-content:space-between;gap:6px;}',
            '#' + WIDGET_ID + ' .sgpv-w__line--small > span{cursor:help;}',
            '#' + WIDGET_ID + ' .sgpv-w__now{flex:0 0 auto;cursor:pointer;background:transparent;',
            'border:0;color:#9fb4e8;font:inherit;font-size:13px;line-height:1;padding:0 2px;}',
            '#' + WIDGET_ID + ' .sgpv-w__now:hover:not(:disabled){color:#fff;}',
            '#' + WIDGET_ID + ' .sgpv-w__now:disabled{opacity:.4;cursor:default;}',
            // Vuelve a poder ocupar el alto entero: los avisos viven aquí
            // dentro, así que ya no hay un segundo panel con el que repartirse
            // este lado de la pantalla.
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
            '#' + MATCH_ID + ' .sgpv-m__side{display:flex;align-items:center;gap:7px;}',
            '#' + MATCH_ID + ' .sgpv-m__min{cursor:pointer;background:transparent;border:0;',
            'color:#9aa4b2;font-size:15px;line-height:1;padding:0 2px;}',
            '#' + MATCH_ID + ' .sgpv-m__min:hover{color:#fff;}',
            '#' + MATCH_ID + '.sgpv-m--min .sgpv-m__body{display:none;}',
            '#' + MATCH_ID + ' .sgpv-m__body{overflow-y:auto;min-height:0;padding:6px;',
            'overscroll-behavior:contain;}',
            '#' + MATCH_ID + ' .sgpv-m__bell{font-weight:700;color:#ffcf66;white-space:nowrap;',
            'cursor:help;}',
            '#' + MATCH_ID + ' .sgpv-m__eye{flex:0 0 auto;cursor:pointer;background:transparent;',
            'border:0;color:#9aa4b2;font-size:13px;line-height:1;padding:0 3px;}',
            '#' + MATCH_ID + ' .sgpv-m__eye:hover{color:#fff;}',
            '#' + MATCH_ID + ' .sgpv-m__fail{color:#e29a9a;padding:2px 4px 6px;}',
            // El item es la fila: dentro, la zona que salta y —si es un aviso—
            // el ojo que lo marca. Dos botones hermanos, no uno dentro de otro.
            '#' + MATCH_ID + ' .sgpv-m__item{display:flex;align-items:center;gap:2px;',
            'padding:2px 3px;margin:0 0 3px;border-radius:4px;',
            'border:1px solid transparent;background:transparent;}',
            '#' + MATCH_ID + ' .sgpv-m__item:hover{background:#3a4655;border-color:#4b72d4;}',
            '#' + MATCH_ID + ' .sgpv-m__item--new{background:#39322a;border-color:#5a4a2c;}',
            '#' + MATCH_ID + ' .sgpv-m__item--new:hover{background:#4a4132;border-color:#e0a92e;}',
            '#' + MATCH_ID + ' .sgpv-m__go{flex:1 1 auto;min-width:0;display:block;',
            'text-align:left;font:inherit;cursor:pointer;padding:2px 3px;border:0;',
            'background:transparent;color:#e6e9ee;}',
            // El que no puede saltar a ninguna parte no finge que se puede
            // pulsar: ni cursor de mano ni foco.
            '#' + MATCH_ID + ' .sgpv-m__go--flat{cursor:help;}',
            '#' + MATCH_ID + ' .sgpv-m__item--new .sgpv-m__name{color:#ffe9b0;}',
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
            '#' + WIDGET_ID + ' .sgpv-w__amount{font-size:24px;font-weight:700;color:#fff;cursor:help;}',
            '#' + WIDGET_ID + ' .sgpv-w__amount--cap{color:#ffcf66;}',
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

    // Un bloque ya plegado NO se puede medir tal cual: con `display:none` mide
    // 0 de alto, así que `showsNothing()` contestaba "aquí no hay hueco" y la
    // rama de abajo lo desplegaba. Cada pasada invertía el estado de todos, y
    // el síntoma era que los huecos aparecían al marcar cualquier casilla del
    // widget y desaparecían al desmarcarla.
    //
    // Para volver a decidir hay que devolverlo a su sitio, medirlo y —si sigue
    // sin pintar nada— volver a plegarlo, todo en la misma vuelta del bucle de
    // eventos: el navegador recalcula el layout al leerlo, pero no pinta nada
    // entre las dos escrituras, así que no hay parpadeo.
    //
    // Se intentó antes con un atajo sin layout —"¿cargó ya la imagen del
    // banner?"— y estaba mal: `naturalWidth` dice que la imagen se descargó,
    // no que se vea. En la máquina del usuario el bloqueador esconde
    // `.fanatical_container` con una regla cosmética y la imagen vale 616,
    // así que el atajo desplegaba justo lo que había que dejar plegado. Medir
    // es más caro y es lo único que responde a la pregunta de verdad.
    function stillShowsNothing(node) {
        const prev = node.style.display;
        node.style.display = '';
        const nothing = showsNothing(node);
        if (nothing) node.style.display = prev;
        return nothing;
    }

    // Se pliega SOLO lo que se reconoce, y no "todo lo que no sea una fila":
    // en ese contenedor viven también la paginación y las tablas de Deals y
    // Discussions del final, y plegar a ciegas lo que no se identifica es
    // pedirle al script que esconda cosas del sitio que nadie ha mirado.
    //
    // Un contenedor vacío de elementos cuenta también: solo puede ser un
    // separador con altura reservada, que es exactamente el hueco a plegar.
    function isPromoBlock(node) {
        if (node.classList.contains('giveaway__row-outer-wrap')) return false;
        if (node.id === WIDGET_ID || node.id === MATCH_ID) return false;
        if (node.querySelector(SEL.row)) return false;
        return !!node.querySelector(SEL.promo) || !node.firstElementChild;
    }

    function foldEmptyBlocks(list) {
        const host = list.find(g => !g.pinned && g.row.parentElement);
        if (!host) return 0;
        const on = recall(HOLES_KEY) === '1';
        let folded = 0;
        Array.from(host.row.parentElement.children).forEach(node => {
            if (!isPromoBlock(node)) return;
            const wasFolded = node.dataset.sgpvFolded === '1';
            const fold = on && (wasFolded ? stillShowsNothing(node) : showsNothing(node));
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

    // Al traer páginas a esta, la paginación del sitio empieza a mentir: su
    // "Displaying 1 to 50" contradice las 201 filas que hay delante. Pero no se
    // esconde entera de golpe, porque sus dos mitades no valen lo mismo:
    //
    // - `pagination__results` es una AFIRMACIÓN, y es falsa en cuanto se añade
    //   la primera fila. Se oculta desde ese momento; el widget ya dice
    //   cuántas páginas y cuántos sorteos entraron.
    // - `pagination__navigation` es una HERRAMIENTA, y sigue sirviendo si la
    //   carga se paró a medias o si una página falló: son las páginas que
    //   quedan por ver. Solo se oculta cuando el sitio dijo que no había más,
    //   que es cuando ya no lleva a ninguna parte.
    //
    // En la ficha de un sorteo no se toca: ahí `.pagination` es la de los
    // comentarios, y no la hemos tocado nosotros.
    function foldPagination() {
        if (isSinglePage() || !loadState || !loadState.added) return;
        Array.from(document.querySelectorAll(SEL.pagination)).forEach(pag => {
            const results = pag.querySelector(SEL.pagResults);
            if (results) results.classList.add('sgpv-off');
            if (loadState.exhausted) pag.classList.add('sgpv-off');
        });
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
        foldPagination();
        if (recall(SORT_KEY) === '1') applySort(list, true);
        return true;
    }

    // Un solo temporizador por observador: una entrada en un sorteo dispara
    // varias mutaciones seguidas —el saldo, el botón de la fila, a veces la
    // fila entera— y sin esto se recalcularía la página una vez por cada una.
    function debounced(fn, ms) {
        let pending = null;
        return () => { clearTimeout(pending); pending = setTimeout(fn, ms); };
    }

    // EL REPINTADO SE VE A SÍ MISMO, así que hay que descartar sus propias
    // mutaciones. Con el orden por valor puesto, cada pasada reparte las filas
    // con marcadores DENTRO del mismo contenedor que vigila el observador (ver
    // `reflow`), o sea que deja mutaciones de childList que programan la pasada
    // siguiente. Basta un cambio del sitio para arrancarlo —entrar a un sorteo
    // con el botón rápido reemplaza la fila— o pulsar el propio botón de
    // ordenar, y a partir de ahí el listado se recalcula cada 200 ms para
    // siempre.
    //
    // El síntoma por el que se encontró no fue el listado, fue el tooltip
    // propio: el widget se rehace entero en cada pasada, y con un repintado
    // cada 200 ms el control bajo el ratón ya no existía cuando vencía el
    // retardo de 250 ms, así que `showTip` se salía por `!anchor.isConnected` y
    // el aviso no aparecía NUNCA.
    //
    // `takeRecords()` vacía la cola del observador antes de que se entregue
    // —los registros se encolan al mutar y se reparten en una microtarea, o sea
    // después de esta función—, así que se tira lo que acaba de hacer el script
    // y sigue llegando lo que venga después.
    const OBSERVERS = [];

    function watchNode(target, opts, schedule) {
        const obs = new MutationObserver(schedule);
        obs.observe(target, opts);
        OBSERVERS.push(obs);
    }

    function repaint() {
        try { run(); } finally { OBSERVERS.forEach(o => o.takeRecords()); }
    }

    // EL SALDO NO VIVE EN EL LISTADO, vive en la cabecera del sitio. Al entrar
    // o salir de un sorteo con el botón rápido de una fila, SteamGifts reescribe
    // `.nav__points` por AJAX; el listado, en cambio, puede no cambiar en
    // absoluto. Así que el observador del listado —childList del contenedor de
    // filas— no ve nada de eso, y el widget se quedaba con el saldo de la carga
    // de la página: la cabecera decía 191P y él seguía diciendo 199P, con su
    // línea de "a tu alcance" calculada sobre el número viejo.
    //
    // Se observa el PADRE y no el propio nodo del saldo: así da igual que el
    // sitio le reescriba el texto o que reemplace el elemento entero, y de paso
    // entra el nivel, que vive en el span de al lado y también puede cambiar.
    function watchPoints(schedule) {
        const node = document.querySelector(SEL.navPoints);
        if (!node) return;
        watchNode(node.parentElement || node, {
            childList: true, subtree: true, characterData: true,
        }, schedule);
    }

    function boot() {
        run();
        // El reloj de los avisos arranca ANTES del corte por tipo de página, y
        // a propósito: los avisos no son del listado, son del sitio. Con la
        // casilla puesta tienen que sonar igual estando en el foro o en los
        // ajustes, que es justo donde no te enterarías por tu cuenta.
        //
        // El tic del reloj va sin forzar —ahí sí manda el cuarto de hora—, pero
        // la revisión de la CARGA fuerza: acabas de llegar a esta página, así
        // que se llena el listado y se comprueba si apareció algo, sin importar
        // cuándo fue la última pasada.
        //
        // El reloj del bucle se siembra si no hubiera marca —primera vez con la
        // casilla puesta, o recién actualizado el script—: sin sembrarla vería
        // "hace una eternidad" en su primer tic y recorrería el listado otra vez
        // un minuto después de la pasada de la carga.
        if (alertsOn() && !recall(ALERT_CYCLE_KEY)) store(ALERT_CYCLE_KEY, String(Date.now()));
        setInterval(() => maybeScanForAlerts(false, true), ALERT_TICK_MS);
        maybeScanForAlerts(true);
        if (!isGiveawayPage()) return;
        if (isSinglePage()) return watchSingle();
        // El listado se repinta cuando otro script inserta filas (scroll
        // infinito de terceros). Se reprocesa con retardo para no correr una
        // vez por cada nodo insertado.
        const host = document.querySelector(SEL.row);
        const target = host && host.parentElement ? host.parentElement : document.body;
        const schedule = debounced(repaint, 200);
        watchNode(target, { childList: true }, schedule);
        watchPoints(schedule);
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
        const schedule = debounced(repaint, 200);
        targets.forEach(node => watchNode(node, {
            childList: true, subtree: true, characterData: true,
            attributes: true, attributeFilter: ['class'],
        }, schedule));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
