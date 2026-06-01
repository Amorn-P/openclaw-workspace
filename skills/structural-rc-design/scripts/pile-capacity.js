#!/usr/bin/env node
/**
 * pile-capacity.js — Bored & driven pile capacity from soil data (วสท. / ACI)
 * Usage: node scripts/pile-capacity.js --dia=500 --length=20 --layers="0-5,clay,50;5-12,sand,0,20;12-20,clay,80"
 *   Layer format: depthFrom-depthTo,type,Su_or_N_or_phi
 *   clay: use Su (kPa), sand: use N-SPT
 * Units: dia in mm | length in m | Su in kPa
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const p = {};
  for (const a of args) {
    const m = a.match(/^--(\w+)=(.+)$/);
    if (m) p[m[1]] = m[2];
  }
  return p;
}

function parseLayers(layerStr) {
  // "0-5,clay,50;5-12,sand,0,20;12-20,clay,80"
  const layers = [];
  for (const part of layerStr.split(';')) {
    const [depth, type, su, n_or_phi] = part.split(',');
    const [from, to] = depth.split('-').map(parseFloat);
    layers.push({
      from, to, thickness: to - from,
      type: type.trim(),
      Su: type.trim() === 'clay' ? parseFloat(su) : null,
      N: type.trim() === 'sand' || type.trim() === 'silt' ? parseFloat(n_or_phi) : null,
      phi: type.trim() === 'sand' || type.trim() === 'silt' ? parseFloat(n_or_phi) : null
    });
  }
  return layers;
}

function pileCapacity(dia, length, layers, FS_comp = 2.5, FS_tens = 3.0) {
  // dia: mm, length: m
  const D = dia / 1000; // → m
  const perimeter = Math.PI * D;
  const Ab = Math.PI * D * D / 4; // m²

  // ── End Bearing ──
  const lastLayer = layers[layers.length - 1];
  let Qb = 0;

  if (lastLayer.type === 'clay' && lastLayer.Su) {
    // Qb = Nc × Su × Ab, Nc = 9 for deep foundations
    Qb = 9 * lastLayer.Su * Ab;
  } else if ((lastLayer.type === 'sand' || lastLayer.type === 'silt') && lastLayer.N) {
    // Qb = qb × Ab
    // qb (kPa) = N × K1, K1 varies by method
    // Conservative: qb = 100 × N (kPa) for bored piles, limited to 5000 kPa
    let qb = Math.min(100 * lastLayer.N, 5000);
    // For driven: qb = 200 × N limited to 10000 kPa
    Qb = qb * Ab;
  }

  // ── Skin Friction ──
  let Qs = 0;
  const skinDetail = [];

  for (const layer of layers) {
    const As = perimeter * layer.thickness;
    let fs = 0;

    if (layer.type === 'clay' && layer.Su) {
      // α method: fs = α × Su
      // α ≈ 0.55 for Su/σ'v > 1 (simplified to 0.5 for typical)
      const alpha = layer.Su <= 50 ? 0.9 : layer.Su <= 100 ? 0.7 : 0.5;
      fs = alpha * layer.Su;
    } else if ((layer.type === 'sand' || layer.type === 'silt') && layer.N) {
      // simplified: fs = 2 × N (kPa) — conservative for bored piles
      fs = Math.min(2 * layer.N, 120);
    }

    const QsLayer = fs * As;
    Qs += QsLayer;
    skinDetail.push({
      from: layer.from, to: layer.to,
      type: layer.type, Su: layer.Su, N: layer.N,
      fs: fs.toFixed(1),
      As: As.toFixed(2),
      Qs: QsLayer.toFixed(1)
    });
  }

  const Qu = Qb + Qs;
  const Qall_comp = Qu / FS_comp;
  const Qall_tens = Qs * 0.7 / FS_tens; // uplift: typically 70% of skin friction

  // ── Structural Capacity ──
  const Ag = Math.PI * dia * dia / 4; // mm²
  const fc = 25; // assumed
  const fy = 400;
  const As_min = 0.005 * Ag;
  const Pn_structural = 0.85 * fc * (Ag - As_min) + fy * As_min; // N
  const Pallow_structural = 0.4 * fc * Ag; // simplified, in N

  return {
    pile: { dia, length, perimeter: perimeter.toFixed(2), Ab: Ab.toFixed(4), Ag },
    endBearing: { type: lastLayer.type, Qb: Qb.toFixed(1), percent: (Qb / Qu * 100).toFixed(0) },
    skinFriction: {
      Qs: Qs.toFixed(1),
      percent: (Qs / Qu * 100).toFixed(0),
      layers: skinDetail
    },
    capacity: {
      Qu: Qu.toFixed(1),
      Qall_comp: Qall_comp.toFixed(1),
      Qall_tens: Qall_tens.toFixed(1),
      FS_comp, FS_tens,
      structural_allow: (Pallow_structural / 1000).toFixed(0)
    },
    summary: `Qu=${Qu.toFixed(0)} kN → Qall_comp=${Qall_comp.toFixed(0)} kN (FS=${FS_comp}), Qall_tens=${Qall_tens.toFixed(0)} kN`
  };
}

function pileGroupCheck(nPiles, Qall_single, D, spacing, pileCapWeight, Pu_total) {
  // spacing typically 3D
  const s = spacing || 3 * D;

  // Converse-Labarre group efficiency
  const theta = Math.atan(D / s) * 180 / Math.PI;
  const rows = Math.ceil(Math.sqrt(nPiles));
  const cols = Math.ceil(nPiles / rows);
  const eta = 1 - (theta / 90) * ((rows * (cols - 1) + cols * (rows - 1)) / (rows * cols));

  const Qgroup = eta * nPiles * Qall_single;
  const P_effective = Pu_total + pileCapWeight;
  const utilization = P_effective / Qgroup;

  return {
    nPiles, rows, cols, spacing: s,
    eta: eta.toFixed(3),
    Qgroup: Qgroup.toFixed(1),
    Pu: Pu_total.toFixed(0),
    P_with_cap: P_effective.toFixed(0),
    utilization: utilization.toFixed(3),
    status: utilization <= 1.0 ? 'OK' : 'FAIL — Add more piles'
  };
}

if (require.main === module) {
  const p = parseArgs();
  const dia = parseFloat(p.dia) || 500;
  const length = parseFloat(p.length) || 20;
  const layers = p.layers ? parseLayers(p.layers) : [
    { from: 0, to: 5, thickness: 5, type: 'clay', Su: 50, N: null, phi: null },
    { from: 5, to: 12, thickness: 7, type: 'sand', Su: null, N: 20, phi: 32 },
    { from: 12, to: 20, thickness: 8, type: 'clay', Su: 80, N: null, phi: null }
  ];
  const FS_comp = parseFloat(p.FS) || 2.5;

  const result = pileCapacity(dia, length, layers, FS_comp);

  console.log('=== Pile Capacity Calculation ===\n');
  console.log(`Pile: Ø${dia} mm  |  Length: ${length} m`);
  console.log(`Perimeter: ${result.pile.perimeter} m  |  Base Area: ${result.pile.Ab} m²\n`);

  console.log('── Soil Layers & Skin Friction ──');
  console.log('Depth(m)   | Type  | Su/N   | fs(kPa) | As(m²)  | Qs(kN)');
  console.log('-----------|-------|--------|---------|---------|--------');
  for (const l of result.skinFriction.layers) {
    const suN = l.type === 'clay' ? `Su=${l.Su}` : `N=${l.N}`;
    console.log(`${String(l.from).padEnd(4)}–${String(l.to).padEnd(4)} | ${l.type.padEnd(5)} | ${suN.padEnd(6)} | ${l.fs.padEnd(7)} | ${l.As.padEnd(7)} | ${l.Qs}`);
  }

  console.log(`\n── Capacity Summary ──`);
  console.log(`End Bearing (${result.endBearing.type}): Qb = ${result.endBearing.Qb} kN (${result.endBearing.percent}%)`);
  console.log(`Skin Friction: Qs = ${result.skinFriction.Qs} kN (${result.skinFriction.percent}%)`);
  console.log(`Ultimate: Qu = ${result.capacity.Qu} kN`);
  console.log(`Allowable (comp): Qall = ${result.capacity.Qall_comp} kN (FS=${FS_comp})`);
  console.log(`Allowable (tension): Qall = ${result.capacity.Qall_tens} kN (FS=3.0)`);
  console.log(`Structural limit: ≈ ${result.capacity.structural_allow} kN (0.4f'c×Ag)`);

  if (p.nPiles && p.Pu) {
    const nPiles = parseInt(p.nPiles);
    const Pu = parseFloat(p.Pu);
    const spacing = parseFloat(p.spacing) || 3 * (dia / 1000);
    const pcw = parseFloat(p.capWeight) || Pu * 0.05;
    const group = pileGroupCheck(nPiles, parseFloat(result.capacity.Qall_comp), dia / 1000, spacing, pcw, Pu);
    console.log(`\n── Pile Group Check ──`);
    console.log(`${nPiles} piles, spacing=${spacing}m  |  η=${group.eta}`);
    console.log(`Qgroup=${group.Qgroup} kN  vs  P_total=${group.P_with_cap} kN  |  Utilization=${group.utilization}`);
    console.log(`Status: ${group.status}`);
  }
}

module.exports = { pileCapacity, pileGroupCheck, parseLayers };
