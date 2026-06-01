#!/usr/bin/env node
/**
 * beam-design.js — RC beam flexural + shear design (ACI 318-19 / วสท.)
 * Usage: node scripts/beam-design.js --b=250 --h=500 --Mu=120 --Vu=80 --fc=25 --fy=400 --L=5000
 * Units: b,h in mm | Mu in kN·m | Vu in kN | fc,fy in MPa | L in mm
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

function designBeam(b, h, Mu, Vu, fc, fy, L, cover = 40, lambda = 1.0, seismicZone = null) {
  const phi_flex = 0.9;
  const phi_shear = 0.75;

  // Assume DB20 main bars + DB12 stirrups
  const stirrupDia = 12;
  const barDia = 20;
  const d = h - cover - stirrupDia - barDia / 2;

  // ── Flexure ──
  const Mu_nmm = Mu * 1e6; // kN·m → N·mm
  const Rn = ck.Rn(Mu_nmm, b, d);
  const rho = ck.rhoRequired(Rn, fc, fy);
  const rho_min = ck.rhoMin(fy, fc);
  const rho_max = ck.rhoMax(fc, fy);

  let flexStatus;
  if (rho < 0) {
    flexStatus = 'FAIL — Section too small, increase b or h';
  } else if (rho < rho_min) {
    flexStatus = 'OK (ρ_min governs)';
  } else if (rho > rho_max) {
    flexStatus = 'FAIL — ρ > ρ_max, need compression steel or larger section';
  } else {
    flexStatus = 'OK';
  }

  const rhoUse = Math.max(rho, rho_min);
  const As_req = ck.AsRequired(rhoUse, b, d);
  const a = ck.depthStressBlock(As_req, fy, fc, b);
  const phiMn = ck.phiMn(As_req, fy, d, a, phi_flex) / 1e6; // N·mm → kN·m

  // Reinforcement selection
  const barOptions = ck.selectBars(As_req);

  // ── Shear ──
  const Vu_N = Vu * 1000; // kN → N
  const Vc = ck.Vc(fc, b, d, lambda);
  const phiVc = phi_shear * Vc;
  const Vs_req = ck.VsRequired(Vu_N, phi_shear, Vc);
  const Vs_max = ck.VsMax(fc, b, d);

  let shearStatus, stirrupSize, stirrupSpacing;
  if (Vs_req <= 0) {
    shearStatus = 'OK — Concrete alone sufficient, provide min stirrups';
    stirrupSize = 'DB12';
    stirrupSpacing = Math.min(d / 2, 600);
  } else if (Vs_req > Vs_max) {
    shearStatus = 'FAIL — Vs exceeds maximum, increase section';
    stirrupSize = 'DB12';
    stirrupSpacing = 'N/A';
  } else {
    // 2-leg DB12: Av = 2 × 113.1 = 226.2 mm²
    const Av = 226.2;
    const s_calc = ck.stirrupSpacing(Av, fy, d, Vs_req, b);
    const s_max = ck.stirrupSpacingMax(d, fc, b, Av, fy);
    stirrupSpacing = Math.min(s_calc, s_max);
    stirrupSize = 'DB12';
    shearStatus = 'OK';
  }

  // Seismic hoop spacing (Zone ≥ 2)
  let seismicHoopSpacing = null;
  if (seismicZone && ['2A', '2B', '3', '4'].includes(seismicZone)) {
    const lo = Math.max(h, L / 6, 450); // plastic hinge length
    const s_seis = Math.min(d / 4, 8 * barDia, 24 * stirrupDia, 300);
    seismicHoopSpacing = { lo, s_hoop_zone: s_seis };
  }

  // ── Deflection Check ──
  const L_d_ratio = L / d;
  const L_d_allow = 16; // ACI simplified, continuous beam
  const deflStatus = L_d_ratio <= L_d_allow ? 'OK' : 'Check detailed deflection';

  return {
    input: { b, h, d, Mu, Vu, fc, fy, L, cover },
    flexure: {
      Rn: ck.MPa(Rn), rho, rho_min, rho_max, rho_use: rhoUse,
      As_req, a: a.toFixed(1), phiMn: phiMn.toFixed(2),
      status: flexStatus,
      bar_options: barOptions
    },
    shear: {
      Vu_N, Vc: ck.kN(Vc), phiVc: ck.kN(phiVc),
      Vs_req: ck.kN(Vs_req), Vs_max: ck.kN(Vs_max),
      stirrup: { size: stirrupSize, spacing: Math.floor(stirrupSpacing), legs: 2 },
      status: shearStatus
    },
    deflection: { L_d: L_d_ratio.toFixed(1), L_d_allow, status: deflStatus },
    seismic: seismicHoopSpacing
  };
}

if (require.main === module) {
  const p = parseArgs();
  const b = p.b || 250;
  const h = p.h || 500;
  const Mu = p.Mu || 100;
  const Vu = p.Vu || 80;
  const fc = p.fc || 25;
  const fy = p.fy || 400;
  const L = p.L || 5000;
  const cover = p.cover || 40;
  const zone = p.zone || null;

  const result = designBeam(b, h, Mu, Vu, fc, fy, L, cover, 1.0, zone);

  console.log('=== RC Beam Design (ACI 318-19) ===\n');
  console.log(`Section: ${b}×${h} mm  |  d = ${result.input.d} mm  |  L = ${L} mm`);
  console.log(`Materials: f'c = ${fc} MPa  |  fy = ${fy} MPa\n`);

  console.log('── Flexure ──');
  console.log(`Mu = ${Mu} kN·m  |  Rn = ${result.flexure.Rn} MPa`);
  console.log(`ρ = ${result.flexure.rho.toFixed(4)}  |  ρ_min = ${result.flexure.rho_min.toFixed(4)}  |  ρ_max = ${result.flexure.rho_max.toFixed(4)}`);
  console.log(`As_req = ${result.flexure.As_req.toFixed(0)} mm²  |  a = ${result.flexure.a} mm  |  φMn = ${result.flexure.phiMn} kN·m`);
  console.log(`Status: ${result.flexure.status}`);
  console.log('Bar options:');
  for (const opt of result.flexure.bar_options) {
    console.log(`  ${opt.count}-${opt.size} → As = ${opt.As.toFixed(0)} mm² (ratio ${opt.ratio.toFixed(2)})`);
  }

  console.log('\n── Shear ──');
  console.log(`Vu = ${Vu} kN  |  φVc = ${result.shear.phiVc} kN  |  Vs_req = ${result.shear.Vs_req} kN`);
  console.log(`Vs_max = ${result.shear.Vs_max} kN`);
  console.log(`Stirrups: ${result.shear.stirrup.size} @ ${result.shear.stirrup.spacing} mm (${result.shear.stirrup.legs} legs)`);
  console.log(`Status: ${result.shear.status}`);

  console.log('\n── Deflection ──');
  console.log(`L/d = ${result.deflection.L_d}  |  Allowable = ${result.deflection.L_d_allow}  |  ${result.deflection.status}`);

  if (result.seismic) {
    console.log('\n── Seismic Detailing ──');
    console.log(`Plastic hinge zone lo = ${result.seismic.lo} mm`);
    console.log(`Hoop spacing in lo: ≤ ${result.seismic.s_hoop_zone} mm`);
  }
}

module.exports = { designBeam };
