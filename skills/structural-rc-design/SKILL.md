---
name: structural-rc-design
description: "Reinforced concrete building design with code checks (วสท./ACI 318)"
---

# RC Building Structural Design (3 Storeys)

Interactive reinforced concrete design for low-rise buildings (≤3 storeys) to วสท. (EIT Standard) and ACI 318-19.
Covers slabs, beams, columns, footings, piles, steel elements, and seismic provisions.

## Core Rules

- One step at a time. Present → calculate → code-check → user **confirms** → next step.
- Use checkbox-style options for discrete choices (slab type, rebar grade, concrete class).
- Use fill-in parameters for numbers (span, load, bearing capacity).
- Always show pass/fail result against code limits with safety factors.
- When a check fails, pause and offer alternatives (increase size, add rebar, change grade).
- Run calculation scripts from `scripts/` for deterministic verification. Show script output.
- Load reference docs from `references/` only when a code clause needs citing.
- All output in **English**. Use SI units (mm, kN, MPa, kN-m).

## Workflow

### Step 1 — Project Setup

Ask the user:

```
**🏗️ Project Setup**

1. Building use: [ ] Residential  [ ] Office  [ ] Commercial  [ ] Other: ___
2. Number of storeys: ___ (max 3)
3. Typical storey height (m): ___
4. Grid spacing — X-direction bays (m): ___ , count: ___
5. Grid spacing — Y-direction bays (m): ___ , count: ___
6. Soil type (for seismic): [ ] A (Hard rock)  [ ] B (Rock)  [ ] C (Dense soil)  [ ] D (Stiff soil)  [ ] E (Soft soil)
7. Seismic zone (Thailand): [ ] 1 (low)  [ ] 2A  [ ] 2B  [ ] 3  [ ] 4 (high)
8. Wind speed (m/s) or zone: ___ (default 25 for Thailand)
```

Confirm the building layout summary before proceeding.

### Step 2 — Material Properties

Present checkboxes and inputs:

```
**🧱 Material Properties**

Concrete:
  [ ] C20 (f'c=20 MPa)  [ ] C25 (25 MPa)  [ ] C28 (28 MPa)  [ ] C30 (30 MPa)
  [ ] C35 (35 MPa)      [ ] Other: f'c = ___ MPa
  [ ] Normal weight (2400 kg/m³)

Rebar (longitudinal):
  [ ] SD30 (fy=300 MPa)  [ ] SD40 (fy=400 MPa)  [ ] SD50 (fy=500 MPa)

Rebar (shear/stirrups):
  [ ] SD30  [ ] SD40  [ ] RB24 (fy=240 MPa, plain round)

Structural steel (if mixed):
  [ ] SS400 (fy=245 MPa)  [ ] SM490 (fy=325 MPa)  [ ] Other: fy = ___ MPa
```

Confirm selections. Show: φ factors per code, ρ_min for each grade, modulus of elasticity.

### Step 3 — Load Calculation

Compute loads in this order. Present table for confirmation at each sub-step.

**3a. Dead Load (DL)**
- Slab self-weight: thickness × 24 kN/m³
- Floor finish: 1.0–1.5 kN/m² (user confirms)
- Partition walls: 1.0–3.0 kN/m² (user confirms)
- Beam self-weight: section × 24 kN/m³
- Column self-weight: section × 24 kN/m³ × height
- Roof: 1.5–2.5 kN/m² (user confirms)

**3b. Live Load (LL)** — per วสท. 1007 / ASCE 7 Table 4-1
```
[ ] Residential: 2.0 kN/m²
[ ] Office: 2.5 kN/m²
[ ] Corridors/Stairs: 4.0 kN/m²
[ ] Roof (flat): 1.0–1.5 kN/m²
[ ] Other: ___ kN/m²
```

**3c. Seismic Load (E)** — Equivalent Lateral Force (วสท. 1301/1302 or ASCE 7)
- Calculate building weight W at each level
- Base shear: V = Cs × W
- Cs = SDS / (R/Ie), with limits
- Seismic weight = DL + 0.25LL (storage) or DL + partition (residential)
- Distribute story forces per Fx = (wx × hx^k / Σ wi × hi^k) × V
- T_a = 0.02 × H^0.75 (approximate period, reinforced concrete moment frame)
- SDS, SD1 from zone and soil type (lookup table from วสท. 1302)

**3d. Load Combinations** (ACI 318-19 Table 5.3.1 / วสท.)
| Combo | Formula |
|-------|---------|
| U1 | 1.4DL |
| U2 | 1.2DL + 1.6LL |
| U3 | 1.2DL + 1.0LL ± 1.0E |
| U4 | 0.9DL ± 1.0E |

For วสท., also check:
| Combo | Formula |
|-------|---------|
| U5 | 1.2DL + 1.3LL + 1.3W (if wind governs) |
| U6 | 1.2DL + 1.0LL + 1.3E (alternative seismic) |

### Step 4 — Preliminary Sizing

Before detailed design, estimate member sizes per code minima and rule-of-thumb:

| Member | Rule of Thumb | Code Minimum |
|--------|---------------|--------------|
| Slab thickness | L/28 (two-way), L/24 (one-way) | 125 mm (ACI Table 7.3.1.1) |
| Beam depth | L/10 to L/12 | 200 mm wide min |
| Beam width | 0.3–0.5 × depth | — |
| Column (interior) | Pu / (0.4 f'c Ag) → Ag | 200 × 200 mm min |
| Footing thickness | 300–500 mm typical | 150 mm above piles |

Present preliminary sizes. User adjusts or confirms.

### Step 5 — Slab Design

Present checkbox for slab type per bay:

```
[ ] One-way slab (Ly/Lx > 2)
[ ] Two-way slab (Ly/Lx ≤ 2)
[ ] Flat slab (no beams)
[ ] Ribbed slab
```

For each slab panel:
1. Calculate effective depth: d = h − cover − db/2 (cover ≥ 20 mm per วสท.)
2. Compute Mu from moment coefficients (ACI Table 6.5.2 for one-way; ACI 13.6 for two-way — direct design method)
3. Compute required As = Mu / (φ × fy × jd), where jd ≈ 0.9d
4. Check As_min = ρ_min × b × h  (ρ_min = 0.0018 for SD40, 0.0020 for SD30)
5. Select bar size and spacing: s ≤ min(3h, 450 mm) for main bars
6. Check deflection (no detailed calc needed if L/d ratio met)
7. Check shear: φVc = 0.75 × 0.17λ√f'c × bw × d

Present per panel:
- Slab thickness, bar size, spacing, As provided vs As required
- Pass/fail for flexure, shear, deflection, min rebar
- User confirms each panel

### Step 6 — Beam Design

For each beam span:

**6a. Analysis**
- Compute Mu (factored) and Vu at critical sections
- For continuous beams: use ACI moment coefficients (ACI 6.5) or request user to provide moments from frame analysis
- Seismic: check beam moments from load combo U3, U4

**6b. Flexural Design**
1. Assume single layer: d = h − cover − stirrup − db/2
2. Rn = Mu / (φ × b × d²)
3. ρ = (0.85 f'c / fy) × (1 − √(1 − 2Rn/(0.85 f'c)))
4. Check ρ_min ≤ ρ ≤ ρ_max
   - ρ_max = 0.75ρ_b (tension-controlled) or 0.025 for SD40
   - If ρ > ρ_max → increase section or use double reinforcement
5. As = ρ × b × d
6. Select bars, check layer fit in b_w

**6c. Shear Design**
1. Vu at distance d from face of support
2. φVc = φ × 0.17λ√f'c × bw × d  (φ=0.75)
3. If Vu > φVc → provide stirrups
4. Vs_req = (Vu − φVc)/φ
5. Check Vs_max = 0.66√f'c × bw × d
6. s = Av × fy × d / Vs_req ≤ min(d/2, 600 mm)
7. For seismic: first hoop at 50 mm from face; spacing ≤ min(d/4, 8db_min, 24db_stirrup, 300 mm) over 2h from face

Present per beam:
- b×h, As_top, As_bot, stirrup size & spacing
- Pass/fail for flexure, shear, deflection, code limits
- Special seismic detailing if zone ≥ 2

### Step 7 — Column Design

For each column at ground floor (worst case):

**7a. Axial Load**
- Tributary area from all floors × (DL + factored LL)
- Add beam reactions, self-weight
- Pu = max from load combos

**7b. Moment**
- From frame analysis or simplified: Mu = Pu × e_min where e_min = max(15 + 0.03h, 20 mm)
- For seismic: amplified moment per combo U3/U4

**7c. Check Slenderness**
- k = 1.0 (braced, standard), 2.0 (unbraced)
- kLu/r ≤ 22 → short column (ignore slenderness)
- kLu/r > 22 → moment magnification per ACI 6.6.4

**7d. Axial-Moment Interaction**
1. Try section: b × h
2. Assume rebar ratio ρ_g = 1%–3%
3. Ast = ρ_g × Ag
4. φPn_max = 0.80 × φ × [0.85 f'c (Ag − Ast) + fy × Ast]  (φ = 0.65 tied, 0.70 spiral)
5. Check if Pu < φPn_max → OK
6. For moment interaction, use simplified bilinear approach or run `scripts/column-design.js`
7. Check: 1% ≤ ρ_g ≤ 6% (practical), code: 1% ≤ ρ_g ≤ 8%

**7e. Shear in Column**
- Ve from seismic (capacity-based): Ve = (M_pr_top + M_pr_bot) / Lu
- Or: Vu from analysis
- φVc same as beam; provide ties per seismic requirements

**7f. Seismic Detailing (Zone ≥ 2)**
- Tie spacing ≤ min(b_min/4, 6db_min, s_o = 100 + (350 − hx)/3, 150 mm) over lo
- lo ≥ max(h, Lu/6, 450 mm)
- Tie spacing outside lo: ≤ min(6db_main, 150 mm)

Present per column:
- Section, rebar (bars + layout), tie size & spacing
- φPn, φMn, Pu, Mu, utilization ratio
- Pass/fail slenderness, axial capacity, moment interaction
- Seismic detailing summary

### Step 8 — Foundation Design

**8a. Soil/Geotechnical Input**
```
Bearing capacity:
  [ ] Known: q_all = ___ kPa  (from soil report)
  [ ] Estimate: [ ] Soft clay (50 kPa)  [ ] Medium clay (100 kPa)
                [ ] Stiff clay (200 kPa)  [ ] Dense sand (300 kPa)
                [ ] Very dense sand/Gravel (500 kPa)

Pile capacity (if using piles):
  [ ] Known per pile: ___ kN  (from load test / soil report)
  [ ] Calculate from soil layers (enter layers below)

Water table depth (m): ___
```

**8b. Spread Footing** — if bearing capacity adequate

1. Required area: A = Pu_serv / q_all
2. Choose dimensions B × L
3. Check soil pressure: q_max = P/A + M/S ≤ q_all
4. Depth from punching shear: d ≥ Vu / (φ × 0.33√f'c × bo) where bo = perimeter at d/2
5. Depth from one-way shear: d ≥ Vu / (φ × 0.17√f'c × B)
6. Flexural rebar: Mu at face of column, As as beam
7. Rebar both directions, check development length
8. Min thickness: 300 mm (soil), 150 mm above pile cap

**8c. Pile Foundation** — if using piles

1. Pile type: [ ] Bored pile (Ø0.35–1.50m)  [ ] Driven pile (Ø0.20–0.60m)  [ ] Micro pile
2. Enter soil layer data: thickness, N-SPT or Su, soil type per layer
3. Calculate:
   - End bearing capacity: Qb = qb × Ab
     - Sand: qb = Nq × σ'v (limited to 10.7 MPa for driven)
     - Clay: qb = Nc × Su  (Nc ≈ 9)
   - Skin friction: Qs = Σ (fs × perimeter × thickness)
     - Sand: fs = β × σ'v  or  fs = N_SPT × 2 kPa (conservative)
     - Clay: fs = α × Su
   - Ultimate: Qu = Qb + Qs
   - Allowable: Qall = Qu / FS  (FS = 2.5 for compression, 3.0 for tension)
4. Number of piles: n = P_service / Qall; round up
5. Pile layout: spacing ≥ 3D (center-to-center), edge distance ≥ D
6. Group efficiency: η = 0.7–1.0 (formula from Converse-Labarre or Feld's rule)
7. Group capacity: Qgroup = η × n × Qall ≥ P_service
8. Check both compression and uplift (from seismic)

**8d. Pile Cap Design**
1. Dimension: covering all piles with edge distance ≥ 150 mm or D/2
2. Depth from pile punching shear
3. Flexure: Mu from pile reactions
4. Tension ties (truss analogy) per ACI 318-19 §13

### Step 9 — Steel Elements (if mixed structure)

If the building uses steel beams/columns or steel roof truss:

1. Section selection from Thai steel tables (SS400, SM490)
2. Flexure: Mn = Zx × fy, φMn ≥ Mu  (φ = 0.9)
3. Shear: Vn = 0.6fy × Aw, φVn ≥ Vu  (φ = 0.9)
4. Compression: Pn = Fcr × Ag, buckling curve per AISC
5. Connections: bolt shear/bearing, weld strength
6. Deflection: Δ ≤ L/240 (LL), L/180 (total)

### Step 10 — Temporary Works

Brief checks for construction stage:

1. **Formwork**: plywood thickness 15–21 mm, joist spacing ≤ 600 mm, stringer spacing ≤ 1200 mm
2. **Shoring**: load per leg ≤ 20 kN (adjustable steel props typical)
3. **Reshoring**: check slab strength at striking (≥ 70% f'c typically)
4. **Construction loads**: 2.5 kN/m² or actual (concrete placement)
5. Present checklist, not full design unless user requests detail

### Step 11 — Design Summary

Generate final report with:

- Building summary (grid, storeys, use)
- Code standard and safety factors applied
- Element-by-element design results table
- Pass/fail summary for all code checks
- Material quantities (optional: approximate concrete m³, rebar kg)
- Warnings and recommendations
- Seismic design basis

Format using `assets/design-report.md` template.

---

## Safety Factors Quick Reference

| Item | φ Factor | Source |
|------|----------|--------|
| Flexure (tension-controlled) | 0.90 | ACI 21.2.2 |
| Flexure (compression-controlled) | 0.65 | ACI 21.2.2 |
| Shear | 0.75 | ACI 21.2.2 |
| Axial compression (tied) | 0.65 | ACI 21.2.2 |
| Axial compression (spiral) | 0.70 | ACI 21.2.2 |
| Bearing (concrete) | 0.65 | ACI 21.2.2 |
| Soil bearing (spread footing) | FS = 2.5–3.0 | Geotechnical |
| Pile compression | FS = 2.5 | Geotechnical |
| Pile uplift | FS = 3.0 | Geotechnical |
| Steel flexure | 0.90 | AISC |
| Steel compression | 0.90 | AISC |
| Steel shear | 0.90 | AISC |

## Seismic Parameters (Thailand — วสท. 1302)

| Zone | SDS (short) | SD1 (1-sec) | Description |
|------|-------------|-------------|-------------|
| 1 | 0.08–0.15g | 0.04–0.07g | Very low |
| 2A | 0.20–0.30g | 0.10–0.15g | Low |
| 2B | 0.35–0.50g | 0.18–0.25g | Moderate |
| 3 | 0.55–0.75g | 0.28–0.38g | High |
| 4 | 0.80–1.00g | 0.40–0.50g | Very high |

R (response modification): 3 (ordinary RC moment frame), 5 (intermediate), 8 (special)
Ie (importance factor): 1.0 (standard), 1.25 (essential), 1.5 (critical)
