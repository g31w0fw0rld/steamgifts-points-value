# SteamGifts Points Value

Tampermonkey userscript that works out the real odds of every SteamGifts giveaway and what they cost you in points. / Userscript de Tampermonkey que calcula la probabilidad real de cada sorteo de SteamGifts y lo que te cuesta en puntos.

## English

### What it does

SteamGifts shows you how many people entered a giveaway, but never how likely you are to win it. A giveaway with **100 copies and 1,501 entries** and one with **1 copy and 1,020 entries** look the same on the listing, and they are not: the first is 1 in 15, the second 1 in 1,020. This script does that arithmetic for you, on every row:

- **Real odds** — copies divided by entries, written as `1 in 15`. Copies are the number that matters and the listing only prints them when there is more than one, so a row without that label is a single copy.
- **Value per point** — those odds against what the giveaway costs, as `0.44%/P`: how much of a chance each point buys. This is the number that tells you where a 400-point balance is worth spending, and no page on the site shows it.
- **Sort by value** — one button reorders the listing best-first. Press it again for the site's own order; the choice is remembered. Featured giveaways stay in their own section, untouched.
- **A widget** — your points balance in a size you can actually read, warning you in amber when you are sitting at the 400P cap and every point handed out is being lost; your level and what it would take to reach the next one; how many giveaways are within reach; the best value on the page; the sort button; and the language picker.

Details worth knowing:

- **It filters nothing**, and it assumes a setup. Hiding giveaways above your level, games you already own, DLC without the base game, ones you have already entered or games you filtered by hand is done by SteamGifts itself, server-side, in *Account → Settings → Giveaways* — faster and better than any script could. **Set 2, 3, 4, 5 and 6 to Yes**, leave 1 on *All* and 7 to taste. Without that, half the listing can be giveaways you cannot enter, they dilute the colour ranking, and rows your level cannot reach show up dimmed instead of not showing up at all.
- **A giveaway with no entries yet reads as certain**, not as a division by zero: the next entry takes a copy.
- **Values below 0.01% show as `<0.01`** rather than rounding down to a `0` that would be indistinguishable from a giveaway that costs nothing.
- **Sorting is manual.** The script does not reorder anything until you ask it to, so the page you land on is the page the site meant to give you.
- **Empty gaps, off by default.** SteamGifts slots its own bundle banners between the rows, one every thirteen or so. If a blocker empties one, the container keeps its reserved height and leaves a ~200px hole in the middle of the listing — that hole is the site's, not this script's. A checkbox in the widget folds away **only** the blocks showing nothing at all: a banner that does load is left alone, and one that loads late comes straight back.

**Language:** English and Spanish only — the site itself exists in one language, so there is no point going further. Picked from your browser's languages, and overridable from the widget. SteamGifts pins `<html lang="en">` for everyone because its interface only exists in English, so the document's own language would be useless here.

**Install:**
1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open the installer: [steamgifts-points-value.user.js](https://github.com/g31w0fw0rld/steamgifts-points-value/raw/main/steamgifts-points-value.user.js) (also on [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) and [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Sites:** `www.steamgifts.com/*`

## Español

### Qué hace

SteamGifts te dice cuánta gente entró en un sorteo, pero nunca qué probabilidad tienes de ganarlo. Un sorteo con **100 copias y 1.501 entradas** y otro con **1 copia y 1.020 entradas** se ven igual en el listado, y no lo son: el primero es 1 de 15 y el segundo 1 de 1.020. El script hace esa cuenta por ti, en cada fila:

- **Probabilidad real** —copias entre entradas, escrito como `1 de 15`—. Las copias son el número que importa y el listado solo las imprime cuando hay más de una, así que una fila sin esa etiqueta es de copia única.
- **Valor por punto** —esa probabilidad frente a lo que cuesta el sorteo, como `0,44 %/P`: cuánta posibilidad compra cada punto—. Es el número que dice dónde conviene gastar un saldo de 400 puntos, y no aparece en ninguna página del sitio.
- **Ordenar por valor** —un botón reordena el listado de mejor a peor; púlsalo otra vez para volver al orden del sitio, y la preferencia se recuerda—. Los sorteos destacados se quedan en su propia sección, sin tocar.
- **Un widget** —tu saldo de puntos en un tamaño que se lee de un vistazo, en ámbar cuando estás en el tope de 400P y cada punto repartido se está perdiendo; tu nivel y lo que falta para el siguiente; a cuántos sorteos te alcanza; el mejor valor de la página; el botón de ordenar; y el selector de idioma—.

Detalles que conviene saber:

- **No filtra nada**, y da por supuesta una configuración. Ocultar los sorteos por encima de tu nivel, los juegos que ya tienes, los DLC sin el juego base, aquellos en los que ya entraste o los juegos que filtraste a mano lo hace el propio SteamGifts, del lado del servidor, en *Account → Settings → Giveaways*, más rápido y mejor de lo que podría cualquier script. **Pon el 2, el 3, el 4, el 5 y el 6 en Yes**, deja el 1 en *All* y el 7 a tu gusto. Sin eso, media página pueden ser sorteos en los que no puedes entrar, diluyen el reparto de colores, y las filas que tu nivel no alcanza aparecen en gris en vez de no aparecer.
- **Un sorteo sin entradas todavía se lee como seguro**, no como una división por cero: la siguiente entrada se lleva una copia.
- **Los valores por debajo del 0,01 % se muestran como `<0,01`** en vez de redondearse a un `0` que no se distinguiría de un sorteo que no cuesta puntos.
- **La ordenación es manual.** El script no mueve nada hasta que se lo pides, así que la página que abres es la que el sitio quiso darte.
- **Huecos vacíos, apagado por defecto.** SteamGifts intercala entre las filas sus propios banners de bundles, uno cada trece más o menos. Si un bloqueador vacía alguno, el contenedor conserva la altura reservada y deja un hueco de unos 200 px en mitad del listado —ese hueco es del sitio, no de este script—. Una casilla del widget pliega **solo** los bloques que no muestran absolutamente nada: un banner que sí carga se queda como está, y uno que carga tarde vuelve solo.

**Idioma:** solo inglés y español —el propio sitio existe en un solo idioma, así que no tiene sentido ir más allá—. Se elige por los idiomas de tu navegador y se puede forzar desde el widget. SteamGifts fija `<html lang="en">` para todo el mundo porque su interfaz solo existe en inglés, así que el idioma del documento no serviría de nada aquí.

**Instalación:**
1. Instala [Tampermonkey](https://www.tampermonkey.net/).
2. Abre el instalador: [steamgifts-points-value.user.js](https://github.com/g31w0fw0rld/steamgifts-points-value/raw/main/steamgifts-points-value.user.js) (también en [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) y [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Sitios:** `www.steamgifts.com/*`

## Privacy / Privacidad

**EN:** the script sends nothing to third parties or to the author, and makes no network request of any kind. Everything it shows is arithmetic on what the listing page already printed: copies, entries, point cost and the level column. It declares `@grant none`, so it has no access to the userscript manager's privileged APIs. The only things it stores are whether you left the listing sorted by value, whether the widget is minimised and the language you picked, all kept in `localStorage` on your own machine. It reads your points balance from the site's own header to tell you what you can afford, and that number never leaves the page.

**ES:** el script no envía nada a terceros ni al autor, y no hace ninguna petición de red. Todo lo que muestra son cuentas sobre lo que la página del listado ya había impreso: copias, entradas, coste en puntos y la columna de nivel. Declara `@grant none`, así que no tiene acceso a las APIs privilegiadas del gestor de userscripts. Lo único que guarda es si dejaste el listado ordenado por valor, si el widget está minimizado y el idioma que elegiste, todo en el `localStorage` de tu propia máquina. Lee tu saldo de puntos de la cabecera del propio sitio para decirte a cuánto te alcanza, y ese número no sale de la página.

## Support / Apoyar

This is part of something I'm building to grow. If it helps you and you'd like to support it, you can tip me on **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —only if you want—; and if a cause needs it more than I do, help that one instead.

Esto es parte de algo que estoy construyendo para crecer. Si te sirve y quieres apoyar, puedes invitarme un café en **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —solo si quieres—; y si hay una causa que lo necesite más que yo, ayúdala a ella.

---
Author / Autor: **g31w0fw0rld** · License / Licencia: **MIT**
