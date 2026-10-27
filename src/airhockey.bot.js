// ==========================================================================
//  Bot Universal: AIR HOCKEY (src/airhockey.bot.js)
//  Defiende delante de su arco siguiendo el disco; si el disco anda lento o
//  viene en su mitad, se pone detras y le pega apuntando al arco rival.
//  Reacciona con ~130 ms de retraso (ve el disco "de hace un rato").
// ==========================================================================
"use strict";

const AirHockeyBot = {
  nuevo() {
    const visto = [];       // historial del disco para el retraso de reaccion
    let meta = null, t = 0;
    return {
      step(v, api, dt) {
        if (!v || v.g) return;
        t += dt;
        visto.push({ t, x: v.d.x, y: v.d.y, vx: v.d.vx, vy: v.d.vy });
        while (visto.length > 2 && visto[1].t < t - 0.13) visto.shift();
        const d = visto[0];
        const yo = v.yo, m = yo === 1 ? v.m1 : v.m2;
        const miArco = yo === 1 ? HOC.X0 : HOC.X1, suArco = yo === 1 ? HOC.X1 : HOC.X0;
        const lado = yo === 1 ? 1 : -1;      // hacia donde ataca
        const enMiMitad = yo === 1 ? d.x < HOC.CX : d.x > HOC.CX;
        const viene = (suArco - miArco) * -d.vx > 0;   // se acerca a mi arco
        const lento = Math.hypot(d.vx, d.vy) < 380;
        if (enMiMitad && (lento || !viene || Math.abs(d.x - miArco) > 160)) {
          // ponerse detras del disco en la linea hacia el arco rival y empujar
          const gx = suArco, gy = HOC.CY + (Math.random() - 0.5) * 60;
          const ux = gx - d.x, uy = gy - d.y, ul = Math.hypot(ux, uy) || 1;
          const atras = { x: d.x - (ux / ul) * (HOC.R_MAZO + HOC.R_DISCO + 6), y: d.y - (uy / ul) * (HOC.R_MAZO + HOC.R_DISCO + 6) };
          const detras = (d.x - m.x) * lado > 8;
          meta = detras ? { x: d.x + (ux / ul) * 40, y: d.y + (uy / ul) * 40 } : atras;
          if (!detras && Math.abs(m.y - d.y) < 40) meta = { x: atras.x, y: m.y + (m.y < d.y ? -70 : 70) };
        } else {
          // defensa: delante del arco, alineado con el disco
          meta = { x: miArco + lado * 80, y: clamp(d.y, HOC.ARCO[0] - 20, HOC.ARCO[1] + 20) };
        }
        api.input(meta);
      },
    };
  },
};

if (typeof BOTS !== "undefined") BOTS.airhockey = AirHockeyBot;
