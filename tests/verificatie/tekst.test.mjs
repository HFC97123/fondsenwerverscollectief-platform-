// HTML -> leesbare tekst: wat bewijs mag zijn en wat niet. Geen netwerk.
import { extractReadableText, decodeEntiteiten } from '../../supabase/functions/_shared/readableText.ts';
import { check, gelijk, sectie, klaar, stand } from './hulp.mjs';

stand.naam = 'tekst';
const T = (h, ct) => extractReadableText(h, ct).text;
const NBSP = String.fromCharCode(0xa0);
const ZW = String.fromCharCode(0x200b);

sectie('1. Basis en structuur');
{
  gelijk('simpele pagina', T('<html><body><h1>Titel</h1><p>Eerste alinea.</p><p>Tweede alinea.</p></body></html>'), 'Titel\nEerste alinea.\nTweede alinea.');
  gelijk('geneste HTML', T('<div><section><article><p>Diep <b>vet <i>cursief</i></b> genest</p></article></section></div>'), 'Diep vet cursief genest');
  gelijk('inline elementen breken de zin niet', T('<p>Aanvragen kan tot <strong>12 november 2026</strong>.</p>'), 'Aanvragen kan tot 12 november 2026.');
  gelijk('br en lijst geven regels', T('<ul><li>een</li><li>twee</li></ul>a<br>b'), 'een\ntwee\na\nb');
  gelijk('tabelcellen krijgen een spatie', T('<table><tr><td>Deadline</td><td>12 november 2026</td></tr></table>'), 'Deadline 12 november 2026');
  gelijk('titel telt mee als zichtbare tekst', T('<html><head><title>Fonds A</title></head><body>x</body></html>'), 'Fonds A\nx');
  gelijk('ongesloten tags en losse < blijven leesbaar', T('<p>a < b en c > d<p>tweede'), 'a < b en c > d\ntweede');
  gelijk('tagnamen in hoofdletters', T('<DIV>Boven</DIV><SCRIPT>zichtbaar=1</SCRIPT><P>onder</P>'), 'Boven\nonder');
  gelijk('attribuutwaarde met > breekt de tag niet', T('<a title="a > b" href="x">link</a>'), 'link');
  gelijk('lege invoer / geen tekst', [T(''), T(null), T(undefined), T('<div></div>')], ['', '', '', '']);
  gelijk('text/plain wordt niet als HTML gelezen', T('<b>niet weghalen</b>  twee   spaties', 'text/plain; charset=utf-8'), '<b>niet weghalen</b> twee spaties');
}

sectie('2. Wat nooit als bewijs telt');
{
  gelijk('script met misleidende tekst', T('<p>Echt</p><script>document.write("Fonds A: deadline 1 januari 2030")</script><p>Einde</p>'), 'Echt\nEinde');
  gelijk('script met </p> en HTML in een string', T('<p>a</p><script>var x = "</p><b>valse deadline</b>";</script><p>b</p>'), 'a\nb');
  gelijk('script met sluittag in hoofdletters', T('<p>a</p><SCRIPT>geheim</SCRIPT><p>b</p>'), 'a\nb');
  gelijk('style met fondsnaam', T('<style>.fonds-a::before{content:"Fonds A deadline 1 januari 2030"}</style><p>Zichtbaar</p>'), 'Zichtbaar');
  gelijk('commentaar', T('<p>a</p><!-- Fonds A deadline 1 januari 2030 --><p>b</p>'), 'a\nb');
  gelijk('commentaar met > erin', T('<p>a</p><!-- a > b <script> --><p>b</p>'), 'a\nb');
  gelijk('onafgesloten commentaar: de rest valt weg (fail closed)', T('<p>a</p><!-- nooit gesloten <p>b</p>'), 'a');
  gelijk('conditional comment en CDATA', T('<p>a</p><![CDATA[ geheim ]]><!--[if IE]>x<![endif]--><p>b</p>'), 'a\nb');
  gelijk('noscript', T('<p>a</p><noscript>Zet JavaScript aan. Deadline 2030</noscript><p>b</p>'), 'a\nb');
  gelijk('template (ook genest)', T('<p>a</p><template><div>sjabloon<template>binnen</template>nog</div></template><p>b</p>'), 'a\nb');
  gelijk('svg met tekst', T('<p>a</p><svg><text>Fonds A</text><g><title>x</title></g></svg><p>b</p>'), 'a\nb');
  gelijk('iframe, object, canvas', T('<p>a</p><iframe>terugval</iframe><object>obj</object><canvas>cv</canvas><p>b</p>'), 'a\nb');
  gelijk('hidden-attribuut', T('<p>a</p><div hidden>Geheime deadline 1 januari 2030</div><p>b</p>'), 'a\nb');
  gelijk('aria-hidden', T('<p>a</p><div aria-hidden="true">verborgen</div><p>b</p>'), 'a\nb');
  gelijk('style display:none (met spaties en hoofdletters)', T('<p>a</p><div style="color:red; DISPLAY : NONE">verborgen</div><p>b</p>'), 'a\nb');
  gelijk('style visibility:hidden', T("<p>a</p><span style='visibility:hidden'>verborgen</span><p>b</p>"), 'a\nb');
  gelijk('verborgen element met geneste elementen van dezelfde soort', T('<p>a</p><div hidden><div>x</div><div>y</div></div><p>b</p>'), 'a\nb');
  gelijk('input type=hidden', T('<form><input type="hidden" value="Fonds A deadline"><p>zichtbaar</p></form>'), 'zichtbaar');
  gelijk('zichtbare aria-hidden=false blijft staan', T('<div aria-hidden="false">blijft</div>'), 'blijft');
  gelijk('een attribuut dat toevallig "hidden" in de waarde heeft blijft staan', T('<div class="hidden-nav-item" title="hidden">zichtbaar</div>'), 'zichtbaar');
  check('verborgen elementen worden geteld', extractReadableText('<div hidden>a</div><p aria-hidden="true">b</p>').verborgenElementen === 2);
  gelijk('hidden-element zonder sluittag: de rest valt weg (fail closed)', T('<p>a</p><div hidden>nooit gesloten<p>b</p>'), 'a');
}

sectie('3. Entiteiten, witruimte, onzichtbare tekens');
{
  gelijk('benoemde entiteiten', T('<p>Fonds &amp; Co &euro; 5.000 &ndash; &laquo;x&raquo; caf&eacute;</p>'), 'Fonds & Co € 5.000 – «x» café');
  gelijk('numerieke entiteiten (decimaal en hex)', T('<p>&#8364; &#x20AC; &#65;</p>'), '€ € A');
  gelijk('nbsp-entiteit wordt een spatie', T('<p>12&nbsp;november&nbsp;2026</p>'), '12 november 2026');
  check('NBSP-teken wordt een spatie', T('<p>12' + NBSP + 'november</p>') === '12 november');
  gelijk('onbekende entiteit blijft letterlijk', T('<p>&bestaatniet; &amp</p>'), '&bestaatniet; &amp');
  gelijk('ongeldig codepunt blijft letterlijk', T('<p>&#0; &#xD800; &#99999999;</p>'), '&#0; &#xD800; &#99999999;');
  gelijk('geen dubbele decodering', decodeEntiteiten('&amp;lt;b&amp;gt; &amp;amp;'), '&lt;b&gt; &amp;');
  gelijk('script-HTML uit entiteiten wordt GEEN tag', T('<p>&lt;script&gt;x&lt;/script&gt;</p>'), '<script>x</script>');
  gelijk('extra witruimte en regeleinden', T('<p>  veel \n\n\t  ruimte   hier  </p>\n\n\n<p>  tweede </p>'), 'veel\nruimte hier\ntweede');
  check('zero-width tekens verdwijnen (geen verborgen fondsnaam)', T('<p>Fo' + ZW + 'nds' + String.fromCharCode(0xad) + ' A</p>') === 'Fonds A');
  check('BOM en bidi-tekens verdwijnen', T(String.fromCharCode(0xfeff) + '<p>a' + String.fromCharCode(0x202e) + 'b</p>') === 'ab');
}

sectie('4. Robuustheid en grenzen');
{
  const lang = '<p>' + 'a'.repeat(900_000) + '</p>';
  const r = extractReadableText(lang);
  check('uitvoer wordt begrensd en gemarkeerd', r.text.length <= 600_000 && r.truncated === true);
  check('onafgesloten tag aan het eind crasht niet', T('<p>a</p><div class="x') !== undefined);
  check('absurd lange attribuutlijst crasht niet', T('<div ' + 'a="b" '.repeat(5000) + '>tekst</div>') !== undefined);
  check('10.000 losse < tekens (backtracking-test) blijft lineair', (() => { const t0 = Date.now(); T('<'.repeat(10_000) + 'x'); return Date.now() - t0 < 500; })());
  check('diep genest hidden-element (20.000 divs) blijft lineair', (() => { const t0 = Date.now(); T('<div hidden>' + '<div>'.repeat(20_000) + 'x' + '</div>'.repeat(20_000) + '</div>ok'); return Date.now() - t0 < 1500; })());
  check('"<a <a <a ..." (300.000 ongesloten tags, kwadratisch-risico) blijft lineair en geeft geen bewijs', (() => { const t0 = Date.now(); const r = extractReadableText('<p>voor</p>' + '<a '.repeat(300_000)); return Date.now() - t0 < 1500 && r.text.startsWith('voor'); })());
  check('quote-val (<a " ... ) blijft lineair', (() => { const t0 = Date.now(); extractReadableText('<a "' + '<b>x</b>'.repeat(100_000)); return Date.now() - t0 < 1500; })());
  gelijk('niet-tekst invoer', [T(42), T({}), T([])], ['', '', '']);
}

klaar('TEKST');
