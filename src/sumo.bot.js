// ==========================================================================
//  Bot Universal: SUMO (src/sumo.bot.js)
//  Se ubica entre el centro y el rival para empujarlo hacia afuera y embiste
//  cuando queda alineado. Si se acerca al borde, vuelve al centro.
//  Ve la posicion del rival con ~120 ms de retraso.
// ==========================================================================
"use strict";

const SumoBot = {
  nuevo() {
    const hist = [];
    let t = 0, cdAccion = 0;
    const retraso = Kit.rnd(0.1, 0.18);
    return {
      step(v, api, dt) {
        if (!v || v.g || v.fase !== "juego") return;
        t += dt; cdAccion -= dt;
        const yo = v.yo === 1 ? v.b1 : v.b2, riv = v.yo === 1 ? v.b2 : v.b1;
        hist.push({ t, x: riv.x, y: riv.y });
        while (hist.length > 2 && hist[1].t < t - retraso) hist.shift();
        const o = hist[0];
        const dc = Math.hypot(yo.x - SU.CX, yo.y - SU.CY);
        let tx, ty;
        if (dc > v.radio - 70) { tx = SU.CX; ty = SU.CY; }
        else {
          const ux = o.x - SU.CX, uy = o.y - SU.CY, ul = Math.hypot(ux, uy) || 1;
          tx = o.x - (ux / ul) * SU.R * 1.6; ty = o.y - (uy / ul) * SU.R * 1.6;
          // ya esta detras: empujar hacia el rival
          const detras = (yo.x - SU.CX) * ux + (yo.y - SU.CY) * uy < ul * (ul - SU.R * 1.2);
          if (detras && Math.hypot(o.x - yo.x, o.y - yo.y) < 150) { tx = o.x; ty = o.y; if (yo.cd <= 0 && cdAccion <= 0 && Math.random() < 0.08) { api.accion({ dash: 1 }); cdAccion = 0.5; } }
        }
        const dx = tx - yo.x, dy = ty - yo.y, l = Math.hypot(dx, dy) || 1;
        api.input({ ax: dx / l, ay: dy / l });
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.sumo = SumoBot;
