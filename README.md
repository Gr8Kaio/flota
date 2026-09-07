# Flota

Batalla naval para el teléfono. PWA sin dependencias: se instala desde Safari y se juega offline.

**En vivo:** https://gr8kaio.github.io/flota/

## Modos

- **Contra la máquina** — un jugador, con tres niveles de IA.
- **Pasando el teléfono** — dos jugadores en un solo dispositivo, con una pantalla de traspaso entre turnos para que nadie vea el tablero del otro.

Reglas clásicas sobre una grilla de 11×11: seis barcos (5·4·3·3·2·1 = 18 casillas de casco), un disparo por turno, acertar no da tiro extra. Gana quien hunde la flota entera primero.

| Barco | Casillas |
|---|---|
| Portaaviones | 5 |
| Acorazado | 4 |
| Crucero | 3 |
| Submarino | 3 |
| Destructor | 2 |
| Lancha | 1 |

La lancha de un solo casillero alarga bastante el final de la partida: no hay estrategia que valga para encontrarla, hay que barrer casillero por casillero. Es a propósito, pero se nota en los promedios de abajo.

## Instalar en el iPhone

1. Abrir el link en **Safari** (no Chrome: sólo Safari puede instalar PWAs en iOS).
2. Botón de compartir → **Agregar a inicio**.
3. Abre a pantalla completa, sin barra de navegador, y anda sin señal.

## La IA

Tres niveles, medidos sobre 400 partidas cada uno (`node test.mjs`):

| Nivel | Cómo juega | Tiros promedio |
|---|---|---|
| Fácil | tira a cualquier casilla libre | ~116 |
| Normal | barre en damero de paso igual al barco vivo más chico, y al pegar remata alrededor y sigue la línea | ~80 |
| Difícil | mapa de densidad: cuenta en cuántas posiciones válidas de los barcos que siguen vivos entra cada casilla, pondera fuerte las que explican un impacto abierto, y desempata al azar | ~75 |

Sobre 121 casillas. El techo lo pone la lancha: mientras siga viva no hay nada mejor que buscarla casilla por casilla, así que los tres niveles quedan más juntos de lo que estarían sin ella.

## Ajustes

- **Dificultad** de la máquina.
- **Barcos pegados** — si se apaga, la flota tiene que quedar separada por al menos una casilla (ni siquiera en diagonal).
- **Confirmar disparo** — el primer toque apunta y el segundo dispara. Encendido por defecto: en una grilla de 11×11 en pantalla de teléfono, el tiro accidental es el error más común.
- **Nombres** de los dos jugadores.
- **Tema** auto / claro / oscuro.

La partida en curso, los ajustes y las estadísticas se guardan en `localStorage`; si cerrás la app a mitad de una batalla, el menú ofrece **Continuar**.

## Estructura

Un solo archivo, como Marginalia:

```
index.html          la app entera (modelo, IA, UI y estilos)
sw.js               service worker, para que abra sin señal
apple-touch-icon.png
test.mjs            tests de la lógica
```

`index.html` está dividido en secciones comentadas: **Modelo** (tablero, barcos, disparos), **IA**, **Persistencia**, **Estado de la partida**, **UI**, **Colocación**, **Juego** y **Eventos**.

## Tests

```
node test.mjs
```

Cubre despliegue automático (400 tableros por cada regla de contacto), límites de la grilla, disparos y hundimiento, el giro en el lugar (incluido el deslizamiento contra el borde y el caso en que no entra), las tres IAs jugando 400 partidas cada una hasta terminar, la regla de contacto y la reindexación al levantar un barco.

El *ladder* de dificultad se mide con el generador de azar sembrado: con partidas al azar los rangos de normal y difícil casi se tocan y el test daba rojos falsos.

`test.mjs` no duplica la lógica: la recorta del propio `index.html` y la importa como módulo, así no se puede desincronizar de lo que se publica.

## Cómo se colocan los barcos

Todo con un dedo, sin arrastrar:

- **Ubicar** — elegís el barco en la lista y tocás el mar donde va la proa.
- **Girar** — tocás un barco que ya está en el agua y gira ahí mismo, entre horizontal y vertical. Pivota sobre la proa y, si el borde no lo deja, se desliza solo hasta encontrar lugar; si de verdad no entra, queda como estaba y lo dice. También sirve el botón ↻ de arriba, y volver a tocar la fila del barco seleccionado en la lista.
- **Mover** — lo seleccionás en la lista y tocás el mar en otro lado.
- **Al azar** — resuelve la flota entera.

Los barcos se dibujan como siluetas continuas en una capa SVG por encima de la grilla, no casillero por casillero: por eso un portaaviones se ve como un portaaviones y no como cinco cuadrados. El arte se escribe una sola vez, siempre acostado y con la proa a la derecha; los verticales salen girando el grupo y dando vuelta el `viewBox`. Cada impacto abre un boquete sobre el propio dibujo, y los hundidos pasan a una paleta quemada.

## Notas

- La versión está en la constante `VERSION` arriba del script, y también en el nombre del caché de `sw.js`. Hay que subir las dos juntas en cada push, si no el service worker sirve la versión vieja. En el menú se muestra como chip debajo del logo, así se ve de una si el teléfono quedó con una versión cacheada.
- El tamaño del tablero sale de la constante `N` y nada más: la grilla CSS lo toma por la variable `--n` y las letras de las columnas salen de `LETRAS`. Para cambiarlo alcanza con tocar `N` (y que `LETRAS` tenga suficientes).
- Los barcos se ubican midiendo las celdas en píxeles, así que hay que pintar con la pantalla ya visible: si se pinta oculta, todo mide cero y la capa sale vacía. Un `ResizeObserver` los reacomoda si cambia el tamaño.
- El mar del tablero no cambia con el tema: se lee igual en claro y en oscuro.
