# 🎮 GAMES P2P - Arcade Multijugador WebRTC

Arcade multijugador retro 100% P2P (Peer-to-Peer a 120 Hz) sin servidor intermediario.

## 🌐 Jugar en Vivo
👉 **https://benjamin2134.github.io/GAMES_P2P_VIBECODING/**

---

## 🕹️ Catálogo de Juegos Disponibles
1. 🏓 **PONG:** Duelo clásico a 120 Hz con interpolación y retardo adaptativo.
2. 🎱 **BILLAR 8-BALL:** Física realista de bolas, troneras y línea de puntería.
3. 🚀 **SPACEWAR 1979:** Combate de naves espaciales vectoriales con inercia newtoniana.
4. ⚓ **BATTLESHIP:** Batalla naval 10x10 con niebla de guerra y radar de sonar.
5. 🏍️ **CYBER TRON:** Motos de luz en arena expandida (1000x600 px), giros en 90°, estelas y turbo boost.
6. 🎲 **MONOPOLY DUEL:** Duelo inmobiliario en tablero de 24 casillas, dados, compras, casas y bancarrota.

---

## 🛠️ Comandos de Desarrollo
```bash
# Correr tests unitarios sin navegador
node src/test.mjs

# Compilar GAMESP2P.html e index.html autocontenido
node src/build.mjs
```

---

## ⚙️ Configuración de Despliegue (GitHub Pages)
Para que el sitio se actualice automáticamente en cada push a `main`:
1. Ir a **Settings** $\rightarrow$ **Pages** en el repositorio.
2. En **Source**: seleccionar `Deploy from a branch`.
3. En **Branch**: seleccionar `main` y `/ (root)`.
4. Clic en **Save**.
