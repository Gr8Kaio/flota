# Flota

Batalla naval para el teléfono. PWA sin dependencias: se instala desde Safari y se juega offline.

**En vivo:** https://gr8kaio.github.io/flota/

## Modos

- **Contra la máquina** — un jugador, con tres niveles de IA.
- **Pasando el teléfono** — dos jugadores en un solo dispositivo, con una pantalla de traspaso entre turnos para que nadie vea el tablero del otro.

Reglas clásicas: grilla de 10×10, cinco barcos (5·4·3·3·2 = 17 casillas de casco), un disparo por turno, acertar no da tiro extra. Gana quien hunde la flota entera primero.

## Instalar en el iPhone

1. Abrir el link en **Safari** (no Chrome: sólo Safari puede instalar PWAs en iOS).
2. Botón de compartir → **Agregar a inicio**.
3. Abre a pantalla completa, sin barra de navegador, y anda sin señal.

## La IA

Tres niveles, medidos sobre 300 partidas cada uno (`node test.mjs`):

| Nivel | Cómo juega | Tiros promedio |
|---|---|---|
| Fácil | tira a cualquier casilla libre | ~95 |
| Normal | dispara en damero hasta pegar, después remata alrededor y sigue la línea del barco | ~50 |
| Difícil | mapa de densidad: cuenta en cuántas posiciones válidas de los barcos que siguen vivos entra cada casilla, y pondera fuerte las que explican un impacto abierto | ~44 |

Para referencia, jugar perfecto ronda los 41-42 tiros y tirar 100% al azar da 95.

## Ajustes

- **Dificultad** de la máquina.
- **Barcos pegados** — si se apaga, la flota tiene que quedar separada por al menos una casilla (ni siquiera en diagonal).
- **Confirmar disparo** — el primer toque apunta y el segundo dispara. Encendido por defecto: en una grilla de 10×10 en pantalla de teléfono, el tiro accidental es el error más común.
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

Cubre despliegue automático (400 tableros por cada regla de contacto), límites de la grilla, disparos y hundimiento, las tres IAs jugando 300 partidas cada una hasta terminar, la regla de contacto y la reindexación al levantar un barco.

`test.mjs` no duplica la lógica: la recorta del propio `index.html` y la importa como módulo, así no se puede desincronizar de lo que se publica.

## Notas

- La versión está en la constante `VERSION` arriba del script, y también en el nombre del caché de `sw.js`. Hay que subir las dos juntas en cada push, si no el service worker sirve la versión vieja.
- El mar del tablero no cambia con el tema: se lee igual en claro y en oscuro.
