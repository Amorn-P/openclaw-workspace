# Reference: วสท. (EIT Standard) — Thai Building Code

## Key Standards Referenced

| Standard | Title | Coverage |
|----------|-------|----------|
| วสท. 1007 | Live Loads | Occupancy load tables |
| วสท. 1008 | Reinforced Concrete | Design of RC structures |
| วสท. 1301 | Seismic Resistance Design | Seismic provisions |
| วสท. 1302 | Seismic Hazard Maps | Zone maps for Thailand |
| มยผ. 1101 | DPT Standard RC Building | Ministry specification |

## Live Loads — วสท. 1007

| Occupancy | LL (kN/m²) |
|-----------|-------------|
| Residential — private rooms | 2.0 |
| Residential — corridors | 2.0 |
| Office — general | 2.5 |
| Office — lobbies, corridors | 4.0 |
| Commercial — retail | 4.0–5.0 |
| Stairs | 4.0–5.0 |
| Flat roof (accessible) | 2.0 |
| Flat roof (maintenance only) | 1.0–1.5 |
| Warehouse — light | 6.0 |
| Parking — passenger cars | 2.5 |

## Load Combinations — วสท. 1008

| Combo | Formula | Use |
|-------|---------|-----|
| U1 | 1.4DL | Gravity only |
| U2 | 1.2DL + 1.6LL | Gravity dominant |
| U3 | 1.2DL + 1.0LL ± 1.0E | Seismic |
| U4 | 0.9DL ± 1.0E | Uplift |
| U5 | 1.2DL + 1.3LL + 1.3W | Wind |
| U6 | 1.2DL + 1.0LL + 1.3E | Alt. seismic |

## Seismic Zones — วสท. 1302

| Zone | PGA (g) | Regions |
|------|---------|---------|
| 1 | 0.03–0.05 | Northeast plateau (Khorat) |
| 2A | 0.08–0.10 | Central plains, Bangkok area |
| 2B | 0.15–0.20 | Northern provinces, Kanchanaburi |
| 3 | 0.25–0.35 | Western mountains, Tak, Mae Hong Son |
| 4 | 0.40–0.50 | Near active faults (Kanchanaburi Fault, Three Pagodas) |

## Seismic Design — Equivalent Lateral Force

Base Shear:
```
V = Cs × W
Cs = SDS / (R/Ie)
Cs ≤ SD1 / (T × R/Ie)
Cs ≥ 0.044 × SDS × Ie (≥ 0.01)
```

Approximate Period:
```
Ta = 0.02 × H^0.75        (generic)
Ta = 0.0466 × H^0.9       (RC moment frame)
```

## R Factors (วสท./DPT)

| Structural System | R |
|-------------------|---|
| Ordinary RC moment frame | 3 |
| Intermediate RC moment frame | 5 |
| Special RC moment frame | 8 |
| Ordinary RC shear wall | 4 |
| Dual system (frame + wall) | 6.5 |
| Steel braced frame | 5–8 |

## Key Differences: วสท. vs ACI 318

| Item | วสท. 1008 | ACI 318 |
|------|-----------|---------|
| Basis | Adapted from ACI 318 + local calibration | US standard |
| Concrete grades | C18, C20, C25, C28, C30, C35 | 2500–8000 psi |
| Rebar grades | SD30 (300 MPa), SD40 (400 MPa) | Grade 40–80 |
| Seismic referencing | วสท. 1301/1302 | ASCE 7 |
| Cover for slabs | 20 mm (interior) | 20 mm (interior) |
| Cover for beams/columns | 40 mm | 40 mm |
| Strip footing min | 200 mm thick | 200 mm |
| Pile design | วสท. 1013 (separate) | N/A |

## Typical Thai Construction Practices

- Most 3-storey buildings use beam-column frame with RC slabs
- Concrete grade: C25 (25 MPa) is standard; C28–C30 for columns
- Rebar: SD40 is standard; SD30 still used for stirrups
- Foundations: bored piles Ø0.35–0.60m common in Bangkok (soft clay)
- Seismic: for Bangkok area (Zone 2A), ordinary moment frame (R=3) suffices for low-rise
- Brick infill walls typically treated as non-structural partitions
