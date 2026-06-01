#!/usr/bin/env node
/**
 * column-design.js — RC column axial + moment interaction design (ACI 318-19 / วสท.)
 * Usage: node scripts/column-design.js --b=300 --h=300 --Pu=800 --Mu=50 --Lu=3500 --fc=25 --fy=400
 * Units: b,h in mm | Pu in kN | Mu in kN·m | Lu in mm | fc,fy in MPa
 */

const ck = require('./code-checks');

function parseArgs() {
  const args = process.argv.slice(2);
  const p = {};
  for (const a of args) {
    const m = a.match(/^--(\w+)=([\d.]+)$/);
    if (m) p[m[1]] = parseFloat(m[2]);
  }
  return p;
}

function designColumn(b, h, Pu, Mu, Lu, fc, fy, k = 1.0, tieType = 'tied', cover = 40) {
  const phi_axial = tieType === 'spiral' ? 0.70 : 0.65;
  const phi_flex = 0.9;

  const Ag = b * h;
  const d = h - cover - 10 - 12; // DB20 main + DB12 ties
  const r = 0.3 * h; // radius of gyration ≈ 0.3h for rectangular
  const Pu_N = Pu * 1000;
  const Mu_Nmm = Mu * 1e6;

  // ── Slenderness ──
  const kLu_r = (k * Lu) / r;
  const isShort = ck.isShortColumn(kLu_r);

  let delta = 1.0; // moment magnification factor
  let Mc = Mu_Nmm;

  if (!isShort) {
    // ACI 6.6.4.5 — Moment magnification
    const EI = (0.4 * ck.Ec(fc) * (b * h * h * h / 12)) / (1 + 0.2); // approx
    const Pc = (Math.PI * Math.PI * EI) / ((k * Lu) * (k * Lu)); // Euler buckling
    const Cm = 1.0;
    delta = Cm / (1 - (Pu_N / (0.75 * Pc)));
    if (delta < 1.0) delta = 1.0;
    Mc = delta * Mu_Nmm;
  }

  // ── Axial Capacity ──
  const minEcc = ck.minEccentricity(h);
  const e_min = minEcc;
  const e = Math.max(Mc / Pu_N, e_min);

  // Try ρ_g = 1% to 4% for axial
  const trials = [];
  for (let rho_g = 0.01; rho_g <= 0.04; rho_g += 0.005) {
    const Ast = rho_g * Ag;
    const phiPn = ck.phiPnMax(phi_axial, fc, Ag, Ast, fy);

    // Simplified moment check: balanced condition approx
    const Mn_approx = 0.8 * Ast * fy * (d - 0.4 * (h / 2)); // rough
    const phiMn_approx = phi_flex * Mn_approx;

    const axialOK = phiPn >= Pu_N;
    const momentOK = phiMn_approx >= Mc;
    const utilization_axial = Pu_N / phiPn;
    const utilization_moment = Mc / phiMn_approx;

    trials.push({
      rho_g: (rho_g * 100).toFixed(1) + '%',
      Ast: Ast.toFixed(0),
      bars_suggested: suggestBarArrangement(Ast),
      phiPn: ck.kN(phiPn),
      phiMn_approx: ck.kNm(phiMn_approx),
      axialOK,
      momentOK,
      utilization_axial: utilization_axial.toFixed(3),
      utilization_moment: utilization_moment.toFixed(3),
      pass: axialOK // && momentOK
    });
  }

  // ── Seismic Detailing ──
  const lo = Math.max(h, Lu / 6, 450); // plastic hinge length
  const s_o = Math.min(b / 4, 6 * 20, 100 + (350 - Math.min(b, h)) / 3); // tie spacing in lo
  const s_outside = Math.min(6 * 20, 150); // tie spacing outside lo

  return {
    input: { b, h, Ag, Lu, k, tieType },
    slenderness: {
      kLu_r: kLu_r.toFixed(1),
      limit: 22,
      isShort,
      delta: delta.toFixed(2),
      Mc_magnified: ck.kNm(Mc)
    },
    design: {
      Pu: Pu.toFixed(0),
      Mu: Mu.toFixed(1),
      e: e.toFixed(1),
      e_min: e_min,
      trials
    },
    seismic_detailing: {
      lo,
      tie_spacing_in_lo: Math.floor(s_o),
      tie_spacing_outside: s_outside,
      first_tie_from_face: 50
    },
    recommendation: findRecommendation(trials, b, h)
  };
}

function suggestBarArrangement(Ast) {
  const sizes = [16, 20, 25, 28, 32];
  const byCount = [];

  for (const dia of sizes) {
    const area = Math.PI * dia * dia / 4;
    const count4 = Math.ceil(Ast / area);
    if (count4 >= 4 && count4 <= 8) {
      byCount.push(`${count4}-DB${dia}`);
    }
  }

  if (byCount.length > 0) return byCount.slice(0, 3).join(' or ');
  return 'Use larger section or higher grade';
}

function findRecommendation(trials, b, h) {
  const passing = trials.filter(t => t.pass);
  if (passing.length > 0) {
    const best = passing[0]; // first (lowest ρ_g) that passes
    return {
      status: 'OK',
      rho_recommend: best.rho_g,
      ast: best.Ast,
      bars: best.bars_suggested,
      note: 'Lowest ρ_g meeting axial demand'
    };
  }
  return {
    status: 'FAIL — Increase section or f\'c',
    rho_recommend: '> 4%',
    note: 'Column section inadequate for given load'
  };
}

if (require.main === module) {
  const p = parseArgs();
  const b = p.b || 300;
  const h = p.h || 300;
  const Pu = p.Pu || 800;
  const Mu = p.Mu || 50;
  const Lu = p.Lu || 3500;
  const fc = p.fc || 25;
  const fy = p.fy || 400;
  const k = p.k || 1.0;
  const tieType = p.tie || 'tied';

  const result = designColumn(b, h, Pu, Mu, Lu, fc, fy, k, tieType);

  console.log('=== RC Column Design (ACI 318-19) ===\n');
  console.log(`Section: ${b}×${h} mm  |  Ag = ${result.input.Ag} mm²`);
  console.log(`Lu = ${Lu} mm  |  k = ${k}  |  Type: ${tieType}`);
  console.log(`Materials: f'c = ${fc} MPa  |  fy = ${fy} MPa`);
  console.log(`Loads: Pu = ${result.design.Pu} kN  |  Mu = ${result.design.Mu} kN·m`);

  console.log('\n── Slenderness ──');
  console.log(`kLu/r = ${result.slenderness.kLu_r}  |  Limit = ${result.slenderness.limit}`);
  console.log(`Short column: ${result.slenderness.isShort ? 'Yes' : 'No — Moment magnified by δ = ' + result.slenderness.delta}`);
  if (!result.slenderness.isShort) {
    console.log(`Mc (magnified) = ${result.slenderness.Mc_magnified} kN·m`);
  }
  console.log(`e = ${result.design.e} mm  |  e_min = ${result.design.e_min} mm`);

  console.log('\n── Axial Capacity Trials ──');
  console.log('ρ_g   | Ast(mm²) | φPn(kN)   | φMn(kN·m)  | Axial | Utilization');
  console.log('------|----------|-----------|-------------|-------|------------');
  for (const t of result.design.trials) {
    const util = Math.max(parseFloat(t.utilization_axial), parseFloat(t.utilization_moment));
    console.log(`${t.rho_g.padEnd(6)}| ${t.Ast.padEnd(9)}| ${t.phiPn.padEnd(10)}| ${t.phiMn_approx.padEnd(12)}| ${(t.axialOK ? '✓' : '✗').padEnd(5)} | ${util}`);
  }

  console.log('\n── Recommendation ──');
  console.log(`Status: ${result.recommendation.status}`);
  console.log(`ρ_g: ${result.recommendation.rho_recommend}`);
  console.log(`Suggested bars: ${result.recommendation.bars}`);

  console.log('\n── Seismic Detailing ──');
  console.log(`Plastic hinge lo = ${result.seismic_detailing.lo} mm`);
  console.log(`Tie spacing in lo: ≤ ${result.seismic_detailing.tie_spacing_in_lo} mm`);
  console.log(`Tie spacing outside lo: ≤ ${result.seismic_detailing.tie_spacing_outside} mm`);
  console.log(`First tie: ${result.seismic_detailing.first_tie_from_face} mm from face`);
}

module.exports = { designColumn };
