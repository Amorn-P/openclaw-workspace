#!/usr/bin/env node
/**
 * slab-design.js — One-way & two-way RC slab design (ACI 318-19 / วสท.)
 * Usage: node scripts/slab-design.js --Lx=4000 --Ly=5000 --DL=5.0 --LL=2.0 --fc=25 --fy=400
 * Units: Lx,Ly in mm | DL,LL in kN/m² | fc,fy in MPa
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

function slabType(Lx, Ly) {
  const ratio = Math.max(Lx, Ly) / Math.min(Lx, Ly);
  return { type: ratio > 2 ? 'one-way' : 'two-way', ratio: ratio.toFixed(2) };
}

function minThickness(Ln, type, fy) {
  // ACI Table 7.3.1.1 — min thickness for slabs without drop panels
  // Ln = clear span (≈ center-to-center for preliminary)
  if (type === 'one-way') {
    // Simply supported: L/20, one end cont: L/24, both ends cont: L/28, cantilever: L/10
    return {
      simply_supported: Math.ceil(Ln / 20),
      one_end_cont: Math.ceil(Ln / 24),
      both_ends_cont: Math.ceil(Ln / 28),
      cantilever: Math.ceil(Ln / 10)
    };
  }
  // Two-way slab: Ln/30 to Ln/33 (ACI 8.3.1.1 simplified)
  return { two_way: Math.ceil(Ln / 30) };
}

function designOneWaySlab(h, L, DL, LL, fc, fy, cover = 20) {
  // One-way slab: design per 1m strip
  const b = 1000; // mm
  const d = h - cover - 6; // DB12 assumed, db/2=6mm
  const phi = 0.9;

  // Load
  const DL_slab = h / 1000 * 24; // kN/m² self-weight
  const w = 1.4 * (DL + DL_slab) + 1.6 * LL; // factored load per m strip
  const w_service = DL + DL_slab + LL;

  // Moment coefficients (ACI 6.5.2, continuous one-way slab)
  // w × Ln² / coefficient
  const Ln = L - 0.2; // approximate clear span (200mm support)
  const moments = {
    M_neg_ext: w * Ln * Ln / 24,  // exterior negative
    M_pos_end: w * Ln * Ln / 14,  // end span positive
    M_neg_int: w * Ln * Ln / 10,  // first interior negative
    M_pos_int: w * Ln * Ln / 16,  // interior positive
  };

  // Design for maximum moment
  const Mu = Math.max(...Object.values(moments));

  const Rn = ck.Rn(Mu * 1e6, b, d);
  const rho = ck.rhoRequired(Rn, fc, fy);
  const rho_min = ck.rhoMin(fy, fc);
  const rho_use = Math.max(rho, rho_min);
  const As_req = ck.AsRequired(rho_use, b, d);
  const a = ck.depthStressBlock(As_req, fy, fc, b);
  const phiMn = ck.phiMn(As_req, fy, d, a, phi) / 1e6;

  // T&S rebar (ACI 24.4.3.2)
  const As_shrink = fy >= 420 ? 0.0018 * b * h : 0.0020 * b * h;

  // Select bars
  const barOptions = ck.selectBars(As_req);
  const spacing = (barArea, As_req_per_m) => Math.floor(barArea / As_req_per_m * 1000);

  // Shear check
  const Vu = w * Ln / 2; // kN/m
  const Vc = ck.Vc(fc, b, d, 1.0) / 1000; // kN
  const phiVc = 0.75 * Vc;

  // Deflection: L/d check
  const L_d = Ln * 1000 / d;

  return {
    slab_type: 'one-way',
    h, d, b_strip: b,
    DL_slab: DL_slab.toFixed(2),
    w_factored: w.toFixed(2),
    w_service: w_service.toFixed(2),
    moments: Object.fromEntries(Object.entries(moments).map(([k, v]) => [k, v.toFixed(2)])),
    design: {
      Mu_max: Mu.toFixed(2),
      Rn: ck.MPa(Rn),
      rho: rho.toFixed(4),
      rho_min: rho_min.toFixed(4),
      rho_use: rho_use.toFixed(4),
      As_req: As_req.toFixed(0),
      a: a.toFixed(1),
      phiMn: phiMn.toFixed(2),
      bar_options: barOptions,
      As_shrink: As_shrink.toFixed(0)
    },
    shear: {
      Vu: Vu.toFixed(2),
      phiVc: phiVc.toFixed(2),
      status: phiVc >= Vu ? 'OK' : 'FAIL — Increase thickness'
    },
    deflection: {
      L_d: L_d.toFixed(1),
      L_d_allow: 24,
      status: L_d <= 24 ? 'OK' : 'Check detailed'
    }
  };
}

function designTwoWaySlab(h, Lx, Ly, DL, LL, fc, fy, cover = 20) {
  // Two-way slab — Direct Design Method (ACI 8.10)
  const b = 1000;
  const d_short = h - cover - 6; // short direction
  const d_long = d_short - 12; // long direction
  const phi = 0.9;

  const DL_slab = h / 1000 * 24;
  const w = 1.2 * (DL + DL_slab) + 1.6 * LL;
  const w_service = DL + DL_slab + LL;
  const Ln = Math.min(Lx, Ly) / 1000; // shorter clear span (m)

  // Panel ratio
  const panelRatio = Math.max(Lx, Ly) / Math.min(Lx, Ly);

  // Moment coefficients for interior panel (ACI simplified)
  // Mo = w × L2 × Ln² / 8 (total static moment)
  const L2 = Math.max(Lx, Ly) / 1000; // longer span
  const Mo = w * L2 * Ln * Ln / 8;

  // Distribution (interior panel)
  const M_neg = 0.65 * Mo;
  const M_pos = 0.35 * Mo;

  // Column strip vs middle strip (short direction)
  const colStripFrac = panelRatio <= 1.5 ? 0.75 : 0.60;
  const midStripFrac = 1 - colStripFrac;

  const Mu = M_neg; // design for max

  const Rn = ck.Rn(Mu * 1e6, b, d_short);
  const rho = ck.rhoRequired(Rn, fc, fy);
  const rho_min = ck.rhoMin(fy, fc);
  const rho_use = Math.max(rho, rho_min);
  const As_req = ck.AsRequired(rho_use, b, d_short);
  const a = ck.depthStressBlock(As_req, fy, fc, b);
  const phiMn = ck.phiMn(As_req, fy, d_short, a, phi) / 1e6;

  const As_shrink = fy >= 420 ? 0.0018 * b * h : 0.0020 * b * h;
  const barOptions = ck.selectBars(As_req);

  return {
    slab_type: 'two-way',
    h, d_short, d_long, b_strip: b,
    DL_slab: DL_slab.toFixed(2),
    w_factored: w.toFixed(2),
    Mo: Mo.toFixed(2),
    moments: {
      M_neg_total: M_neg.toFixed(2),
      M_pos_total: M_pos.toFixed(2),
      col_strip_percent: `${(colStripFrac * 100).toFixed(0)}%`,
      mid_strip_percent: `${(midStripFrac * 100).toFixed(0)}%`
    },
    design: {
      Mu_max: Mu.toFixed(2),
      Rn: ck.MPa(Rn),
      rho: rho.toFixed(4),
      rho_min: rho_min.toFixed(4),
      rho_use: rho_use.toFixed(4),
      As_req: As_req.toFixed(0),
      a: a.toFixed(1),
      phiMn: phiMn.toFixed(2),
      bar_options: barOptions,
      As_shrink: As_shrink.toFixed(0)
    }
  };
}

if (require.main === module) {
  const p = parseArgs();
  const Lx = p.Lx || 4000;
  const Ly = p.Ly || 5000;
  const DL = p.DL || 5.0;
  const LL = p.LL || 2.0;
  const fc = p.fc || 25;
  const fy = p.fy || 400;
  const h = p.h || null;

  const { type } = slabType(Lx, Ly);
  const Ln = Math.min(Lx, Ly); // shorter span
  const thicknesses = minThickness(Ln, type, fy);
  const hUse = h || (type === 'one-way' ? thicknesses.both_ends_cont : thicknesses.two_way);

  console.log(`=== RC Slab Design (ACI 318-19) ===\n`);
  console.log(`Span: Lx=${Lx}mm  Ly=${Ly}mm  |  Type: ${type}`);
  console.log(`Recommended thickness: ${type === 'one-way' ? `${thicknesses.both_ends_cont} mm (both ends continuous)` : `${thicknesses.two_way} mm (two-way)`}`);
  console.log(`Used: h = ${hUse} mm\n`);

  let result;
  if (type === 'one-way') {
    result = designOneWaySlab(hUse, Math.max(Lx, Ly), DL, LL, fc, fy);
    printOneWay(result);
  } else {
    result = designTwoWaySlab(hUse, Lx, Ly, DL, LL, fc, fy);
    printTwoWay(result);
  }
}

function printOneWay(r) {
  console.log(`Slab self-weight: ${r.DL_slab} kN/m²`);
  console.log(`Factored load w_u: ${r.w_factored} kN/m²`);
  console.log(`\nMoments (kN·m/m):`, r.moments);
  console.log(`\n── Design (max moment) ──`);
  console.log(`Mu = ${r.design.Mu_max} kN·m/m  |  Rn = ${r.design.Rn} MPa`);
  console.log(`ρ = ${r.design.rho}  |  ρ_min = ${r.design.rho_min}`);
  console.log(`As_req = ${r.design.As_req} mm²/m  |  a = ${r.design.a} mm  |  φMn = ${r.design.phiMn} kN·m/m`);
  console.log(`T&S: ${r.design.As_shrink} mm²/m`);
  console.log('Bar options:');
  for (const opt of r.design.bar_options) {
    const s = Math.floor(ck.barArea(opt.size, 1) / (r.design.As_req / 1000) * 1000);
    console.log(`  ${opt.count}-${opt.size} → As=${opt.As.toFixed(0)} mm²/m, spacing ≈ ${s} mm`);
  }
  console.log(`\nShear: Vu=${r.shear.Vu} kN  φVc=${r.shear.phiVc} kN → ${r.shear.status}`);
  console.log(`Deflection: L/d=${r.deflection.L_d} → ${r.deflection.status}`);
}

function printTwoWay(r) {
  console.log(`Slab self-weight: ${r.DL_slab} kN/m²`);
  console.log(`Factored load w_u: ${r.w_factored} kN/m²`);
  console.log(`Total static moment Mo: ${r.Mo} kN·m`);
  console.log(`Distribution:`, r.moments);
  console.log(`\n── Design (short direction, max moment) ──`);
  console.log(`Mu = ${r.design.Mu_max} kN·m/m  |  Rn = ${r.design.Rn} MPa`);
  console.log(`ρ = ${r.design.rho}  |  ρ_min = ${r.design.rho_min}`);
  console.log(`As_req = ${r.design.As_req} mm²/m  |  a = ${r.design.a} mm  |  φMn = ${r.design.phiMn} kN·m/m`);
  console.log(`T&S: ${r.design.As_shrink} mm²/m`);
  console.log('Bar options:');
  for (const opt of r.design.bar_options) {
    const s = Math.floor(ck.barArea(opt.size, 1) / (r.design.As_req / 1000) * 1000);
    console.log(`  ${opt.count}-${opt.size} → As=${opt.As.toFixed(0)} mm²/m, spacing ≈ ${s} mm`);
  }
}

module.exports = { slabType, minThickness, designOneWaySlab, designTwoWaySlab };
