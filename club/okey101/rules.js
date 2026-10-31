export const COLORS = ["red", "blue", "black", "yellow"];
export const COLOR_NAMES = {
  red: "Kırmızı",
  blue: "Mavi",
  black: "Siyah",
  yellow: "Sarı",
};

export function nextFace(face) {
  return { color: face.color, num: face.num === 13 ? 1 : face.num + 1 };
}

export function sameFace(a, b) {
  return a.color === b.color && a.num === b.num;
}

export function createTileSet() {
  const tiles = [];
  for (const color of COLORS) {
    for (let num = 1; num <= 13; num += 1) {
      for (let copy = 0; copy < 2; copy += 1) {
        tiles.push({ id: `${color}-${num}-${copy}`, kind: "normal", color, num });
      }
    }
  }
  tiles.push({ id: "fake-joker-0", kind: "fake-joker" });
  tiles.push({ id: "fake-joker-1", kind: "fake-joker" });
  return tiles;
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function jokerFace(indicator) {
  return nextFace(indicator);
}

export function isWild(tile, indicator) {
  if (tile.kind !== "normal") return false;
  return sameFace(tile, jokerFace(indicator));
}

// Sahte okey, joker taşının yüzünü taşır ama joker gibi her taşın yerine geçmez.
export function faceOf(tile, indicator) {
  return tile.kind === "fake-joker" ? jokerFace(indicator) : { color: tile.color, num: tile.num };
}

export function tilePoints(tile, indicator) {
  if (isWild(tile, indicator)) return 25;
  return faceOf(tile, indicator).num;
}

export function validateMeld(tiles, indicator) {
  if (!Array.isArray(tiles) || tiles.length < 3 || tiles.length > 13) {
    return { valid: false, reason: "Bir per en az 3 taş içermelidir." };
  }

  const wilds = tiles.filter((tile) => isWild(tile, indicator));
  const naturals = tiles.filter((tile) => !isWild(tile, indicator));
  const possibilities = [];

  // Aynı renk, artan ardışık seri; 13'ten sonra 1'e dönülmez.
  for (const color of COLORS) {
    const maxStart = 13 - tiles.length + 1;
    for (let start = 1; start <= maxStart; start += 1) {
      const expected = Array.from({ length: tiles.length }, (_, i) => ({ color, num: start + i }));
      const available = [...naturals];
      let matches = true;
      for (const face of expected) {
        const index = available.findIndex((tile) => sameFace(faceOf(tile, indicator), face));
        if (index >= 0) available.splice(index, 1);
      }
      if (available.length === 0 && expected.length - naturals.length === wilds.length) {
        matches = true;
      } else {
        matches = false;
      }
      if (matches) possibilities.push({ type: "run", score: expected.reduce((sum, face) => sum + face.num, 0) });
    }
  }

  // Aynı sayı, farklı renkler; joker eksik renklerden birini tamamlayabilir.
  for (let num = 1; num <= 13; num += 1) {
    const colors = new Set();
    let matches = true;
    for (const tile of naturals) {
      const face = faceOf(tile, indicator);
      if (face.num !== num || colors.has(face.color)) {
        matches = false;
        break;
      }
      colors.add(face.color);
    }
    const missingColors = 4 - colors.size;
    if (matches && wilds.length <= missingColors) {
      possibilities.push({ type: "set", score: num * tiles.length });
    }
  }

  if (!possibilities.length) return { valid: false, reason: "Taşlar geçerli bir seri veya aynı sayı per'i oluşturmuyor." };
  possibilities.sort((a, b) => b.score - a.score);
  return { valid: true, ...possibilities[0] };
}

export function canOpenWithPairs(tiles, indicator) {
  if (!Array.isArray(tiles) || tiles.length !== 10) return false;
  const wildCount = tiles.filter((tile) => isWild(tile, indicator)).length;
  const counts = new Map();
  for (const tile of tiles) {
    if (isWild(tile, indicator)) continue;
    const face = faceOf(tile, indicator);
    const key = `${face.color}:${face.num}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let pairs = 0;
  let singles = 0;
  for (const count of counts.values()) {
    pairs += Math.floor(count / 2);
    singles += count % 2;
  }
  const wildsUsedWithSingles = Math.min(singles, wildCount);
  pairs += wildsUsedWithSingles;
  const remainingWilds = wildCount - wildsUsedWithSingles;
  pairs += Math.floor(remainingWilds / 2);
  return pairs >= 5;
}

export function evaluateOpening(groups, indicator) {
  if (!Array.isArray(groups) || groups.length === 0) {
    return { valid: false, reason: "Açmak için en az bir per seçmelisiniz." };
  }
  const checked = groups.map((group) => validateMeld(group, indicator));
  const invalid = checked.find((result) => !result.valid);
  if (invalid) return invalid;
  const score = checked.reduce((sum, result) => sum + result.score, 0);
  return score >= 101
    ? { valid: true, score, meldTypes: checked.map((result) => result.type) }
    : { valid: false, score, reason: `Açmak için en az 101 puan gerekir. Seçilen perlerin toplamı ${score}.` };
}
