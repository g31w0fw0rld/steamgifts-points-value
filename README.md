# SteamGifts Points Value

Tampermonkey userscript that works out the real odds of every SteamGifts giveaway and what they cost you in points. / Userscript de Tampermonkey que calcula la probabilidad real de cada sorteo de SteamGifts y lo que te cuesta en puntos.

## English

### What it does

SteamGifts shows you how many people entered a giveaway, but never how likely you are to win it. A giveaway with **100 copies and 1,501 entries** and one with **1 copy and 1,020 entries** look the same on the listing, and they are not: the first is 1 in 15, the second 1 in 1,020. This script does that arithmetic for you, on every row:

- **Real odds** — copies divided by entries, written as `1 in 15`. Copies are the number that matters and the listing only prints them when there is more than one, so a row without that label is a single copy.
- **Value per point** — those odds against what the giveaway costs, as `0.44%/P`: how much of a chance each point buys. This is the number that tells you where a 400-point balance is worth spending, and no page on the site shows it.
- **Sort by value** — one button reorders the listing best-first. Press it again for the site's own order; the choice is remembered. Featured giveaways stay in their own section, untouched.
- **A summary line** — how many giveaways are on the page and how many your current balance can still cover.

Details worth knowing:

- **It filters nothing.** Hiding giveaways above your level, games you already own, or ones you have already entered is done by SteamGifts itself, server-side, in *Account → Settings → Giveaways*. Doing it again here would be slower and worse, so the script leaves it alone and only marks the ones your level cannot reach, dimmed.
- **A giveaway with no entries yet reads as certain**, not as a division by zero: the next entry takes a copy.
- **Values below 0.01% show as `<0.01`** rather than rounding down to a `0` that would be indistinguishable from a giveaway that costs nothing.
- **Sorting is manual.** The script does not reorder anything until you ask it to, so the page you land on is the page the site meant to give you.

**Language:** English and Spanish, chosen from your browser's languages. SteamGifts pins `<html lang="en">` for everyone because its interface only exists in English, so the document's own language would be useless here.

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
- **Una línea de resumen** —cuántos sorteos hay en la página y a cuántos te alcanza el saldo actual—.

Detalles que conviene saber:

- **No filtra nada.** Ocultar los sorteos por encima de tu nivel, los juegos que ya tienes o aquellos en los que ya entraste lo hace el propio SteamGifts, del lado del servidor, en *Account → Settings → Giveaways*. Repetirlo aquí sería más lento y peor, así que el script no se mete: solo marca en gris los que tu nivel no alcanza.
- **Un sorteo sin entradas todavía se lee como seguro**, no como una división por cero: la siguiente entrada se lleva una copia.
- **Los valores por debajo del 0,01 % se muestran como `<0,01`** en vez de redondearse a un `0` que no se distinguiría de un sorteo que no cuesta puntos.
- **La ordenación es manual.** El script no mueve nada hasta que se lo pides, así que la página que abres es la que el sitio quiso darte.

**Idioma:** inglés y español, según los idiomas de tu navegador. SteamGifts fija `<html lang="en">` para todo el mundo porque su interfaz solo existe en inglés, así que el idioma del documento no serviría de nada aquí.

**Instalación:**
1. Instala [Tampermonkey](https://www.tampermonkey.net/).
2. Abre el instalador: [steamgifts-points-value.user.js](https://github.com/g31w0fw0rld/steamgifts-points-value/raw/main/steamgifts-points-value.user.js) (también en [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) y [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Sitios:** `www.steamgifts.com/*`

## Privacy / Privacidad

**EN:** the script sends nothing to third parties or to the author, and makes no network request of any kind. Everything it shows is arithmetic on what the listing page already printed: copies, entries, point cost and the level column. It declares `@grant none`, so it has no access to the userscript manager's privileged APIs. The only thing it stores is whether you left the listing sorted by value, kept in `localStorage` on your own machine. It reads your points balance from the site's own header to tell you what you can afford, and that number never leaves the page.

**ES:** el script no envía nada a terceros ni al autor, y no hace ninguna petición de red. Todo lo que muestra son cuentas sobre lo que la página del listado ya había impreso: copias, entradas, coste en puntos y la columna de nivel. Declara `@grant none`, así que no tiene acceso a las APIs privilegiadas del gestor de userscripts. Lo único que guarda es si dejaste el listado ordenado por valor, en el `localStorage` de tu propia máquina. Lee tu saldo de puntos de la cabecera del propio sitio para decirte a cuánto te alcanza, y ese número no sale de la página.

## Support / Apoyar

This is part of something I'm building to grow. If it helps you and you'd like to support it, you can tip me on **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —only if you want—; and if a cause needs it more than I do, help that one instead.

Esto es parte de algo que estoy construyendo para crecer. Si te sirve y quieres apoyar, puedes invitarme un café en **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —solo si quieres—; y si hay una causa que lo necesite más que yo, ayúdala a ella.

---
Author / Autor: **g31w0fw0rld** · License / Licencia: **MIT**
