/* =========================================================
   CLIMA DO SANTUÁRIO
   A cada 3 horas de verdade sorteia o tempo (o mesmo sorteio
   para o mesmo horário, então não muda ao recarregar):
   - chuva: primavera 30% · verão 10% · outono 20%
   - outono: vento de folhas em 70% das vezes
   - inverno: neve em 70% das vezes
   A chuva rega as plantas da horta (até com o app fechado).
========================================================= */
export const SLOT_MS = 3 * 60 * 60 * 1000;
const RAIN = { primavera: 0.3, verao: 0.1, outono: 0.2, inverno: 0 };

// número "aleatório" fixo para cada horário
const hash = (n) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

export function weatherAt(ms, season) {
  const slot = Math.floor(ms / SLOT_MS);
  const r1 = hash(slot * 7 + 11);
  const r2 = hash(slot * 13 + 3);
  const snow = season === "inverno" && r1 < 0.7;
  return {
    slot,
    rain: !snow && r1 < (RAIN[season] || 0),
    snow,
    wind: season === "outono" && r2 < 0.7,
    from: slot * SLOT_MS,
    until: (slot + 1) * SLOT_MS
  };
}

/** Tempo (ms) com chuva entre a e b. */
export function rainIntervals(a, b, season) {
  const out = [];
  if (!(b > a)) return out;
  for (let s = Math.floor(a / SLOT_MS); s * SLOT_MS < b; s++) {
    const w = weatherAt(s * SLOT_MS, season);
    if (w.rain) out.push([Math.max(a, w.from), Math.min(b, w.until)]);
    if (out.length > 500) break;
  }
  return out;
}

export const WEATHER_TEXT = (w) => (w.rain ? "☔ Chuva" : w.snow ? "❄️ Neve" : w.wind ? "🍂 Vento de folhas" : "☀️ Tempo bom");
