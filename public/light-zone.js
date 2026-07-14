(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZGLightZone = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const METERS_PER_DEGREE = 111320;

  function destinationPoint(origin, bearingDeg, distanceMeters) {
    const rad = bearingDeg * Math.PI / 180;
    return {
      lng: origin.lng + Math.sin(rad) * distanceMeters / (METERS_PER_DEGREE * Math.cos(origin.lat * Math.PI / 180)),
      lat: origin.lat + Math.cos(rad) * distanceMeters / METERS_PER_DEGREE,
    };
  }

  function toLocal(point, origin) {
    return {
      x: (point.lng - origin.lng) * METERS_PER_DEGREE * Math.cos(origin.lat * Math.PI / 180),
      y: (point.lat - origin.lat) * METERS_PER_DEGREE,
    };
  }

  function cross(a, b) { return a.x * b.y - a.y * b.x; }

  function raySegmentDistance(direction, a, b, maxDistance) {
    const segment = { x: b.x - a.x, y: b.y - a.y };
    const denominator = cross(direction, segment);
    if (Math.abs(denominator) < 1e-8) return null;
    const t = cross(a, segment) / denominator;
    const u = cross(a, direction) / denominator;
    return t >= 2 && t <= maxDistance && u >= 0 && u <= 1 ? t : null;
  }

  function nearestRayHit(candidate, building, direction, maxDistance) {
    const ring = building.rings || [];
    let nearest = null;
    for (let i = 1; i < ring.length; i++) {
      const a = toLocal({ lng: ring[i - 1][0], lat: ring[i - 1][1] }, candidate);
      const b = toLocal({ lng: ring[i][0], lat: ring[i][1] }, candidate);
      const distance = raySegmentDistance(direction, a, b, maxDistance);
      if (distance !== null && (nearest === null || distance < nearest)) nearest = distance;
    }
    return nearest;
  }

  function selectRayBuildings(candidates, buildings, sun, options) {
    const maxDistance = options?.maxDistance || 700;
    const maxBuildings = options?.maxBuildings || 650;
    const rad = sun.azimuthDeg * Math.PI / 180;
    const direction = { x: Math.sin(rad), y: Math.cos(rad) };
    const coveredCandidates = candidates.filter((candidate) => candidate.coverageComplete !== false);
    const selected = [];
    for (const building of buildings) {
      if (coveredCandidates.some((candidate) => nearestRayHit(candidate, building, direction, maxDistance) !== null)) {
        selected.push(building);
      }
    }
    return { buildings: selected.slice(0, maxBuildings), truncated: selected.length > maxBuildings, matchedCount: selected.length };
  }

  function evaluateCandidates(candidates, buildings, sun, options) {
    const maxDistance = options?.maxDistance || 700;
    const clearanceDeg = options?.clearanceDeg ?? 1.5;
    const rad = sun.azimuthDeg * Math.PI / 180;
    const direction = { x: Math.sin(rad), y: Math.cos(rad) };
    return candidates.map((candidate) => {
      if (sun.altitudeDeg <= 0) return { ...candidate, status: "below_horizon", horizonDeg: 0, blockerDistance: null };
      if (!options?.dataReady || candidate.coverageComplete === false) return { ...candidate, status: "unknown", horizonDeg: 0, blockerDistance: null };
      let horizonDeg = 0;
      let blockerDistance = null;
      for (const building of buildings) {
        const distance = nearestRayHit(candidate, building, direction, maxDistance);
        if (distance === null) continue;
        const angle = Math.atan2(Math.max(3, building.h || 12), distance) * 180 / Math.PI;
        if (angle > horizonDeg) { horizonDeg = angle; blockerDistance = distance; }
      }
      const status = sun.altitudeDeg > horizonDeg + clearanceDeg ? "exposed" : "blocked";
      return {
        ...candidate,
        status,
        horizonDeg: +horizonDeg.toFixed(1),
        blockerDistance: blockerDistance === null ? null : Math.round(blockerDistance),
      };
    });
  }

  return { destinationPoint, evaluateCandidates, selectRayBuildings };
});
