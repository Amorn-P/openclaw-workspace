#!/usr/bin/env node
/**
 * load-combos.js — Load combination calculator (วสท. / ACI 318-19)
 * Usage: node scripts/load-combos.js --DL=5.0 --LL=2.0 --E=3.5 [--W=1.2]
 */

const { kN, kNm } = require('./code-checks');

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (const a of args) {
    const m = a.match(/^--(\w+)=([\d.]+)$/);
    if (m) params[m[1]] = parseFloat(m[2]);
  }
  return params;
}

function loadCombinations(DL, LL, E = 0, W = 0, Lr = 0, S = 0) {
  // ACI 318-19 Table 5.3.1 + วสท. additions
  const combos = [];

  // U1: 1.4DL
  combos.push({ name: 'U1', desc: '1.4DL', value: 1.4 * DL });

  // U2: 1.2DL + 1.6LL + 0.5Lr (or 0.5S)
  if (Lr > 0) {
    combos.push({ name: 'U2a', desc: '1.2DL + 1.6LL + 0.5Lr', value: 1.2 * DL + 1.6 * LL + 0.5 * Lr });
    combos.push({ name: 'U2b', desc: '1.2DL + 1.6Lr + 1.0LL', value: 1.2 * DL + 1.6 * Lr + 1.0 * LL });
  } else {
    combos.push({ name: 'U2', desc: '1.2DL + 1.6LL', value: 1.2 * DL + 1.6 * LL });
  }

  // U3: 1.2DL + 1.0LL + 1.0E (seismic)
  if (E > 0) {
    combos.push({ name: 'U3a', desc: '1.2DL + 1.0LL + 1.0E', value: 1.2 * DL + 1.0 * LL + 1.0 * E });
    combos.push({ name: 'U3b', desc: '1.2DL + 1.0LL − 1.0E', value: 1.2 * DL + 1.0 * LL - 1.0 * E });
  }

  // U4: 0.9DL + 1.0E (seismic uplift)
  if (E > 0) {
    combos.push({ name: 'U4a', desc: '0.9DL + 1.0E', value: 0.9 * DL + 1.0 * E });
    combos.push({ name: 'U4b', desc: '0.9DL − 1.0E', value: 0.9 * DL - 1.0 * E });
  }

  // Wind combos (วสท.)
  if (W > 0) {
    combos.push({ name: 'U5a', desc: '1.2DL + 1.3LL + 1.3W', value: 1.2 * DL + 1.3 * LL + 1.3 * W });
    combos.push({ name: 'U5b', desc: '1.2DL + 1.3LL − 1.3W', value: 1.2 * DL + 1.3 * LL - 1.3 * W });
    combos.push({ name: 'U6a', desc: '1.2DL + 1.0LL + 1.3W', value: 1.2 * DL + 1.0 * LL + 1.3 * W });
    combos.push({ name: 'U7', desc: '0.9DL + 1.3W', value: 0.9 * DL + 1.3 * W });
  }

  // วสท. alternative seismic
  if (E > 0) {
    combos.push({ name: 'U8a', desc: '1.2DL + 1.0LL + 1.3E (วสท.)', value: 1.2 * DL + 1.0 * LL + 1.3 * E });
  }

  // Service combos (for foundation sizing)
  combos.push({ name: 'S1', desc: 'DL + LL (service)', value: DL + LL });
  combos.push({ name: 'S2', desc: 'DL + 0.7LL + 0.7E (service seismic)', value: DL + 0.7 * LL + 0.7 * E });

  // Find maximum
  const maxUltimate = combos
    .filter(c => c.name.startsWith('U'))
    .reduce((max, c) => c.value > max.value ? c : max, combos[0]);

  const maxService = combos
    .filter(c => c.name.startsWith('S'))
    .reduce((max, c) => c.value > max.value ? c : max, combos[0]);

  return { combos, maxUltimate, maxService };
}

function seismicBaseShear(W, SDS, R, Ie, T, SD1) {
  // ASCE 7-16 §12.8 / วสท. 1302
  // V = Cs × W
  // Cs = SDS / (R/Ie)  ≤ SD1 / (T × R/Ie)  and ≥ 0.044 × SDS × Ie (≥ 0.01)

  const CsMin = Math.max(0.044 * SDS * Ie, 0.01);
  const CsMax = SD1 / (T * (R / Ie));

  let Cs = SDS / (R / Ie);
  if (Cs > CsMax && CsMax > 0) Cs = CsMax;
  if (Cs < CsMin) Cs = CsMin;

  const V = Cs * W;

  return {
    Cs, CsMin, CsMax,
    V: kN(V),
    V_n: V, // Newtons
    R, Ie, T,
    SDS, SD1,
    W: kN(W)
  };
}

function seismicZones() {
  return {
    '1':  { SDS: 0.12, SD1: 0.055, desc: 'Very low' },
    '2A': { SDS: 0.25, SD1: 0.125, desc: 'Low' },
    '2B': { SDS: 0.42, SD1: 0.215, desc: 'Moderate' },
    '3':  { SDS: 0.65, SD1: 0.330, desc: 'High' },
    '4':  { SDS: 0.90, SD1: 0.450, desc: 'Very high' }
  };
}

function importanceFactor(type) {
  const factors = {
    standard: 1.0,
    essential: 1.25,
    critical: 1.5,
    residential: 1.0,
    office: 1.0,
    hospital: 1.5,
    school: 1.25,
    fire_station: 1.5
  };
  return factors[type] || 1.0;
}

function responseMod(R_type) {
  const types = {
    'ordinary-moment-frame': 3,
    'intermediate-moment-frame': 5,
    'special-moment-frame': 8,
    'ordinary-shear-wall': 4,
    'special-shear-wall': 5.5,
    'dual-system': 6.5
  };
  return types[R_type] || 3; // default: ordinary moment frame
}

// ── CLI ──

if (require.main === module) {
  const params = parseArgs();

  const DL = params.DL || 0;
  const LL = params.LL || 0;
  const E = params.E || 0;
  const W = params.W || 0;
  const Lr = params.Lr || 0;

  const result = loadCombinations(DL, LL, E, W, Lr);

  console.log('=== Load Combinations (ACI 318-19 / วสท.) ===\n');
  console.log(`Input: DL=${DL}  LL=${LL}  E=${E}  W=${W}  Lr=${Lr}\n`);

  console.log('Combination               | Value (kN/m²)');
  console.log('---------------------------|--------------');
  for (const c of result.combos) {
    console.log(`${c.name.padEnd(26)} | ${c.value.toFixed(2)}`);
  }

  console.log(`\n▶ Max Ultimate: ${result.maxUltimate.name} = ${result.maxUltimate.value.toFixed(2)} kN/m²`);
  console.log(`▶ Max Service:  ${result.maxService.name} = ${result.maxService.value.toFixed(2)} kN/m²`);

  // Seismic
  if (params.W && params.zone && params.soilType) {
    const zones = seismicZones();
    const zone = zones[params.zone];
    if (zone) {
      const Ie = importanceFactor(params.occupancy || 'residential');
      const R = responseMod(params.system || 'ordinary-moment-frame');
      const H = params.H || 10; // building height m
      const Ta = 0.0466 * Math.pow(H, 0.9);

      const seis = seismicBaseShear(params.W * 1000, zone.SDS, R, Ie, Ta, zone.SD1);
      console.log(`\n=== Seismic Base Shear (วสท. 1302) ===`);
      console.log(`Zone: ${params.zone} (${zone.desc})`);
      console.log(`SDS: ${zone.SDS}g  SD1: ${zone.SD1}g`);
      console.log(`R: ${R}  Ie: ${Ie}  T: ${Ta.toFixed(3)}s`);
      console.log(`Cs: ${seis.Cs.toFixed(4)}  (min: ${seis.CsMin.toFixed(4)}, max: ${seis.CsMax.toFixed(4)})`);
      console.log(`Total Weight W: ${seis.W} kN`);
      console.log(`Base Shear V: ${seis.V} kN`);
    }
  }
}

module.exports = { loadCombinations, seismicBaseShear, seismicZones, importanceFactor, responseMod };
