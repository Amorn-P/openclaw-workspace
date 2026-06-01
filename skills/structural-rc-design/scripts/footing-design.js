#!/usr/bin/env node
/**
 * footing-design.js — Spread footing / pile cap design (ACI 318-19 / วสท.)
 * Usage: node scripts/footing-design.js --P=800 --M=50 --qAll=200 --fc=25 --fy=400 --colB=300 --colH=300
 * Units: P in kN | M in kN·m | qAll in kPa | fc,fy in MPa | colB,colH in mm
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

function designSpreadFooting(P_service, M_service, qAll, fc, fy, colB, colH, gamma_soil = 18, Df = 1.5) {
  // γ_soil = soil unit weight (kN/m³), Df = footing depth (m)
  const phi_flex = 0.9;
  const phi_shear1 = 0.75; // one-way
  const phi_shear2 = 0.75; // two-way (punching)

  // Overburden: subtract weight of footing + soil
  const q_net = qAll - 24 * 0.5 - gamma_soil * (Df - 0.5); // assume 0.5m footing thick
  const qUse = Math.max(q_net, 50); // minimum

  // ── Footing Size ──
  // Trial: A = P / q_net, B = sqrt(A), round up
  let A_req = P_service / qUse;
  let B_trial = Math.ceil(Math.sqrt(A_req) / 0.1) * 0.1; // round to 0.1m
  B_trial = Math.max(B_trial, colB / 1000 + 0.3); // min width
  let L = B_trial;
  let B = B_trial;
  let A = L * B;

  // Check soil pressure with moment
  let S = B * L * L / 6; // section modulus
  let qMax = P_service / A + M_service / S;
  let qMin = P_service / A - M_service / S;

  // Resize if needed
  let iter = 0;
  while (qMax > qUse && iter < 10) {
    B_trial += 0.1;
    L = B_trial;
    B = B_trial;
    A = L * B;
    S = B * L * L / 6;
    qMax = P_service / A + M_service / S;
    qMin = P_service / A - M_service / S;
    iter++;
  }

  let qMaxFactored = (1.2 * P_service / A) + (1.2 * M_service / S);

  // ── Depth from Punching Shear ──
  // Trial d, check
  let h = 500; // initial
  let d = h - 75; // cover 75mm
  const bo = 2 * (colB + d) + 2 * (colH + d);
  const Vu_punch = (P_service * 1.2) - qMaxFactored * ((colB + d) * (colH + d)) / 1e6;

  // Iterate
  for (iter = 0; iter < 10; iter++) {
    const vc = 0.33 * Math.sqrt(fc);
    const phiVc = phi_shear2 * vc * bo * d;
    if (phiVc >= Vu_punch * 1000) break;
    h += 50;
    d = h - 75;
    bo = 2 * (colB + d) + 2 * (colH + d);
  }

  // ── One-way shear check ──
  const L_cant = (L * 1000 - colB) / 2 - d;
  const Vu_oneway = qMaxFactored * B * L_cant / 1000;
  const Vc_oneway = ck.Vc(fc, B * 1000, d) / 1000;
  const phiVc_oneway = phi_shear1 * Vc_oneway;

  // ── Flexure ──
  const cant = (L * 1000 - colB) / 2;
  const Mu = qMaxFactored * B * (cant / 1000) * (cant / 1000) / 2; // kN·m
  const Mu_nmm = Mu * 1e6;
  const bw = B * 1000;
  const Rn = ck.Rn(Mu_nmm, bw, d);
  const rho = ck.rhoRequired(Rn, fc, fy);
  const rho_min = ck.rhoMin(fy, fc);
  const rho_use = Math.max(rho, rho_min);
  const As_req = ck.AsRequired(rho_use, bw, d);
  const a = ck.depthStressBlock(As_req, fy, fc, bw);
  const phiMn = ck.phiMn(As_req, fy, d, a, phi_flex) / 1e6;

  const barOptions = ck.selectBars(As_req / B); // per meter width

  return {
    input: { P_service, M_service, qAll, q_net: qUse.toFixed(1), fc, fy, colB, colH },
    dimensions: {
      B: B.toFixed(1), L: L.toFixed(1), A: A.toFixed(2),
      h, d,
      Df,
      soil_pressure: {
        qMax: qMax.toFixed(2),
        qMin: qMin.toFixed(2),
        qAll: qUse.toFixed(1),
        status: qMax <= qUse && qMin >= 0 ? 'OK' : 'FAIL'
      }
    },
    shear: {
      punching: {
        bo, Vu: ck.kN(Vu_punch * 1000),
        phiVc: ck.kN(0.75 * 0.33 * Math.sqrt(fc) * bo * d * 1000),
        status: 'OK'
      },
      oneWay: {
        Vu: Vu_oneway.toFixed(2), phiVc: phiVc_oneway.toFixed(2),
        status: phiVc_oneway >= Vu_oneway ? 'OK' : 'FAIL'
      }
    },
    flexure: {
      Mu: Mu.toFixed(2),
      Rn: ck.MPa(Rn),
      rho: rho.toFixed(4),
      rho_min: rho_min.toFixed(4),
      rho_use: rho_use.toFixed(4),
      As_req_total: As_req.toFixed(0),
      As_req_per_m: (As_req / B).toFixed(0),
      phiMn: phiMn.toFixed(2),
      bar_options: barOptions
    }
  };
}

function designPileCap(nPiles, P_pile, pileDia, fc, fy, colB, colH) {
  // Simplified: square cap, 3D spacing
  const spacing = 3 * pileDia;
  const edge = 1.5 * pileDia;
  const grid = Math.ceil(Math.sqrt(nPiles));

  const B_cap = (grid - 1) * spacing + 2 * edge;
  const h = 800; // initial
  const d = h - 100;

  // Truss analogy tension
  const colFace = (B_cap - colB / 1000) / 2; // m
  const T = P_pile * nPiles * colFace / (0.85 * d / 1000); // kN
  const As = T * 1000 / (0.9 * fy);

  return {
    dimensions: {
      B: B_cap.toFixed(0), L: B_cap.toFixed(0),
      h, d, pile_spacing: spacing,
      nPiles, grid: `${grid}×${grid}`
    },
    tension: {
      T: T.toFixed(0), As_req: As.toFixed(0),
      bars: ck.selectBars(As)
    }
  };
}

if (require.main === module) {
  const p = parseArgs();
  const P = p.P || 800;
  const M = p.M || 0;
  const qAll = p.qAll || 200;
  const fc = p.fc || 25;
  const fy = p.fy || 400;
  const colB = p.colB || 300;
  const colH = p.colH || 300;
  const mode = p.mode || 'footing';

  if (mode === 'pilecap') {
    const nPiles = p.nPiles || 4;
    const P_pile = p.Ppile || 300;
    const pileDia = p.pileDia || 400;
    const result = designPileCap(nPiles, P_pile, pileDia, fc, fy, colB, colH);
    console.log('=== Pile Cap Design ===\n');
    console.log(`Cap: ${result.dimensions.B}×${result.dimensions.L} mm  |  h=${result.dimensions.h} mm`);
    console.log(`${result.dimensions.nPiles} piles @ ${result.dimensions.pile_spacing} mm spacing`);
    console.log(`Tension tie: T=${result.tension.T} kN  |  As=${result.tension.As_req} mm²`);
    console.log('Bar options:', result.tension.bars.map(b => `${b.count}-${b.size}`).join(' or '));
  } else {
    const result = designSpreadFooting(P, M, qAll, fc, fy, colB, colH);
    console.log('=== Spread Footing Design (ACI 318-19) ===\n');
    console.log(`Column: ${colB}×${colH} mm  |  P=${P} kN  |  M=${M} kN·m`);
    console.log(`q_all = ${qAll} kPa  |  q_net = ${result.input.q_net} kPa`);
    console.log(`\n── Size ──`);
    console.log(`Footing: ${result.dimensions.B}×${result.dimensions.L} m  |  A=${result.dimensions.A} m²`);
    console.log(`h=${result.dimensions.h} mm  |  d=${result.dimensions.d} mm  |  Df=${result.dimensions.Df} m`);
    console.log(`q_max=${result.dimensions.soil_pressure.qMax} kPa  →  ${result.dimensions.soil_pressure.status}`);

    console.log(`\n── Shear ──`);
    console.log(`Punching: Vu=${result.shear.punching.Vu} kN  φVc=${result.shear.punching.phiVc} kN  →  ${result.shear.punching.status}`);
    console.log(`One-way:  Vu=${result.shear.oneWay.Vu} kN  φVc=${result.shear.oneWay.phiVc} kN  →  ${result.shear.oneWay.status}`);

    console.log(`\n── Flexure ──`);
    console.log(`Mu=${result.flexure.Mu} kN·m  |  As_req=${result.flexure.As_req_total} mm² (${result.flexure.As_req_per_m} mm²/m)`);
    console.log('Bar options (per m):');
    for (const opt of result.flexure.bar_options) {
      console.log(`  ${opt.count}-${opt.size} → As=${opt.As.toFixed(0)} mm²`);
    }
  }
}

module.exports = { designSpreadFooting, designPileCap };
