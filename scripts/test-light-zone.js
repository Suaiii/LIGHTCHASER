const assert = require("assert");
const { destinationPoint, evaluateCandidates, selectRayBuildings } = require("../public/light-zone");

const east = destinationPoint({ lng: 113.99, lat: 22.59 }, 90, 1000);
assert(Math.abs(east.lat - 22.59) < 0.0001, "east bearing should preserve latitude");
assert(east.lng > 113.999, "east bearing should increase longitude by about 1 km");

const candidate = { id: "spot", lng: 113.99, lat: 22.59 };
const distantBuildings = Array.from({ length: 10 }, (_, i) => ({
  h: 12,
  rings: [
    [114.01 + i * 0.001, 22.59], [114.0102 + i * 0.001, 22.59],
    [114.0102 + i * 0.001, 22.5902], [114.01 + i * 0.001, 22.5902],
    [114.01 + i * 0.001, 22.59],
  ],
}));
const clear = evaluateCandidates([candidate], distantBuildings, { azimuthDeg: 0, altitudeDeg: 7 }, { dataReady: true });
assert.equal(clear[0].status, "exposed");
assert.equal(clear[0].blockerDistance, null);

const northBuilding = {
  h: 45,
  rings: [
    [113.9898, 22.5908], [113.9902, 22.5908],
    [113.9902, 22.5912], [113.9898, 22.5912], [113.9898, 22.5908],
  ],
};
const blocked = evaluateCandidates([candidate], [northBuilding, ...distantBuildings], { azimuthDeg: 0, altitudeDeg: 7 }, { dataReady: true });
assert.equal(blocked[0].status, "blocked");
assert(blocked[0].horizonDeg > 7);
assert(blocked[0].blockerDistance > 50 && blocked[0].blockerDistance < 200);

const below = evaluateCandidates([candidate], [], { azimuthDeg: 270, altitudeDeg: -1 });
assert.equal(below[0].status, "below_horizon");

const notReady = evaluateCandidates([candidate], [], { azimuthDeg: 270, altitudeDeg: 7 });
assert.equal(notReady[0].status, "unknown");
const partial = evaluateCandidates([candidate], distantBuildings, { azimuthDeg: 270, altitudeDeg: 7 }, { dataReady: false });
assert.equal(partial[0].status, "unknown");
const readyOpenGround = evaluateCandidates([candidate], [], { azimuthDeg: 270, altitudeDeg: 7 }, { dataReady: true });
assert.equal(readyOpenGround[0].status, "exposed");
const uncovered = evaluateCandidates([{ ...candidate, coverageComplete: false }], distantBuildings, { azimuthDeg: 270, altitudeDeg: 7 }, { dataReady: true });
assert.equal(uncovered[0].status, "unknown");

const denseNonBlockers = Array.from({ length: 700 }, (_, index) => ({
  h: 12,
  rings: [
    [113.98 + index * 0.000001, 22.59], [113.98001 + index * 0.000001, 22.59],
    [113.98001 + index * 0.000001, 22.59001], [113.98 + index * 0.000001, 22.59001],
    [113.98 + index * 0.000001, 22.59],
  ],
}));
const raySelection = selectRayBuildings([candidate], [...denseNonBlockers, northBuilding], { azimuthDeg: 0, altitudeDeg: 7 }, { maxBuildings: 650 });
assert.equal(raySelection.buildings.length, 1);
assert.equal(raySelection.buildings[0], northBuilding);
assert.equal(raySelection.truncated, false);

console.log("light-zone geometry: PASS");
