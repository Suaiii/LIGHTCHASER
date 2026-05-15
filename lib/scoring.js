function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  return total / values.length;
}

function scoreBellCurve(value, optimalMin, optimalMax, hardMin, hardMax) {
  if (value <= hardMin || value >= hardMax) {
    return 0;
  }

  if (value >= optimalMin && value <= optimalMax) {
    return 100;
  }

  if (value < optimalMin) {
    return ((value - hardMin) / (optimalMin - hardMin)) * 100;
  }

  return ((hardMax - value) / (hardMax - optimalMax)) * 100;
}

function scoreVisibility(visibilityKm) {
  if (visibilityKm >= 18) {
    return 100;
  }

  if (visibilityKm >= 10) {
    return 70 + ((visibilityKm - 10) / 8) * 30;
  }

  if (visibilityKm <= 1) {
    return 0;
  }

  return ((visibilityKm - 1) / 9) * 70;
}

function scoreWeatherCode(weatherCode) {
  if (weatherCode === 0 || weatherCode === 1) {
    return 100;
  }

  if (weatherCode === 2) {
    return 82;
  }

  if (weatherCode === 3) {
    return 58;
  }

  if ([45, 48].includes(weatherCode)) {
    return 28;
  }

  if (weatherCode >= 51 && weatherCode <= 67) {
    return 18;
  }

  if (weatherCode >= 71 && weatherCode <= 86) {
    return 8;
  }

  return 35;
}

function getScoreLabel(score) {
  if (score >= 75) {
    return "值得跑出门";
  }

  if (score >= 45) {
    return "可以顺路看看";
  }

  return "今天歇着";
}

function getDemoBucket(score) {
  if (score >= 75) {
    return "high";
  }

  if (score >= 45) {
    return "mid";
  }

  return "low";
}

function calculateSunsetScore(metrics) {
  const cloudScore = scoreBellCurve(metrics.cloudCover, 30, 60, 5, 95);
  const humidityScore = scoreBellCurve(
    metrics.relativeHumidity,
    40,
    70,
    10,
    95
  );
  const visibilityScore = scoreVisibility(metrics.visibilityKm);
  const weatherScore = scoreWeatherCode(metrics.weatherCode);

  let total =
    cloudScore * 0.42 +
    humidityScore * 0.24 +
    visibilityScore * 0.2 +
    weatherScore * 0.14;

  if (metrics.cloudCover >= 25 && metrics.cloudCover <= 65) {
    total += 6;
  }

  if (metrics.visibilityKm >= 12) {
    total += 4;
  }

  if (metrics.weatherCode >= 51 && metrics.weatherCode <= 67) {
    total -= 10;
  }

  return {
    score: Math.round(clamp(total, 0, 100)),
    components: {
      cloudScore: Math.round(cloudScore),
      humidityScore: Math.round(humidityScore),
      visibilityScore: Math.round(visibilityScore),
      weatherScore: Math.round(weatherScore),
    },
  };
}

module.exports = {
  average,
  calculateSunsetScore,
  getDemoBucket,
  getScoreLabel,
};
