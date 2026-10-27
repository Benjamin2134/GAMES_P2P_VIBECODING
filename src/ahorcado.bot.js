// ==========================================================================
//  Bot Universal: AHORCADO (src/ahorcado.bot.js)
//  Al elegir: toma una de sus sugerencias. Al adivinar: filtra las palabras
//  de la lista que calzan con la mascara y las letras falladas, y pide la
//  letra mas frecuente entre ellas. A veces juega "a ojo" por frecuencia del
//  castellano (para que se le pueda ganar). Solo usa la mascara, nunca la palabra.
// ==========================================================================
"use strict";

const AhorcadoBot = (() => {
  const FREC = "EAOSRNILDTCUMPBGVYQHFZJÑXKW";
  function elegir(v) {
    if (v.fase === "elige") return { palabra: Kit.elegir(v.sugerencias) };
    if (v.fase !== "adivina") return null;
    const usadas = new Set(v.letras), falladas = v.letras.filter((l) => !v.mascara.includes(l));
    let orden = FREC.split("");
    if (Math.random() > 0.35) {
      const cand = AH.PALABRAS.filter((p) => p.length === v.largo &&
        p.split("").every((ch, k) => (v.mascara[k] === "_" ? !usadas.has(ch) : v.mascara[k] === ch)) &&
        !falladas.some((l) => p.includes(l)));
      if (cand.length) {
        const cuenta = {};
        for (const p of cand) for (const ch of new Set(p)) if (!usadas.has(ch)) cuenta[ch] = (cuenta[ch] || 0) + 1;
        orden = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a]);
      }
    }
    const l = orden.find((x) => !usadas.has(x)) || AH.LETRAS.split("").find((x) => !usadas.has(x));
    return l ? { letra: l } : null;
  }
  return Kit.botTurnos(elegir, { espera: [0.7, 1.3] });
})();

if (typeof BOTS !== "undefined") BOTS.ahorcado = AhorcadoBot;
