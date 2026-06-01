#!/usr/bin/env node
/**
 * code-checks.js — Shared code compliance checks (วสท. / ACI 318-19)
 * Usage: called as module from other scripts
 */

// ── Material Properties ──

function Ec(fc) {
  // Modulus of elasticity, ACI 19.2.2.1
  // Ec = wc^1.5 × 0.043√f'c (MPa) — normal weight concrete
  return Math.round(4700 * Math.sqrt(fc)); // simplified: 4700√f'c
}

function beta1(fc) {
  // Whitney stress block depth factor, ACI 22.2.2.4.3
  if (fc <= 28) return 0.85;
  if (fc >= 55) return 0.65;
  return 0.85 - 0.05 * (fc - 28) / 7;
}

// ── Reinforcement Limits ──

function rhoMin(fy, fc) {
  // ACI 9.6.1.2
  const a = 0.25 * Math.sqrt(fc) / fy;
  const b = 1.4 / fy;
  return Math.max(a, b);
}

function rhoMax(fc, fy) {
  // Tension-controlled limit: 0.75 × ρ_b
  const rhoB = 0.85 * beta1(fc) * (fc / fy) * (600 / (600 + fy));
  return 0.75 * rhoB;
}

function rhoBalanced(fc, fy) {
  return 0.85 * beta1(fc) * (fc / fy) * (600 / (600 + fy));
}

function AsMinRho(rho, b, h) {
  return rho * b * h; // mm²
}

// ── Flexure (Beam/Slab) ──

function Rn(Mu, b, d) {
  // Mu in N·mm, b in mm, d in mm → Rn in MPa
  if (b <= 0 || d <= 0) return 0;
  return Mu / (b * d * d);
}

function rhoRequired(Rn, fc, fy) {
  // From: Rn = ρ × fy × (1 − 0.59ρ × fy / f'c)
  // Solve: ρ = (0.85f'c/fy) × (1 − √(1 − 2Rn/(0.85f'c)))
  if (fc <= 0 || fy <= 0) return 0;
  const m = fy / (0.85 * fc);
  const disc = 1 - 2 * Rn / (0.85 * fc);
  if (disc < 0) return -1; // section inadequate
  return (1 / m) * (1 - Math.sqrt(disc));
}

function AsRequired(rho, b, d) {
  return rho * b * d; // mm²
}

function phiMn(As, fy, d, a, phi = 0.9) {
  // φMn = φ × As × fy × (d − a/2)
  // a = As × fy / (0.85 × f'c × b)
  return phi * As * fy * (d - a / 2); // N·mm
}

function depthStressBlock(As, fy, fc, b) {
  // a = As × fy / (0.85 × f'c × b)
  if (fc <= 0 || b <= 0) return 0;
  return (As * fy) / (0.85 * fc * b);
}

function checkFlexure(Mu, phiMnVal) {
  return { pass: phiMnVal >= Mu, ratio: Mu / phiMnVal, phiMn: phiMnVal };
}

// ── Shear ──

function Vc(fc, bw, d, lambda = 1.0) {
  // ACI 22.5.5.1: Vc = 0.17λ√f'c × bw × d (N)
  return 0.17 * lambda * Math.sqrt(fc) * bw * d;
}

function VsMax(fc, bw, d) {
  // ACI 22.5.1.2: Vs ≤ 0.66√f'c × bw × d
  return 0.66 * Math.sqrt(fc) * bw * d;
}

function VsRequired(Vu, phi, Vc) {
  return (Vu / phi) - Vc; // if > 0, need stirrups
}

function stirrupSpacing(Av, fy, d, Vs, bw) {
  // s = Av × fy × d / Vs, limits below
  if (Vs <= 0) return -1; // no stirrups needed
  const s = (Av * fy * d) / Vs;
  return s;
}

function stirrupSpacingMax(d, fc, bw, Av, fy) {
  // ACI 9.7.6.2.2
  const s1 = Math.min(d / 2, 600); // general
  const VsCheck = 0.33 * Math.sqrt(fc) * bw * d;
  // If Vs > 0.33√f'c bw d: s_max = d/4 ≤ 300mm
  if (Av * fy * d / Math.min(d / 4, 300) > VsCheck) {
    return Math.min(d / 4, 300);
  }
  return s1;
}

function checkShear(Vu, phiVc, phiVs, phiVn) {
  const pass = phiVn >= Vu;
  return { pass, ratio: Vu / phiVn, phiVc, phiVs, phiVn };
}

// ── Columns ──

function phiPnMax(phi, fc, Ag, Ast, fy) {
  // ACI 22.4.2: φPn,max = 0.80φ[0.85f'c(Ag−Ast) + fyAst]
  return 0.8 * phi * (0.85 * fc * (Ag - Ast) + fy * Ast);
}

function checkAxial(Pu, phiPnMaxVal) {
  return { pass: phiPnMaxVal >= Pu, ratio: Pu / phiPnMaxVal };
}

function slendernessRatio(k, Lu, r) {
  return (k * Lu) / r;
}

function isShortColumn(klu_r) {
  const limit = 22; // ACI simplified: ≤ 22 ignore slenderness
  return klu_r <= limit;
}

function minEccentricity(h) {
  return Math.max(15 + 0.03 * h, 20); // mm
}

// ── Footings ──

function bearingCheck(P, A, M, S, qAll) {
  const qMax = P / A + M / S;
  const qMin = P / A - M / S;
  return {
    pass: qMax <= qAll && qMin >= 0,
    qMax, qMin, qAll,
    ratio: qMax / qAll
  };
}

function punchingShearStress(Vu, bo, d, fc, lambda = 1.0) {
  // Smallest of: 0.33, 0.17(1+2/β), 0.083(2+αs×d/bo)
  const vc1 = 0.33 * lambda * Math.sqrt(fc);
  // For square column: vc = 0.33λ√f'c simplified
  const phiVc = 0.75 * vc1 * bo * d;
  return { phiVc, pass: phiVc >= Vu, ratio: Vu / phiVc };
}

// ── Pile Capacity ──

function endBearingClay(Nc, Su, Ab) {
  // Qb = Nc × Su × Ab
  return Nc * Su * Ab; // N (Su in MPa, Ab in mm²)
}

function endBearingSand(Nq, sigmaV, Ab) {
  // Qb = Nq × σ'v × Ab
  return Nq * sigmaV * Ab; // N
}

function skinFrictionClay(alpha, Su, As) {
  // Qs = α × Su × As
  return alpha * Su * As; // N
}

function skinFrictionSand(beta, sigmaV, As) {
  // Qs = β × σ'v × As
  return beta * sigmaV * As; // N
}

function pileAllowable(Qu, FS = 2.5) {
  return { Qu, Qall: Qu / FS, FS };
}

function pileGroupEfficiencyConverseLabarre(n, m, D, s, theta = Math.atan(D / s) * (180 / Math.PI)) {
  // Converse-Labarre formula
  const deg = Math.atan(D / s) * 180 / Math.PI;
  return 1 - (deg / 90) * ((m * (n - 1) + n * (m - 1)) / (m * n));
}

// ── Seismic ──

function baseShear(Cs, W) {
  return Cs * W; // kN
}

function approximatePeriod(H, system = 'moment-frame') {
  // Ta = Ct × H^x
  // RC moment frame: Ct = 0.0466, x = 0.9
  if (system === 'moment-frame') return 0.0466 * Math.pow(H, 0.9);
  return 0.02 * Math.pow(H, 0.75); // generic
}

function storyForce(wx, hx, k, totalWxHk, V) {
  // Fx = (wx × hx^k) / Σ(wi × hi^k) × V
  const numerator = wx * Math.pow(hx, k);
  return (numerator / totalWxHk) * V;
}

// ── Bar Properties ──

const BARS = {
  RB6:  { dia: 6,  area: 28.3 },
  RB9:  { dia: 9,  area: 63.6 },
  RB12: { dia: 12, area: 113.1 },
  DB10: { dia: 10, area: 78.5 },
  DB12: { dia: 12, area: 113.1 },
  DB16: { dia: 16, area: 201.1 },
  DB20: { dia: 20, area: 314.2 },
  DB25: { dia: 25, area: 490.9 },
  DB28: { dia: 28, area: 615.8 },
  DB32: { dia: 32, area: 804.2 }
};

function barArea(size, count = 1) {
  if (BARS[size.toUpperCase()]) return BARS[size.toUpperCase()].area * count;
  return 0;
}

function barDia(size) {
  if (BARS[size.toUpperCase()]) return BARS[size.toUpperCase()].dia;
  return 0;
}

function selectBars(AsReq) {
  // Find smallest bar arrangement that meets AsReq, ≤ 4 bars per layer
  const options = [];
  const sizes = ['DB12', 'DB16', 'DB20', 'DB25', 'DB28', 'DB32'];

  for (const size of sizes) {
    for (let n = 2; n <= 6; n++) {
      const As = barArea(size, n);
      if (As >= AsReq && As <= AsReq * 1.5) {
        options.push({ size, count: n, As, ratio: As / AsReq });
      }
    }
  }
  if (options.length === 0) {
    // Fallback: closest match
    for (const size of sizes) {
      for (let n = 2; n <= 8; n++) {
        const As = barArea(size, n);
        options.push({ size, count: n, As, ratio: As / AsReq });
      }
    }
    options.sort((a, b) => a.ratio - b.ratio);
    return options.slice(0, 3);
  }
  options.sort((a, b) => a.ratio - b.ratio);
  return options.slice(0, 3);
}

// ── Formatting ──

function kN(v) { return (v / 1000).toFixed(2); }
function kNm(v) { return (v / 1e6).toFixed(2); }
function MPa(v) { return (v).toFixed(2); }
function mm2(v) { return (v).toFixed(2); }

// ── Exports ──

module.exports = {
  Ec, beta1,
  rhoMin, rhoMax, rhoBalanced, AsMinRho,
  Rn, rhoRequired, AsRequired, phiMn, depthStressBlock, checkFlexure,
  Vc, VsMax, VsRequired, stirrupSpacing, stirrupSpacingMax, checkShear,
  phiPnMax, checkAxial, slendernessRatio, isShortColumn, minEccentricity,
  bearingCheck, punchingShearStress,
  endBearingClay, endBearingSand, skinFrictionClay, skinFrictionSand,
  pileAllowable, pileGroupEfficiencyConverseLabarre,
  baseShear, approximatePeriod, storyForce,
  BARS, barArea, barDia, selectBars,
  kN, kNm, MPa, mm2
};
