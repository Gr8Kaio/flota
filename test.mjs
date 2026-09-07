import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/* La logica del juego vive dentro de index.html (la app es un solo archivo).
   En vez de duplicarla, la recortamos de ahi y la importamos como modulo:
   asi el test no se puede desincronizar del codigo que se publica. */
const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const desde = html.indexOf("const N = 10;");
const hasta = html.indexOf("const K_AJUSTES");
if (desde < 0 || hasta < 0) { console.error("No encontre la seccion de logica en index.html"); process.exit(1); }
const exporta = [
  "N", "TOT", "FLOTA", "CASCO_TOTAL", "nuevoTablero", "tramo", "cabe", "colocar",
  "quitarBarco", "desplegarAlAzar", "disparar", "flotaHundida", "cascoRestante",
  "iaElegir", "coord", "idx", "rc",
];
const modulo = html.slice(desde, hasta) + "\nexport {" + exporta.join(",") + "};\n";
const tmp = path.join(os.tmpdir(), "flota-logica-" + process.pid + ".mjs");
fs.writeFileSync(tmp, modulo);
const L = await import(pathToFileURL(tmp).href);
fs.unlinkSync(tmp);

let fallos = 0;
const ok = (cond, msg) => { if(!cond){ console.log("  FALLA: " + msg); fallos++; } };

// --- 1. despliegue automatico, con y sin contacto ---
for (const contacto of [true, false]) {
  for (let n = 0; n < 400; n++) {
    const t = L.desplegarAlAzar(contacto);
    ok(t.barcos.length === 5, "no puso los 5 barcos (contacto=" + contacto + ")");
    const ocupadas = t.ocupa.filter(x => x !== -1).length;
    ok(ocupadas === L.CASCO_TOTAL, "casillas ocupadas " + ocupadas + " != 17");
    for (const b of t.barcos) {
      ok(b.celdas.length === b.def.largo, "largo mal en " + b.def.id);
      // contiguo y en linea
      const filas = new Set(b.celdas.map(i => Math.floor(i / 10)));
      const cols  = new Set(b.celdas.map(i => i % 10));
      ok(filas.size === 1 || cols.size === 1, "barco torcido");
      const orden = [...b.celdas].sort((a, z) => a - z);
      const paso = b.horiz ? 1 : 10;
      for (let k = 1; k < orden.length; k++) ok(orden[k] - orden[k-1] === paso, "barco cortado");
      // no cruza el borde derecho
      if (b.horiz) ok(cols.size === b.def.largo, "barco envuelto de fila");
    }
    if (!contacto) {
      // ningun par de barcos distintos se toca ni en diagonal
      for (let i = 0; i < 100; i++) {
        const a = t.ocupa[i];
        if (a === -1) continue;
        const f = Math.floor(i/10), c = i % 10;
        for (let df=-1; df<=1; df++) for (let dc=-1; dc<=1; dc++) {
          const ff=f+df, cc=c+dc;
          if (ff<0||ff>9||cc<0||cc>9) continue;
          const b = t.ocupa[ff*10+cc];
          if (b !== -1 && b !== a) { ok(false, "barcos pegados con contacto=false"); df=2; dc=2; i=100; }
        }
      }
    }
  }
}
console.log("1. despliegue automatico ..... " + (fallos ? "MAL" : "ok"));

// --- 2. tramo no envuelve filas ---
let f2 = fallos;
ok(L.tramo(9, 2, true) === null, "A10 horizontal largo 2 deberia ser null");
ok(L.tramo(95, 5, false) === null, "vertical fuera de rango deberia ser null");
ok(L.tramo(8, 2, true) !== null, "I1 horizontal largo 2 deberia entrar");
ok(L.tramo(90, 5, true) !== null, "fila 10 horizontal deberia entrar");
console.log("2. limites del tablero ....... " + (fallos > f2 ? "MAL" : "ok"));

// --- 3. disparos y hundimiento ---
f2 = fallos;
{
  const t = L.nuevoTablero();
  L.colocar(t, L.FLOTA[4], [0,1], true);           // destructor A1-B1
  ok(L.disparar(t, 5).agua === true, "deberia ser agua");
  ok(L.disparar(t, 5).repetido === true, "deberia detectar repetido");
  const r1 = L.disparar(t, 0);
  ok(r1.impacto === true && !r1.hundido, "primer impacto");
  const r2 = L.disparar(t, 1);
  ok(r2.hundido && r2.hundido.def.id === "destructor", "deberia hundir");
  ok(L.flotaHundida(t) === true, "flota deberia estar hundida");
  ok(L.cascoRestante(t) === 0, "casco restante deberia ser 0");
}
console.log("3. disparos e hundimiento .... " + (fallos > f2 ? "MAL" : "ok"));

// --- 4. las tres IAs terminan siempre, y en orden de fuerza ---
function partida(dif) {
  const t = L.desplegarAlAzar(true);
  let tiros = 0;
  while (!L.flotaHundida(t)) {
    const i = L.iaElegir(t, dif);
    if (i == null || i < 0 || i > 99) throw new Error(dif + ": la IA devolvio " + i);
    if (t.disparos[i] !== 0) throw new Error(dif + ": la IA repitio " + L.coord(i));
    L.disparar(t, i);
    if (++tiros > 100) throw new Error(dif + ": no termino en 100 tiros");
  }
  return tiros;
}
f2 = fallos;
const prom = {};
for (const dif of ["facil","normal","dificil"]) {
  let suma = 0, peor = 0;
  const N = 300;
  for (let k = 0; k < N; k++) { const x = partida(dif); suma += x; peor = Math.max(peor, x); }
  prom[dif] = suma / N;
  console.log("   " + dif.padEnd(8) + " promedio " + prom[dif].toFixed(1) + " tiros  (peor: " + peor + ")");
}
ok(prom.normal < prom.facil - 5, "normal deberia ser bastante mejor que facil");
ok(prom.dificil < prom.normal - 3, "dificil deberia ser mejor que normal");
ok(prom.dificil < 50, "dificil deberia bajar de 50 tiros promedio");
console.log("4. IA .......................  " + (fallos > f2 ? "MAL" : "ok"));

// --- 5. cabe() respeta la regla de contacto ---
f2 = fallos;
{
  const t = L.nuevoTablero();
  L.colocar(t, L.FLOTA[4], [0,1], true);           // A1-B1
  ok(L.cabe(t, [1,2], true) === false, "se superpone, no deberia caber");
  ok(L.cabe(t, [2,3], true) === true, "pegado deberia caber con contacto=true");
  ok(L.cabe(t, [2,3], false) === false, "pegado NO deberia caber con contacto=false");
  ok(L.cabe(t, [3,4], false) === true, "separado deberia caber con contacto=false");
  ok(L.cabe(t, [11,12], false) === false, "diagonal deberia bloquear con contacto=false");
}
console.log("5. reglas de contacto ........ " + (fallos > f2 ? "MAL" : "ok"));

// --- 6. quitar y reubicar deja el tablero consistente ---
f2 = fallos;
{
  const t = L.desplegarAlAzar(true);
  L.quitarBarco(t, "crucero");
  ok(t.barcos.length === 4, "deberia quedar 4 barcos");
  ok(t.ocupa.filter(x => x !== -1).length === L.CASCO_TOTAL - 3, "casillas mal despues de quitar");
  t.barcos.forEach((b, k) => b.celdas.forEach(cel => ok(t.ocupa[cel] === k, "indice de ocupa desincronizado")));
}
console.log("6. quitar y reindexar ........ " + (fallos > f2 ? "MAL" : "ok"));

console.log("");
console.log(fallos ? ("=== " + fallos + " FALLAS ===") : "=== todo verde ===");
process.exit(fallos ? 1 : 0);
