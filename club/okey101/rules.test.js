import test from "node:test";
import assert from "node:assert/strict";
import {
  canOpenWithPairs,
  createTileSet,
  evaluateOpening,
  isWild,
  jokerFace,
  validateMeld,
} from "./rules.js";

const tile = (color, num, copy = 0) => ({ id: `${color}-${num}-${copy}`, kind: "normal", color, num });
const indicator = { color: "red", num: 5 };
const okey = jokerFace(indicator); // Kırmızı 6

test("106 taş üretir: 104 sayılı taş ve iki sahte okey", () => {
  const tiles = createTileSet();
  assert.equal(tiles.length, 106);
  assert.equal(tiles.filter((item) => item.kind === "fake-joker").length, 2);
  assert.equal(tiles.filter((item) => item.kind === "normal").length, 104);
});

test("gösterge 13 ise aynı rengin 1'i okey olur", () => {
  assert.deepEqual(jokerFace({ color: "blue", num: 13 }), { color: "blue", num: 1 });
});

test("okey taşını sahte okeyden ayırır", () => {
  assert.equal(isWild(tile("red", 6), indicator), true);
  assert.equal(isWild({ id: "fake", kind: "fake-joker" }, indicator), false);
});

test("ardışık seri ve farklı renkli setleri geçerli sayar", () => {
  assert.equal(validateMeld([tile("blue", 10), tile("blue", 11), tile("blue", 12)], indicator).valid, true);
  assert.equal(validateMeld([tile("red", 9), tile("blue", 9), tile("black", 9)], indicator).valid, true);
});

test("seri 13'ten 1'e saramaz ve set aynı rengi iki kez alamaz", () => {
  assert.equal(validateMeld([tile("yellow", 12), tile("yellow", 13), tile("yellow", 1)], indicator).valid, false);
  assert.equal(validateMeld([tile("red", 9, 0), tile("red", 9, 1), tile("blue", 9)], indicator).valid, false);
});

test("okey joker olarak eksik taşın yerini tutar", () => {
  const result = validateMeld([tile("blue", 10), tile("red", 6), tile("blue", 12)], indicator);
  assert.equal(result.valid, true);
  assert.equal(result.type, "run");
});

test("101 puan altındaki per açılmaz, 101 ve üzeri açılır", () => {
  const below = evaluateOpening([[tile("blue", 10), tile("blue", 11), tile("blue", 12)]], indicator);
  const enough = evaluateOpening([
    [tile("red", 8), tile("red", 9), tile("red", 10), tile("red", 11), tile("red", 12), tile("red", 13)],
    [tile("blue", 10), tile("blue", 11), tile("blue", 12), tile("blue", 13)],
  ], indicator);
  assert.equal(below.valid, false);
  assert.equal(enough.valid, true);
  assert.ok(enough.score >= 101);
});

test("aynı taş kopyalarından beş çift açılabilir", () => {
  const hand = [];
  for (let n = 1; n <= 5; n += 1) hand.push(tile("blue", n, 0), tile("blue", n, 1));
  assert.equal(canOpenWithPairs(hand, indicator), true);
  assert.equal(canOpenWithPairs(hand.slice(0, 9), indicator), false);
});

test("açık renk/sayı yüzü olan sahte okey gerçek eş taşla çift oluşturabilir", () => {
  const hand = [
    { id: "fake-joker-0", kind: "fake-joker" }, tile(okey.color, okey.num, 0),
    tile("blue", 1, 0), tile("blue", 1, 1), tile("black", 2, 0), tile("black", 2, 1),
    tile("yellow", 3, 0), tile("yellow", 3, 1), tile("red", 4, 0), tile("red", 4, 1),
  ];
  assert.equal(canOpenWithPairs(hand, indicator), true);
});
