/* LIGHTCHASER · 胶片 LUT 工厂
 *
 * 4 套手工合成的 64³ Cube LUT (786 KB / LUT),作为 Portra 400 / Velvia / Tri-X / Classic Chrome
 * 的"真正调色"层,在 ToneLayer 之前应用。每套 LUT 是按已知胶片色彩科学规则计算的近似矩阵。
 *
 * 数据格式:Uint8Array(64*64*64*3),按 RGB 顺序索引。
 *   idx = (r * 64 + g) * 64 + b  每个 cell 返回 [R, G, B]
 *
 * 不做三线性插值(LUT 量化到 64 阶 + strength 混合已经够看,精度是后续优化项)。
 *
 * 暴露: window.LightchaserFilterLUTs = { LUT_FACTORY: {...}, generatePortra400LUT, ... }
 */
(function (root) {
  "use strict";

  const N = 64;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function hsv(r, g, b, dh, ds, dv) {
    // 简化版 HSL:直接加 hue shift (弧度) + saturation scale + value scale
    // r,g,b in 0..255 → out 0..255
    const rN = r / 255, gN = g / 255, bN = b / 255;
    const max = Math.max(rN, gN, bN), min = Math.min(rN, gN, bN);
    const v = max;
    const s = max === 0 ? 0 : (max - min) / max;
    let h = 0;
    if (max !== min) {
      const d = max - min;
      if (max === rN) h = ((gN - bN) / d) % 6;
      else if (max === gN) h = (bN - rN) / d + 2;
      else h = (rN - gN) / d + 4;
      h /= 6;
    }
    // apply HSV adjustments
    const hNew = (h + dh + 1) % 1;
    const sNew = clamp(s * ds, 0, 1);
    const vNew = clamp(v * dv, 0, 1);
    // HSV → RGB
    const c = vNew * sNew;
    const x = c * (1 - Math.abs((hNew * 6) % 2 - 1));
    const m = vNew - c;
    let r1, g1, b1;
    const seg = Math.floor(hNew * 6);
    if (seg === 0) { r1 = c; g1 = x; b1 = 0; }
    else if (seg === 1) { r1 = x; g1 = c; b1 = 0; }
    else if (seg === 2) { r1 = 0; g1 = c; b1 = x; }
    else if (seg === 3) { r1 = 0; g1 = x; b1 = c; }
    else if (seg === 4) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    return [
      Math.round((r1 + m) * 255),
      Math.round((g1 + m) * 255),
      Math.round((b1 + m) * 255),
    ];
  }

  function curve(v, shadowLift, highlightLift, midContrast) {
    // shadowLift/highlightLift 是 s 形调整 (-30..30),midContrast 是中间调对比倍率
    // v in 0..255
    const norm = v / 255;
    const shadow = norm < 0.5;
    let out;
    if (shadow) {
      out = norm * (1 + shadowLift / 100) + shadowLift / 200;
    } else {
      out = norm + (1 - norm) * (highlightLift / 100) + highlightLift / 200;
    }
    // 中间调对比
    const centered = (out - 0.5) * midContrast + 0.5;
    return clamp(Math.round(centered * 255), 0, 255);
  }

  // ── Portra 400 ──
  // 真实 Portra 400 色彩科学:
  //  - 肤色暖粉:R+12, B-4 in midtones
  //  - 蓝绿色饱和抑制:cyan/green 区域 sat -20%
  //  - 高光偏粉:R+8, G+5
  //  - 阴影偏青蓝紫
  function generatePortra400LUT() {
    const lut = new Uint8Array(N * N * N * 3);
    for (let r = 0; r < N; r++) {
      for (let g = 0; g < N; g++) {
        for (let b = 0; b < N; b++) {
          let R = r * 4, G = g * 4, B = b * 4;
          // 1. 中间调加暖:R+12, G+6, B-4
          R += 12; G += 6; B -= 4;
          // 2. 蓝绿饱和抑制:cyan 区域 (-30,-10,+10) 强制 sat -20%
          const maxC = Math.max(R, G, B);
          const minC = Math.min(R, G, B);
          const lum = (R + G + B) / 3;
          if (B > R && B > G - 10 && lum < 200) {
            // cyan/blue 偏多 → 降 B,加 R
            B = Math.max(0, B - 8);
            R = Math.min(255, R + 4);
          }
          if (G > R + 20 && G > B + 10 && lum < 180) {
            // 绿色偏多 → 降 G
            G = Math.max(0, G - 6);
          }
          // 3. 高光暖粉(R+8, G+5)
          if (lum > 170) {
            R = Math.min(255, R + 8);
            G = Math.min(255, G + 5);
          }
          // 4. 阴影偏青蓝紫(lum < 80 → B+6, R-2)
          if (lum < 80) {
            B = Math.min(255, B + 6);
            R = Math.max(0, R - 2);
          }
          // 5. S 形 tone curve(中间调对比 +10%, 阴影 lift +5%)
          R = curve(R, 5, -2, 1.10);
          G = curve(G, 5, -2, 1.10);
          B = curve(B, 5, -2, 1.10);
          const i = (r * N * N + g * N + b) * 3;
          lut[i] = R; lut[i + 1] = G; lut[i + 2] = B;
        }
      }
    }
    return lut;
  }

  // ── Velvia ──
  // 高饱和风景:R/G 通道大幅 boost,B 通道轻微压
  // 对中间调对比 +20%,黑色加深,sat +35%
  function generateVelviaLUT() {
    const lut = new Uint8Array(N * N * N * 3);
    for (let r = 0; r < N; r++) {
      for (let g = 0; g < N; g++) {
        for (let b = 0; b < N; b++) {
          let R = r * 4, G = g * 4, B = b * 4;
          const maxC = Math.max(R, G, B);
          const minC = Math.min(R, G, B);
          // 1. 增强主色相(每通道对最高通道 boost,最低通道衰减)
          R = R + (maxC === R ? 15 : -5);
          G = G + (maxC === G && maxC !== R ? 18 : -5);
          B = B + (maxC === B && maxC !== R && maxC !== G ? 12 : -3);
          // 2. 中间调对比 +25%
          R = curve(R, -8, -10, 1.25);
          G = curve(G, -8, -10, 1.25);
          B = curve(B, -8, -10, 1.25);
          // 3. 高饱和区域再 boost(R/G 主导的"风景绿/红")
          if (R > G + 20 && R > B + 30) R = Math.min(255, R + 6);
          if (G > R + 20 && G > B + 10) G = Math.min(255, G + 6);
          const i = (r * N * N + g * N + b) * 3;
          lut[i] = R; lut[i + 1] = G; lut[i + 2] = B;
        }
      }
    }
    return lut;
  }

  // ── Tri-X 400 ──
  // 黑白高对比:按 ITU-R 601 luma → 强化对比,sat=0
  function generateTriXLUT() {
    const lut = new Uint8Array(N * N * N * 3);
    for (let r = 0; r < N; r++) {
      for (let g = 0; g < N; g++) {
        for (let b = 0; b < N; b++) {
          const R = r * 4, G = g * 4, B = b * 4;
          const luma = 0.299 * R + 0.587 * G + 0.114 * B;
          // 对比 +40%,黑色压暗
          const gray = curve(luma, -10, -8, 1.40);
          const i = (r * N * N + g * N + b) * 3;
          lut[i] = gray; lut[i + 1] = gray; lut[i + 2] = gray;
        }
      }
    }
    return lut;
  }

  // ── Classic Chrome ──
  // 街头冷调:低饱和,中对比,蓝/绿冷色
  function generateClassicChromeLUT() {
    const lut = new Uint8Array(N * N * N * 3);
    for (let r = 0; r < N; r++) {
      for (let g = 0; g < N; g++) {
        for (let b = 0; b < N; b++) {
          let R = r * 4, G = g * 4, B = b * 4;
          // 1. 降饱和(-22%):往灰度拉
          const gray = 0.299 * R + 0.587 * G + 0.114 * B;
          R = gray + (R - gray) * 0.78;
          G = gray + (G - gray) * 0.78;
          B = gray + (B - gray) * 0.78;
          // 2. 冷调:R-6, G-2, B+8
          R = Math.max(0, R - 6);
          G = Math.max(0, G - 2);
          B = Math.min(255, B + 8);
          // 3. 对比 +12%
          R = curve(R, -4, -4, 1.12);
          G = curve(G, -4, -4, 1.12);
          B = curve(B, -4, -4, 1.12);
          const i = (r * N * N + g * N + b) * 3;
          lut[i] = R; lut[i + 1] = G; lut[i + 2] = B;
        }
      }
    }
    return lut;
  }

  const LUT_FACTORY = {
    "portra-400": generatePortra400LUT,
    "velvia": generateVelviaLUT,
    "tri-x": generateTriXLUT,
    "classic-chrome": generateClassicChromeLUT,
  };

  root.LightchaserFilterLUTs = {
    N,
    LUT_FACTORY,
    generatePortra400LUT,
    generateVelviaLUT,
    generateTriXLUT,
    generateClassicChromeLUT,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);