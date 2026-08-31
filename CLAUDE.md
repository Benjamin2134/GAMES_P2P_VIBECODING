# CLAUDE.md

Para Claude Code / agentes de IA en este repo:

- Leé y seguí `AGENTS.md` (estructura, contrato de módulo, flujo de Git).
- **No edites `GAMESP2P.html` a mano** — es generado. Todos los cambios van en `src/`.
- Antes de commitear: `node src/test.mjs` y `node src/build.mjs`.
- Commiteá `src/` y `GAMESP2P.html` juntos.
- **No mostrar en pantalla estadísticas de red/debug** (FPS, RTT, jitter, "conexión directa/relay"). El único HUD visible permitido es el del propio juego (marcador, vidas, turno).
