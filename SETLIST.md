# Setlist de juegos nuevos

Lista viva: lo que se propone se agrega aquí. Cada juego sigue el contrato de `AGENTS.md`
(`src/<juego>.sim.js`, `.bot.js`, `.js`) y lleva tests.

**Estado: los 28 están hechos** sobre el kit (`src/kit.js` + `src/kit.ui.js`), en la rama
`feature/setlist-28`. Todos pasan sus tests de reglas y una partida completa bot contra bot.
Decisiones de reglas tomadas sin consultar (revisables): Damas sin "ley de cantidad"; Dudo a 2
jugadores con calzo siempre permitido; Generala servida gana en el acto; Dominó a 50 puntos;
Tanques y Sumo con muerte súbita para que toda ronda termine.

## Ronda 1 (prioridad)
| # | Juego | Modo | Idea | Bot |
|---|---|---|---|---|
| 1 | Conecta 4 | Turnos | Tablero 7×6, fichas que caen, destello de la línea ganadora | Sí |
| 2 | Air Hockey | Tiempo real | Disco y mazos con inercia, primero a 7 | Sí |
| 3 | Snake Duelo | Tiempo real | Dos serpientes en una arena, comida y manzana dorada de turbo | Sí |
| 4 | Artillería | Turnos | Cañones sobre terreno destructible, ángulo, potencia y viento | Sí |
| 5 | Tetris Versus | Tiempo real | Un tablero por jugador, las líneas mandan basura al rival | Sí |

## Ronda 2
| # | Juego | Modo | Idea | Bot |
|---|---|---|---|---|
| 6 | Pac-Duelo | Tiempo real | Comecocos contra fantasma en un laberinto, roles que se invierten | Sí |
| 7 | Bomberman Duelo | Tiempo real | Arena con bloques, bombas con mecha y power-ups | Sí |
| 8 | Tanques | Tiempo real | Vista cenital, balas que rebotan, minas | Sí |
| 9 | Reversi | Turnos | Tablero 8×8 donde se voltean fichas | Sí |
| 10 | Damas | Turnos | Capturas obligatorias, coronación, saltos múltiples | Sí |
| 11 | Ajedrez | Turnos | El clásico completo (enroque, jaque, al paso) | Sí, costoso |
| 12 | Tres en Raya Ultimate | Turnos | 3×3 de tableros 3×3, donde juegas decide dónde juega el rival | Sí |
| 13 | Memorice | Turnos | Pares de cartas, tablero sincronizado por el host | Sí |
| 14 | Sumo | Tiempo real | Dos bolas en un plato que se achica, embestidas | Sí |
| 15 | Carrera | Tiempo real | Pista cenital con vueltas, derrapes y fantasma de la mejor vuelta | Sí |
| 16 | Duelo de Reflejos | Tiempo real | Rondas cortas, gana el primero en pulsar tras la señal | Sí |
| 17 | Ahorcado | Por rondas | Uno elige la palabra, el otro adivina | No |

## Ronda 3
| # | Juego | Modo | Idea | Bot |
|---|---|---|---|---|
| 18 | Breakout Versus | Tiempo real | Dos paletas, una pelota y ladrillos compartidos | Sí |
| 19 | Fútbol de Autos | Tiempo real | Fútbol 2D con autos, saltos y turbo | Sí |
| 20 | Gomoku | Turnos | Cinco en línea en tablero grande | Sí |
| 21 | Dominó | Turnos | Fichas en mano ocultas, el host reparte | Sí, sin ver la mano rival |
| 22 | Dudo (Cacho) | Turnos | Dados ocultos bajo el vaso, se apuesta y se dice "dudo" | Sí |
| 23 | Mancala | Turnos | Siembra de semillas con capturas y turno extra | Sí |
| 24 | Invasores Versus | Tiempo real | Naves enemigas compartidas, gana quien destruye más | Sí |
| 25 | Minigolf | Turnos | Hoyos con obstáculos, golpes alternados con la física de Billar | Sí |
| 26 | Curling | Turnos | Piedras que se lanzan y se empujan sobre la diana | Sí |
| 27 | Generala | Turnos | Dados con combinaciones y planilla de puntos | Sí |
| 28 | Pinturillo | Por rondas | Uno dibuja una palabra, el otro la adivina; los roles alternan, con temporizador y puntos por rapidez. Requiere lista de palabras en español y campo de respuesta | No |
