import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/* La logica del juego vive dentro de index.html (la app es un solo archivo).
   En vez de duplicarla, la recortamos de ahi y la importamos como modulo:
   asi el test no se puede desincronizar del codigo que se publica. */
const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const desde = html.search(/^const N = \d+;/m);
const hasta = html.indexOf("const K_AJUSTES");
if (desde < 0 || hasta < 0) { console.error("No encontre la seccion de logica en index.html"); process.exit(1); }
const exporta = [
  "N", "TOT", "FLOTA", "CASCO_TOTAL", "nuevoTablero", "tramo", "cabe", "colocar",
  "quitarBarco", "rotarBarco", "desplegarAlAzar", "disparar", "flotaHundida",
  "cascoRestante", "iaElegir", "coord", "idx", "rc",
];
const modulo = html.slice(desde, hasta) + "\nexport {" + exporta.join(",") + "};\n";
const tmp = path.join(os.tmpdir(), "flota-logica-" + process.pid + ".mjs");
fs.writeFileSync(tmp, modulo);
const L = await import(pathToFileURL(tmp).href);
fs.unlinkSync(tmp);

/* El ladder de dificultad se mide sobre partidas al azar, y con 300 corridas
   los rangos de normal y dificil casi se tocan: el test daba falsos rojos. Se
   siembra el generador para que la medicion sea siempre la misma. */
function semilla(a){
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const azarReal = Math.random;
const conSemilla = (s, fn) => { Math.random = semilla(s); try { return fn(); } finally { Math.random = azarReal; } };

const N = L.N, TOT = L.TOT;
let fallos = 0;
const ok = (cond, msg) => { if (!cond) { console.log("  FALLA: " + msg); fallos++; } };
const seccion = (marca, titulo) => console.log(titulo.padEnd(32, ".") + " " + (fallos > marca ? "MAL" : "ok"));

console.log("tablero " + N + "x" + N + " · " + L.FLOTA.length + " barcos · " + L.CASCO_TOTAL + " de casco\n");

// --- 1. despliegue automatico, con y sin contacto ---
let m = fallos;
for (const contacto of [true, false]) {
  for (let n = 0; n < 400; n++) {
    const t = L.desplegarAlAzar(contacto);
    ok(t.barcos.length === L.FLOTA.length, "no puso todos los barcos (contacto=" + contacto + ")");
    ok(t.ocupa.filter(x => x !== -1).length === L.CASCO_TOTAL, "casillas ocupadas != " + L.CASCO_TOTAL);
    for (const b of t.barcos) {
      ok(b.celdas.length === b.def.largo, "largo mal en " + b.def.id);
      const filas = new Set(b.celdas.map(i => Math.floor(i / N)));
      const cols  = new Set(b.celdas.map(i => i % N));
      ok(filas.size === 1 || cols.size === 1, "barco torcido");
      const orden = [...b.celdas].sort((a, z) => a - z);
      const paso = b.horiz ? 1 : N;
      for (let k = 1; k < orden.length; k++) ok(orden[k] - orden[k-1] === paso, "barco cortado");
      // un barco horizontal no puede envolverse al renglon siguiente
      if (b.horiz) ok(cols.size === b.def.largo, "barco envuelto de fila");
    }
    if (!contacto) {
      let pegados = false;
      for (let i = 0; i < TOT && !pegados; i++) {
        const a = t.ocupa[i];
        if (a === -1) continue;
        const f = Math.floor(i / N), c = i % N;
        for (let df = -1; df <= 1; df++) for (let dc = -1; dc <= 1; dc++) {
          const ff = f + df, cc = c + dc;
          if (ff < 0 || ff >= N || cc < 0 || cc >= N) continue;
          const b = t.ocupa[ff * N + cc];
          if (b !== -1 && b !== a) pegados = true;
        }
      }
      ok(!pegados, "barcos pegados con contacto=false");
    }
  }
}
seccion(m, "1. despliegue automatico");

// --- 2. limites del tablero ---
m = fallos;
ok(L.tramo(N - 1, 2, true) === null, "el ultimo de la fila no puede llevar largo 2 horizontal");
ok(L.tramo(L.idx(N - 1, 0), 2, false) === null, "la ultima fila no puede llevar largo 2 vertical");
ok(L.tramo(N - 2, 2, true) !== null, "anteultimo de la fila deberia entrar horizontal");
ok(L.tramo(L.idx(N - 1, 0), 1, true) !== null, "la lancha deberia entrar en cualquier lado");
ok(L.tramo(L.idx(N - 1, N - 1), 1, false) !== null, "la lancha deberia entrar en la ultima casilla");
ok(L.coord(0) === "A1", "coord(0) deberia ser A1, dio " + L.coord(0));
ok(L.coord(TOT - 1) === "K" + N, "la ultima casilla deberia ser K" + N + ", dio " + L.coord(TOT - 1));
seccion(m, "2. limites del tablero");

// --- 3. disparos y hundimiento ---
m = fallos;
{
  const t = L.nuevoTablero();
  const destructor = L.FLOTA.find(d => d.largo === 2);
  L.colocar(t, destructor, [0, 1], true);
  ok(L.disparar(t, 5).agua === true, "deberia ser agua");
  ok(L.disparar(t, 5).repetido === true, "deberia detectar repetido");
  ok(L.disparar(t, 0).impacto === true, "primer impacto");
  const r = L.disparar(t, 1);
  ok(r.hundido && r.hundido.def === destructor, "deberia hundir el destructor");
  ok(L.flotaHundida(t) === true, "flota deberia estar hundida");
  ok(L.cascoRestante(t) === 0, "casco restante deberia ser 0");
}
{
  // la lancha se hunde de un solo tiro
  const t = L.nuevoTablero();
  const lancha = L.FLOTA.find(d => d.largo === 1);
  ok(lancha !== undefined, "deberia existir un barco de un solo casillero");
  L.colocar(t, lancha, [12], true);
  const r = L.disparar(t, 12);
  ok(r.hundido && r.hundido.def === lancha, "la lancha deberia hundirse de un tiro");
}
seccion(m, "3. disparos e hundimiento");

// --- 4. rotar en el lugar ---
m = fallos;
{
  const t = L.nuevoTablero();
  const crucero = L.FLOTA.find(d => d.largo === 3);
  L.colocar(t, crucero, L.tramo(L.idx(0, 0), 3, true), true);   // A1-C1 horizontal
  ok(L.rotarBarco(t, crucero.id, true) === "ok", "deberia poder rotar en el medio del mar");
  const b = t.barcos.find(x => x.def.id === crucero.id);
  ok(b.horiz === false, "deberia haber quedado vertical");
  ok(b.celdas.join() === [L.idx(0,0), L.idx(1,0), L.idx(2,0)].join(), "deberia rotar sobre la proa, dio " + b.celdas);
  ok(t.ocupa.filter(x => x !== -1).length === 3, "ocupa quedo inconsistente tras rotar");

  // contra el borde de abajo tiene que deslizarse para adentro, no fallar
  const t2 = L.nuevoTablero();
  L.colocar(t2, crucero, L.tramo(L.idx(N - 1, 0), 3, true), true);  // ultima fila
  ok(L.rotarBarco(t2, crucero.id, true) === "ok", "deberia deslizarse para entrar contra el borde");
  const b2 = t2.barcos.find(x => x.def.id === crucero.id);
  ok(b2.celdas.every(c => c >= 0 && c < TOT), "quedo fuera del tablero");
  ok(new Set(b2.celdas.map(c => c % N)).size === 1, "deberia haber quedado vertical");

  // si de verdad no entra, el barco tiene que quedar como estaba
  const t3 = L.nuevoTablero();
  const porta = L.FLOTA.find(d => d.largo === 5);
  L.colocar(t3, porta, L.tramo(L.idx(0, 0), 5, true), true);
  for (let f = 1; f < N; f++) L.colocar(t3, { id: "tapon" + f, nombre: "tapon", largo: 1 }, [L.idx(f, 0)], true);
  const antes = t3.barcos.find(x => x.def.id === porta.id).celdas.join();
  ok(L.rotarBarco(t3, porta.id, true) === "nocabe", "no deberia poder rotar con la columna tapada");
  ok(t3.barcos.find(x => x.def.id === porta.id).celdas.join() === antes, "tras fallar deberia quedar donde estaba");
  ok(t3.ocupa.filter(x => x !== -1).length === 5 + (N - 1), "ocupa quedo inconsistente tras un rotado fallido");

  // la lancha no tiene nada que rotar
  const t4 = L.nuevoTablero();
  const lancha = L.FLOTA.find(d => d.largo === 1);
  L.colocar(t4, lancha, [0], true);
  ok(L.rotarBarco(t4, lancha.id, true) === "unico", "la lancha no deberia rotar");
}
seccion(m, "4. rotar en el lugar");

// --- 5. las tres IAs terminan siempre, y en orden de fuerza ---
function partida(dif) {
  const t = L.desplegarAlAzar(true);
  let tiros = 0;
  while (!L.flotaHundida(t)) {
    const i = L.iaElegir(t, dif);
    if (i == null || i < 0 || i >= TOT) throw new Error(dif + ": la IA devolvio " + i);
    if (t.disparos[i] !== 0) throw new Error(dif + ": la IA repitio " + L.coord(i));
    L.disparar(t, i);
    if (++tiros > TOT) throw new Error(dif + ": no termino en " + TOT + " tiros");
  }
  return tiros;
}
m = fallos;
const prom = {};
for (const dif of ["facil", "normal", "dificil"]) {
  const corridas = 400;
  const { suma, peor } = conSemilla(20260906, () => {
    let suma = 0, peor = 0;
    for (let k = 0; k < corridas; k++) { const x = partida(dif); suma += x; peor = Math.max(peor, x); }
    return { suma, peor };
  });
  prom[dif] = suma / corridas;
  console.log("   " + dif.padEnd(8) + " promedio " + prom[dif].toFixed(1) + " tiros  (peor: " + peor + ")");
}
ok(prom.normal < prom.facil - 5, "normal deberia ser bastante mejor que facil");
ok(prom.dificil < prom.normal - 3, "dificil deberia ser mejor que normal");
// Con la lancha de un casillero en juego no hay estrategia que valga para el
// final: hay que barrer casilla por casilla hasta encontrarla, asi que el piso
// teorico sube mucho. El azar puro ronda TOT*0.95; pedimos bastante menos.
ok(prom.dificil < TOT * 0.72, "dificil deberia bajar del 72% del tablero");
ok(prom.facil - prom.dificil > 25, "dificil deberia sacarle mas de 25 tiros al azar");
seccion(m, "5. IA");

// --- 6. cabe() respeta la regla de contacto ---
m = fallos;
{
  const t = L.nuevoTablero();
  L.colocar(t, L.FLOTA.find(d => d.largo === 2), [0, 1], true);
  ok(L.cabe(t, [1, 2], true) === false, "se superpone, no deberia caber");
  ok(L.cabe(t, [2, 3], true) === true, "pegado deberia caber con contacto=true");
  ok(L.cabe(t, [2, 3], false) === false, "pegado NO deberia caber con contacto=false");
  ok(L.cabe(t, [3, 4], false) === true, "separado deberia caber con contacto=false");
  ok(L.cabe(t, [N + 2, N + 3], false) === false, "diagonal deberia bloquear con contacto=false");
}
seccion(m, "6. reglas de contacto");

// --- 7. quitar y reubicar deja el tablero consistente ---
m = fallos;
{
  const t = L.desplegarAlAzar(true);
  const crucero = L.FLOTA.find(d => d.largo === 3);
  L.quitarBarco(t, crucero.id);
  ok(t.barcos.length === L.FLOTA.length - 1, "deberia quedar un barco menos");
  ok(t.ocupa.filter(x => x !== -1).length === L.CASCO_TOTAL - 3, "casillas mal despues de quitar");
  t.barcos.forEach((b, k) => b.celdas.forEach(cel => ok(t.ocupa[cel] === k, "indice de ocupa desincronizado")));
}
seccion(m, "7. quitar y reindexar");

console.log("");
console.log(fallos ? ("=== " + fallos + " FALLAS ===") : "=== todo verde ===");
process.exit(fallos ? 1 : 0);
