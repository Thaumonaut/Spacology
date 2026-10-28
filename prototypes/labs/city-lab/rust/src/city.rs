//! CityModel.generate/validate: deterministic topology, not BuildingPlan's room planner.
//! All XZ fitting is independent of terrain. Hashes are JS UTF-16 FNV-1a/Math.imul.
use crate::types::{CityGenerateInput, EngineError, EngineResult, Reply, Request};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};

type Point = [f64; 2];
type Polygon = Vec<Point>;
const FOOTWAY: f64 = 1.;

pub fn implemented_operations() -> &'static [&'static str] {
    &["city.generate", "city.validate"]
}

pub fn handle(op: &str, request: &Request) -> EngineResult<Reply> {
    if !request.buffers.is_empty() {
        return Err(EngineError::invalid("City operations take metadata only"));
    }
    match op {
        "city.generate" => Ok(Reply::new(generate(request.meta_as()?)?)),
        "city.validate" => {
            let city = request
                .meta
                .get("city")
                .ok_or_else(|| EngineError::invalid("Missing city"))?;
            Ok(Reply::new(json!({"errors": validate(city)?})))
        }
        _ => Err(EngineError::pending(op)),
    }
}

/// BuildingPlan.hash, including UTF-16 code units and wrapping Math.imul arithmetic.
fn hash(s: &str) -> u32 {
    s.encode_utf16().fold(2_166_136_261, |h, c| {
        (h ^ u32::from(c)).wrapping_mul(16_777_619)
    })
}
fn dot(a: Point, b: Point) -> f64 {
    a[0] * b[0] + a[1] * b[1]
}
fn sub(a: Point, b: Point) -> Point {
    [a[0] - b[0], a[1] - b[1]]
}
// Scaled evaluation follows JS Math.hypot, including its rounding at slope thresholds.
fn hypot2(a: f64, b: f64) -> f64 {
    let (a, b) = (a.abs(), b.abs());
    let max = a.max(b);
    if max == 0. || max.is_infinite() {
        return max;
    }
    let (a, b) = (a / max, b / max);
    (a * a + b * b).sqrt() * max
}
fn normal(a: Point, b: Point) -> Point {
    let d = sub(b, a);
    let length = hypot2(d[0], d[1]);
    [-d[1] / length, d[0] / length]
}
fn area(poly: &[Point]) -> f64 {
    poly.iter().enumerate().fold(0., |sum, (i, a)| {
        let b = poly[(i + 1) % poly.len()];
        sum + (a[0] * b[1] - a[1] * b[0])
    }) / 2.
}
fn contains(poly: &[Point], p: Point) -> bool {
    poly.iter()
        .enumerate()
        .all(|(i, a)| dot(sub(p, *a), normal(*a, poly[(i + 1) % poly.len()])) >= -1e-7)
}
fn overlaps(a: &[Point], b: &[Point]) -> bool {
    ![a, b].iter().any(|poly| {
        poly.iter().enumerate().any(|(i, p)| {
            let n = normal(*p, poly[(i + 1) % poly.len()]);
            let range = |points: &[Point]| {
                points
                    .iter()
                    .fold((f64::INFINITY, f64::NEG_INFINITY), |(lo, hi), p| {
                        let t = dot(*p, n);
                        (lo.min(t), hi.max(t))
                    })
            };
            let (al, ah) = range(a);
            let (bl, bh) = range(b);
            ah <= bl + 1e-7 || bh <= al + 1e-7
        })
    })
}
fn clip(poly: &[Point], n: Point, k: f64) -> Polygon {
    let mut out = Vec::new();
    for (i, a) in poly.iter().enumerate() {
        let b = poly[(i + 1) % poly.len()];
        let u = dot(*a, n) - k;
        let v = dot(b, n) - k;
        if u >= 0. {
            out.push(*a);
        }
        if (u >= 0.) != (v >= 0.) {
            let t = u / (u - v);
            out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
    }
    out
}
fn height(x: f64, z: f64, terrain: &str) -> f64 {
    if terrain == "flat" {
        0.
    } else {
        0.025 * x + 0.035 * z + 1.8 * (x / 45.).sin() * (z / 50.).cos()
    }
}
fn road_width(kind: &str) -> f64 {
    match kind {
        "avenue" => 6.,
        "street" => 3.5,
        "lane" => 2.5,
        "alley" => 2.,
        _ => unreachable!(),
    }
}
fn edge_key(a: usize, b: usize) -> (usize, usize) {
    (a.min(b), a.max(b))
}

#[derive(Clone, Serialize, Deserialize)]
struct Node {
    id: usize,
    x: f64,
    z: f64,
    y: f64,
}
#[derive(Clone, Serialize, Deserialize)]
struct Edge {
    id: usize,
    a: usize,
    b: usize,
    kind: String,
    width: f64,
    footway: f64,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Block {
    id: usize,
    nodes: [usize; 4],
    polygon: Polygon,
    buildable: Polygon,
    regions: [Polygon; 2],
    alley: usize,
    alley_polygon: Polygon,
    roads: [usize; 4],
    district: String,
}
#[derive(Clone, Serialize, Deserialize)]
struct Corner {
    side: String,
    cut: f64,
    length: f64,
}
#[derive(Clone, Serialize, Deserialize)]
struct ParcelSize {
    width: f64,
    depth: f64,
    corner: Option<Corner>,
}
#[derive(Clone, Serialize, Deserialize)]
struct ParcelOptions {
    r#type: String,
    style: String,
    typology: String,
    storeys: u32,
    context: String,
    party: [bool; 2],
    lot: String,
    projection: f64,
    parcel: ParcelSize,
    look: Value,
}
#[derive(Clone, Serialize, Deserialize)]
struct Envelope {
    front: f64,
    rear: f64,
    side: f64,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Parcel {
    id: usize,
    seed: u32,
    block: usize,
    district: String,
    origin: Point,
    right: Point,
    inward: Point,
    width: f64,
    depth: f64,
    polygon: Polygon,
    corner: Option<Corner>,
    road: usize,
    road_y: f64,
    pad_y: f64,
    r#type: String,
    style: String,
    projection: f64,
    alley: usize,
    envelope: Envelope,
    options: ParcelOptions,
}
impl Parcel {
    fn point(&self, x: f64, z: f64) -> Point {
        [
            self.origin[0] + self.right[0] * x + self.inward[0] * z,
            self.origin[1] + self.right[1] * x + self.inward[1] * z,
        ]
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct City {
    revision: &'static str,
    seed: u32,
    layout: String,
    terrain: String,
    width: f64,
    target: u32,
    extent: f64,
    footway: f64,
    nodes: Vec<Node>,
    edges: Vec<Edge>,
    blocks: Vec<Block>,
    parcels: Vec<Parcel>,
    landmarks: Value,
    shortfall: usize,
    density_target: f64,
    alley_area: f64,
    buildable_area: f64,
}
fn add_edge(
    edges: &mut Vec<Edge>,
    map: &mut BTreeMap<(usize, usize), usize>,
    a: usize,
    b: usize,
    kind: &str,
    scale: f64,
) -> usize {
    let id = edges.len();
    edges.push(Edge {
        id,
        a,
        b,
        kind: kind.into(),
        width: road_width(kind) * if kind == "alley" { 1. } else { scale },
        footway: if kind == "alley" { 0. } else { FOOTWAY },
    });
    map.insert(edge_key(a, b), id);
    id
}
fn across_at(
    across: &[Vec<usize>],
    edges: &[Edge],
    nodes: &[Node],
    j: usize,
    x: f64,
) -> EngineResult<usize> {
    across[j]
        .iter()
        .copied()
        .find(|id| {
            let e = &edges[*id];
            nodes[e.a].x - 1e-6 <= x && nodes[e.b].x + 1e-6 >= x
        })
        .ok_or_else(|| EngineError::invalid("City frontage has no road"))
}

pub fn generate(input: CityGenerateInput) -> EngineResult<Value> {
    serde_json::to_value(generate_city(input)?).map_err(|e| EngineError::invalid(e.to_string()))
}
fn generate_city(input: CityGenerateInput) -> EngineResult<City> {
    let seed = input.seed;
    let opts = input.options;
    let (layout, terrain, scale, target) = (opts.layout, opts.terrain, opts.width, opts.count);
    if !["woven", "grid"].contains(&layout.as_str())
        || !["flat", "uneven"].contains(&terrain.as_str())
        || ![0.75, 1., 1.25].contains(&scale)
        || ![24, 100, 1000].contains(&target)
    {
        return Err(EngineError::invalid("Unsupported city settings"));
    }
    let n: usize = match target {
        1000 => 12,
        100 => 4,
        _ => 2,
    };
    let vertical = |i| {
        if i == n / 2 {
            "avenue"
        } else if i % 2 != 0 {
            "street"
        } else {
            "lane"
        }
    };
    let horizontal = |j| if j % 2 != 0 { "lane" } else { "street" };
    let (mut xs, mut zs) = (vec![0.], vec![0.]);
    for i in 0..n {
        xs.push(
            xs[i]
                + if target == 24 { 23.5 } else { 30.5 }
                + (road_width(vertical(i)) + road_width(vertical(i + 1))) * scale / 2.
                + FOOTWAY * 2.,
        );
        zs.push(
            zs[i]
                + 27.
                + (road_width(horizontal(i)) + road_width(horizontal(i + 1))) * scale / 2.
                + FOOTWAY * 2.,
        );
    }
    let (half_x, half_z, phase) = (xs[n / 2], zs[n / 2], f64::from(seed % 997) * 0.017);
    let x_at = |i: usize, j: usize| {
        if i == n / 2 {
            0.
        } else {
            xs[i] - half_x
                + if layout == "woven" {
                    (1_f64.min((i as f64 - n as f64 / 2.).abs() / 2.))
                        * 1.05
                        * (j as f64 * 0.79 + i as f64 * 0.14 + phase).sin()
                } else {
                    0.
                }
        }
    };
    let z_at = |x: f64, j: usize| {
        zs[j] - half_z
            + if layout == "woven" && j > 0 && j < n && j != n / 2 {
                1.1 * (x * 0.035 + j as f64 * 0.87 + phase).sin()
                    - 1.1 * (j as f64 * 0.87 + phase).sin()
            } else {
                0.
            }
    };
    let (mut nodes, mut edges, mut blocks, mut parcels) =
        (Vec::new(), Vec::new(), Vec::new(), Vec::<Parcel>::new());
    let mut edge_map = BTreeMap::new();
    let at = |i, j| j * (n + 1) + i;
    for j in 0..=n {
        for i in 0..=n {
            let x = x_at(i, j);
            let z = z_at(x, j);
            nodes.push(Node {
                id: nodes.len(),
                x,
                z,
                y: height(x, z, &terrain),
            });
        }
    }
    let mut across = Vec::new();
    for j in 0..=n {
        let mut row = Vec::new();
        for i in 0..n {
            row.push(add_edge(
                &mut edges,
                &mut edge_map,
                at(i, j),
                at(i + 1, j),
                horizontal(j),
                scale,
            ));
        }
        across.push(row);
    }
    for j in 0..n {
        for i in 0..=n {
            add_edge(
                &mut edges,
                &mut edge_map,
                at(i, j),
                at(i, j + 1),
                vertical(i),
                scale,
            );
        }
    }
    let landmarks = json!({"gate":{"x":0,"z":half_z+10.},"castle":{"x":0,"z":-half_z-10.},
        "plaza":{"x":0,"z":0,"r":4.5,"y":0,"polygon":[[-4.5,0.],[0.,-4.5],[4.5,0.],[0.,4.5]]}});
    for (z, end) in [(half_z + 10., at(n / 2, n)), (-half_z - 10., at(n / 2, 0))] {
        let id = nodes.len();
        nodes.push(Node {
            id,
            x: 0.,
            z,
            y: height(0., z, &terrain),
        });
        add_edge(&mut edges, &mut edge_map, end, id, "avenue", scale);
    }
    let mut alleys = vec![vec![0; n]; n];
    for j in 0..n {
        let z = zs[j] - half_z
            + road_width(horizontal(j)) * scale / 2.
            + FOOTWAY
            + 12.5
            + road_width("alley") / 2.;
        let mut ends = Vec::new();
        for i in 0..=n {
            let (a, b) = (at(i, j), at(i, j + 1));
            let e = edge_map[&edge_key(a, b)];
            let (aa, bb) = (&nodes[a], &nodes[b]);
            let t = (z - aa.z) / (bb.z - aa.z);
            let x = aa.x + (bb.x - aa.x) * t;
            let id = nodes.len();
            nodes.push(Node {
                id,
                x,
                z,
                y: height(x, z, &terrain),
            });
            ends.push(id);
            edges[e].b = id;
            let kind = edges[e].kind.clone();
            add_edge(&mut edges, &mut edge_map, id, b, &kind, scale);
        }
        for i in 0..n {
            alleys[j][i] = add_edge(
                &mut edges,
                &mut edge_map,
                ends[i],
                ends[i + 1],
                "alley",
                scale,
            );
        }
    }
    for (j, alley_row) in alleys.iter().enumerate() {
        for (i, &alley_id) in alley_row.iter().enumerate() {
            let ids = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
            let polygon: Polygon = ids.iter().map(|id| [nodes[*id].x, nodes[*id].z]).collect();
            let roads = [
                across_at(
                    &across,
                    &edges,
                    &nodes,
                    j,
                    (nodes[ids[0]].x + nodes[ids[1]].x) / 2.,
                )?,
                edge_map[&edge_key(ids[1], ids[2])],
                across_at(
                    &across,
                    &edges,
                    &nodes,
                    j + 1,
                    (nodes[ids[2]].x + nodes[ids[3]].x) / 2.,
                )?,
                edge_map[&edge_key(ids[3], ids[0])],
            ];
            let cx = (nodes[ids[0]].x + nodes[ids[1]].x) / 2.;
            let cz = (zs[j] + zs[j + 1]) / 2. - half_z;
            let mut buildable = polygon.clone();
            for k in 0..4 {
                let a = polygon[k];
                let norm = normal(a, polygon[(k + 1) % 4]);
                buildable = clip(
                    &buildable,
                    norm,
                    dot(a, norm) + edges[roads[k]].width / 2. + FOOTWAY,
                );
            }
            if (i as f64 - n as f64 / 2. + 0.5).abs() == 0.5
                && (j as f64 - n as f64 / 2. + 0.5).abs() == 0.5
            {
                buildable = clip(&buildable, [cx.signum(), cz.signum()], 4.5);
            }
            let alley = &edges[alley_id];
            let (aa, ab) = (&nodes[alley.a], &nodes[alley.b]);
            let an = normal([aa.x, aa.z], [ab.x, ab.z]);
            let neg_an = [-an[0], -an[1]];
            let ad = dot([aa.x, aa.z], an);
            let regions = [
                clip(&buildable, neg_an, -ad + alley.width / 2.),
                clip(&buildable, an, ad + alley.width / 2.),
            ];
            let alley_polygon = clip(
                &clip(&buildable, an, ad - alley.width / 2.),
                neg_an,
                -ad - alley.width / 2.,
            );
            let district = if cx < 0. {
                if cz < 0. { "craft" } else { "market" }
            } else if cz < 0. {
                "harbour"
            } else {
                "residential"
            };
            let block = Block {
                id: blocks.len(),
                nodes: ids,
                polygon: polygon.clone(),
                buildable: buildable.clone(),
                regions,
                alley: alley_id,
                alley_polygon,
                roads,
                district: district.into(),
            };
            for side in [0, 2] {
                let road = &edges[roads[side]];
                let (a, b) = (polygon[side], polygon[(side + 1) % 4]);
                let inward = normal(a, b);
                let right = [inward[1], -inward[0]];
                let o = [
                    a[0] + inward[0] * (road.width / 2. + FOOTWAY),
                    a[1] + inward[1] * (road.width / 2. + FOOTWAY),
                ];
                let local: Polygon = buildable
                    .iter()
                    .map(|p| [dot(sub(*p, o), right), dot(sub(*p, o), inward)])
                    .collect();
                let min_x = local.iter().map(|p| p[0]).fold(f64::INFINITY, f64::min);
                let max_x = local.iter().map(|p| p[0]).fold(f64::NEG_INFINITY, f64::max);
                let total = ((max_x - min_x - 0.8) * 2.).floor() / 2.;
                let count = (total / 7.).floor() as usize;
                let mut x = min_x + 0.4;
                let mut widths = vec![7.; count];
                for k in 1..count.saturating_sub(1) {
                    if widths.iter().sum::<f64>() + 1. > total {
                        break;
                    }
                    widths[k] += 0.5;
                }
                let mut row = Vec::<usize>::new();
                for (k, width) in widths.into_iter().enumerate() {
                    let mut found = None;
                    'fit: for setback in [0., 0.25, 0.5, 0.75, 1., 1.5, 2., 2.5, 3.] {
                        for depth in [12.5, 12., 10.5, 10., 9.5] {
                            if setback + depth > 12.55 {
                                continue;
                            }
                            let parcel_seed =
                                hash(&format!("house:{seed}:{}:{side}:{k}", block.id));
                            let origin = [
                                o[0] + right[0] * x + inward[0] * setback,
                                o[1] + right[1] * x + inward[1] * setback,
                            ];
                            let corner = if layout == "woven" && road.kind == "lane" && depth >= 12.
                            {
                                Some(Corner {
                                    side: if !hash(&format!("corner:{parcel_seed}"))
                                        .is_multiple_of(2)
                                    {
                                        "left"
                                    } else {
                                        "right"
                                    }
                                    .into(),
                                    cut: 0.5
                                        + f64::from(hash(&format!("cut:{parcel_seed}")) % 2) * 0.5,
                                    length: 2.,
                                })
                            } else {
                                None
                            };
                            let shape = if let Some(c) = &corner {
                                if c.side == "left" {
                                    vec![
                                        [0., 0.],
                                        [width, 0.],
                                        [width, depth],
                                        [c.cut, depth],
                                        [0., depth - c.length],
                                    ]
                                } else {
                                    vec![
                                        [0., 0.],
                                        [width, 0.],
                                        [width, depth - c.length],
                                        [width - c.cut, depth],
                                        [0., depth],
                                    ]
                                }
                            } else {
                                vec![[0., 0.], [width, 0.], [width, depth], [0., depth]]
                            };
                            let parcel_polygon: Polygon = shape
                                .iter()
                                .map(|[u, v]| {
                                    [
                                        origin[0] + right[0] * u + inward[0] * v,
                                        origin[1] + right[1] * u + inward[1] * v,
                                    ]
                                })
                                .collect();
                            if !parcel_polygon.iter().all(|c| {
                                contains(&block.regions[if side == 0 { 0 } else { 1 }], *c)
                            }) || parcels
                                .iter()
                                .rev()
                                .take_while(|p| p.block == block.id)
                                .any(|q| overlaps(&parcel_polygon, &q.polygon))
                            {
                                continue;
                            }
                            found = Some((parcel_seed, origin, depth, corner, parcel_polygon));
                            break 'fit;
                        }
                    }
                    x += width;
                    let Some((parcel_seed, origin, depth, corner, parcel_polygon)) = found else {
                        continue;
                    };
                    let front = [
                        origin[0] + right[0] * (width / 2.) + inward[0] * 0.,
                        origin[1] + right[1] * (width / 2.) + inward[1] * 0.,
                    ];
                    let route = across_at(
                        &across,
                        &edges,
                        &nodes,
                        if side == 0 { j } else { j + 1 },
                        front[0],
                    )?;
                    let (aa, bb) = (&nodes[edges[route].a], &nodes[edges[route].b]);
                    let d = sub([bb.x, bb.z], [aa.x, aa.z]);
                    let t = (dot(sub(front, [aa.x, aa.z]), d) / dot(d, d)).clamp(0., 1.);
                    let road_y = aa.y + (bb.y - aa.y) * t;
                    let style = match district {
                        "craft" | "residential" => "fairytale",
                        "market" => "spire",
                        _ => "harbour",
                    };
                    let projection = (3_f64
                        .min(((road.width + FOOTWAY * 2. - 1.25) / 2. * 2.).floor() / 2.)
                        - f64::from(hash(&format!("projection:{parcel_seed}")) % 3) * 0.5)
                        .max(0.5);
                    let parcel = Parcel {
                        id: parcels.len(),
                        seed: parcel_seed,
                        block: block.id,
                        district: district.into(),
                        origin,
                        right,
                        inward,
                        width,
                        depth,
                        polygon: parcel_polygon,
                        corner: corner.clone(),
                        road: route,
                        road_y,
                        pad_y: road_y + 0.15,
                        r#type: "home".into(),
                        style: style.into(),
                        projection,
                        alley: alley_id,
                        envelope: Envelope {
                            front: projection + 0.5,
                            rear: 0.25,
                            side: 0.25,
                        },
                        options: ParcelOptions {
                            r#type: "home".into(),
                            style: style.into(),
                            typology: "rowhouse".into(),
                            storeys: 3 + hash(&format!("height:{parcel_seed}")) % 2,
                            context: "terrace".into(),
                            party: [false, false],
                            lot: "rect".into(),
                            projection,
                            parcel: ParcelSize {
                                width,
                                depth,
                                corner,
                            },
                            look: json!({"roof":{"turret":null},"facade":{"oriels":0}}),
                        },
                    };
                    row.push(parcel.id);
                    parcels.push(parcel);
                }
                for pair in row.windows(2) {
                    let p = &parcels[pair[0]];
                    let q = &parcels[pair[1]];
                    let advance = dot(sub(q.origin, p.point(p.width, 0.)), p.right);
                    if advance.abs() < 1e-6 {
                        parcels[pair[0]].options.party[1] = true;
                        parcels[pair[1]].options.party[0] = true;
                    }
                }
            }
            blocks.push(block);
        }
    }
    let alley_area = blocks.iter().fold(0., |s, b| s + area(&b.alley_polygon));
    let buildable_area = blocks
        .iter()
        .fold(0., |s, b| s + b.regions.iter().fold(0., |s, r| s + area(r)));
    let shortfall = (target as usize).saturating_sub(parcels.len());
    Ok(City {
        revision: "city-fixture-3",
        seed,
        layout,
        terrain,
        width: scale,
        target,
        extent: half_x.max(half_z) + 32.,
        footway: FOOTWAY,
        nodes,
        edges,
        blocks,
        parcels,
        landmarks,
        shortfall,
        density_target: 0.8,
        alley_area,
        buildable_area,
    })
}

// A small validation schema accepts the same city data without requiring generation-only fields.
#[derive(Deserialize)]
struct ValidationCity {
    nodes: Vec<ValidationNode>,
    edges: Vec<ValidationEdge>,
    blocks: Vec<ValidationBlock>,
    parcels: Vec<ValidationParcel>,
}
#[derive(Deserialize)]
struct ValidationNode {
    x: f64,
    y: f64,
    z: f64,
}
#[derive(Deserialize)]
struct ValidationEdge {
    id: usize,
    a: usize,
    b: usize,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ValidationBlock {
    regions: Vec<Polygon>,
    alley_polygon: Polygon,
}
#[derive(Deserialize)]
struct ValidationParcel {
    block: usize,
    polygon: Polygon,
}
fn checked_polygon(poly: &[Point]) -> EngineResult<()> {
    if poly.iter().any(|p| !p.iter().all(|v| v.is_finite()))
        || (poly.len() < 3 && !poly.is_empty())
        || poly
            .iter()
            .enumerate()
            .any(|(i, p)| *p == poly[(i + 1) % poly.len()])
    {
        return Err(EngineError::invalid("Invalid city polygon"));
    }
    Ok(())
}
pub fn validate(value: &Value) -> EngineResult<Vec<String>> {
    let city: ValidationCity =
        serde_json::from_value(value.clone()).map_err(|e| EngineError::invalid(e.to_string()))?;
    if city.nodes.is_empty()
        || city
            .nodes
            .iter()
            .any(|n| ![n.x, n.y, n.z].iter().all(|v| v.is_finite()))
        || city
            .edges
            .iter()
            .any(|e| e.a >= city.nodes.len() || e.b >= city.nodes.len())
        || city.parcels.iter().any(|p| p.block >= city.blocks.len())
    {
        return Err(EngineError::invalid(
            "Invalid city nodes, road endpoints or parcel block",
        ));
    }
    for block in &city.blocks {
        for polygon in block
            .regions
            .iter()
            .chain(std::iter::once(&block.alley_polygon))
        {
            checked_polygon(polygon)?;
        }
    }
    for p in &city.parcels {
        checked_polygon(&p.polygon)?;
    }
    let mut errors = Vec::new();
    let mut seen = BTreeSet::from([0]);
    let mut queue = vec![0];
    let mut i = 0;
    while i < queue.len() {
        for e in &city.edges {
            let j = if e.a == queue[i] {
                Some(e.b)
            } else if e.b == queue[i] {
                Some(e.a)
            } else {
                None
            };
            if let Some(j) = j
                && seen.insert(j)
            {
                queue.push(j);
            }
        }
        i += 1;
    }
    if seen.len() != city.nodes.len() {
        errors.push("Disconnected road graph".into());
    }
    for e in &city.edges {
        let (a, b) = (&city.nodes[e.a], &city.nodes[e.b]);
        if (b.y - a.y).abs() / hypot2(b.x - a.x, b.z - a.z) > 0.12 {
            errors.push(format!("Unsupported road slope {}", e.id));
        }
    }
    let mut by_block = BTreeMap::<usize, Vec<usize>>::new();
    for (i, p) in city.parcels.iter().enumerate() {
        let block = &city.blocks[p.block];
        if !block
            .regions
            .iter()
            .any(|r| p.polygon.iter().all(|c| contains(r, *c)))
        {
            errors.push(format!("Parcel outside buildable region {i}"));
        }
        if overlaps(&p.polygon, &block.alley_polygon) {
            errors.push(format!("Parcel obstructs public alley {i}"));
        }
        for j in by_block.entry(p.block).or_default().iter() {
            if overlaps(&p.polygon, &city.parcels[*j].polygon) {
                errors.push(format!("Overlapping parcels {i}:{j}"));
            }
        }
        by_block.entry(p.block).or_default().push(i);
    }
    Ok(errors)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::CityOptions;
    use std::io::Write;
    use std::process::{Command, Stdio};

    fn input(seed: u32, layout: &str, terrain: &str, width: f64, count: u32) -> CityGenerateInput {
        CityGenerateInput {
            seed,
            options: CityOptions {
                layout: layout.into(),
                terrain: terrain.into(),
                width,
                count,
            },
        }
    }
    #[test]
    fn hash_matches_building_plan_utf16_and_uint32() {
        assert_eq!(hash(""), 2_166_136_261);
        assert_eq!(hash("hello"), 1_335_831_723);
        // Checked against BuildingPlan.hash, not a substituted RNG.
        assert_eq!(hash("house:1:0:0:0"), 2_661_556_572);
        assert_eq!(hash("A\u{1f600}\u{00e9}"), 2_102_689_680);
    }
    #[test]
    fn supported_variants_keep_graph_avenue_terrain_identity_and_party_walls() {
        for count in [24, 100, 1000] {
            for layout in ["woven", "grid"] {
                for width in [0.75, 1., 1.25] {
                    let flat = generate_city(input(1, layout, "flat", width, count)).unwrap();
                    let uneven = generate_city(input(1, layout, "uneven", width, count)).unwrap();
                    assert!(flat.parcels.len() >= count as usize);
                    assert_eq!(flat.parcels.len(), uneven.parcels.len());
                    for (a, b) in flat.nodes.iter().zip(&uneven.nodes) {
                        assert_eq!([a.x, a.z], [b.x, b.z]);
                    }
                    for (a, b) in flat.parcels.iter().zip(&uneven.parcels) {
                        assert_eq!(a.seed, b.seed);
                        assert_eq!(a.polygon, b.polygon);
                        assert_eq!(
                            serde_json::to_value(&a.options).unwrap(),
                            serde_json::to_value(&b.options).unwrap()
                        );
                        for (side, flag) in a.options.party.iter().enumerate() {
                            if *flag {
                                let x = if side == 0 { 0. } else { a.width };
                                assert!(
                                    flat.parcels.iter().any(|q| q.id != a.id
                                        && [0., q.width].iter().any(|u| {
                                            let front = sub(a.point(x, 0.), q.point(*u, 0.));
                                            let rear =
                                                sub(a.point(x, a.depth), q.point(*u, q.depth));
                                            // Preserve the exact baseline row-adjacency rule for larger woven cities.
                                            // Its known rear-depth mismatch is tested explicitly below, not hidden.
                                            if count == 24 || layout == "grid" {
                                                front[0].hypot(front[1]) < 1e-6
                                                    && rear[0].hypot(rear[1]) < 1e-6
                                            } else {
                                                dot(front, a.right).abs() < 1e-6
                                            }
                                        })),
                                    "count={count} layout={layout} width={width} parcel={} side={side}",
                                    a.id
                                );
                            }
                        }
                    }
                    for e in flat.edges.iter().filter(|e| e.kind == "avenue") {
                        assert_eq!(flat.nodes[e.a].x, 0.);
                        assert_eq!(flat.nodes[e.b].x, 0.);
                    }
                    for b in &flat.blocks {
                        assert!(
                            (area(&b.buildable)
                                - b.regions.iter().map(|r| area(r)).sum::<f64>()
                                - area(&b.alley_polygon))
                            .abs()
                                < 1e-6
                        );
                    }
                    for c in [flat, uneven] {
                        assert!(
                            validate(&serde_json::to_value(c).unwrap())
                                .unwrap()
                                .is_empty()
                        );
                    }
                }
            }
        }
    }
    #[test]
    fn known_js_large_woven_party_depth_mismatch_is_explicit() {
        // Existing JS CityModel line 75 tests front-axis advance only, not full-depth contact.
        // Changing these flags here alone would break the required identical plan/mask inputs.
        let c = generate_city(input(1, "woven", "flat", 0.75, 100)).unwrap();
        let (p, q) = (&c.parcels[12], &c.parcels[13]);
        assert!(p.options.party[1] && q.options.party[0]);
        let rear = sub(p.point(p.width, p.depth), q.point(0., q.depth));
        assert!(
            rear[0].hypot(rear[1]) > 1e-6,
            "Coordinate any party-wall fix in BOTH baselines"
        );
    }
    #[test]
    fn metadata_operations_round_trip_through_native_packet_abi() {
        use crate::abi::{decode_reply, encode_request, execute_packet};
        let packet = encode_request(&Request::new(
            "city.generate",
            json!({"seed":u32::MAX,"options":{}}),
        ))
        .unwrap();
        let reply = decode_reply(&execute_packet(&packet)).unwrap();
        assert!(reply.buffers.is_empty());
        assert_eq!(reply.meta["revision"], "city-fixture-3");
        assert_eq!(reply.meta["seed"], u32::MAX);
        assert_eq!(reply.meta["parcels"].as_array().unwrap().len(), 24);
        let packet =
            encode_request(&Request::new("city.validate", json!({"city":reply.meta}))).unwrap();
        let reply = decode_reply(&execute_packet(&packet)).unwrap();
        assert!(reply.buffers.is_empty());
        assert_eq!(reply.meta, json!({"errors":[]}));
    }
    #[test]
    fn invalid_metadata_is_structured_not_a_panic() {
        for options in [
            json!({"width":0}),
            json!({"width":2}),
            json!({"count":25}),
            json!({"layout":"other"}),
            json!({"terrain":"other"}),
        ] {
            assert_eq!(
                handle(
                    "city.generate",
                    &Request::new("city.generate", json!({"seed":1,"options":options}))
                )
                .unwrap_err()
                .code,
                "INVALID_REQUEST"
            );
        }
        assert_eq!(
            handle("city.validate", &Request::new("city.validate", json!({})))
                .unwrap_err()
                .code,
            "INVALID_REQUEST"
        );
        let mut city = generate(input(1, "woven", "flat", 1., 24)).unwrap();
        city["edges"][0]["a"] = json!(999999);
        assert_eq!(validate(&city).unwrap_err().code, "INVALID_REQUEST");
    }
    #[test]
    fn node_baseline_parity_full_city_validation_and_plan_mask_inputs() {
        // No browser. Node only evaluates the existing deterministic baseline and shared planner.
        // Stream one case per process to bound fixture memory; no generated fixture source/files.
        let script = r#"
const assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../city-model.js'),P=require('../../building-lab/plan.js');
const {input,actual}=JSON.parse(fs.readFileSync(0,'utf8')),expected=C.generate(input.seed,input.options);
function equal(a,b,path='city'){
  if(typeof a==='number'&&typeof b==='number'){assert.ok(Math.abs(a-b)<=1e-6,path+': '+a+' vs '+b);return;}
  if(Array.isArray(a)){assert.ok(Array.isArray(b),path);assert.equal(a.length,b.length,path);a.forEach((v,i)=>equal(v,b[i],path+'['+i+']'));return;}
  if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path);for(const k in a)equal(a[k],b[k],path+'.'+k);return;}
  assert.equal(a,b,path);
}
equal(actual,expected);assert.deepEqual(C.validate(actual),[]);
for(let i=0;i<actual.parcels.length;i++){
 const a=actual.parcels[i],b=expected.parcels[i];
 assert.equal(a.id,b.id);assert.equal(a.seed,b.seed);assert.deepEqual(a.options,b.options);
 // Exact options feed the existing complete room planner, including its mask inputs.
 if(i===0||i===actual.parcels.length-1||i%97===0)assert.deepEqual(P.generate(a.seed,a.options).plot.masks,P.generate(b.seed,b.options).plot.masks);
}
// Error ordering and messages are part of city.validate, not merely empty-success parity.
actual.nodes[0].y+=100; actual.parcels[1].polygon=actual.parcels[0].polygon;
console.log(JSON.stringify({city:actual,errors:C.validate(actual)}));
"#;
        for seed in [0, 1, 2, 5, 99, 997, u32::MAX] {
            for layout in ["woven", "grid"] {
                for width in [0.75, 1., 1.25] {
                    for count in [24, 100, 1000] {
                        let input = input(
                            seed,
                            layout,
                            if seed % 2 == 0 { "flat" } else { "uneven" },
                            width,
                            count,
                        );
                        let actual = generate(input.clone()).unwrap();
                        let data =
                            serde_json::to_vec(&json!({"input":input,"actual":actual})).unwrap();
                        let mut child = Command::new("node")
                            .args(["-e", script])
                            .current_dir(env!("CARGO_MANIFEST_DIR"))
                            .stdin(Stdio::piped())
                            .stdout(Stdio::piped())
                            .stderr(Stdio::piped())
                            .spawn()
                            .expect("Node 24 required for JS parity tests");
                        // stdin can exceed a pipe buffer; the child reads it before producing output.
                        child.stdin.take().unwrap().write_all(&data).unwrap();
                        let output = child.wait_with_output().unwrap();
                        assert!(
                            output.status.success(),
                            "seed={seed} {layout} width={width} count={count}: {}",
                            String::from_utf8_lossy(&output.stderr)
                        );
                        let corrupted: Value = serde_json::from_slice(&output.stdout).unwrap();
                        assert_eq!(
                            json!(validate(&corrupted["city"]).unwrap()),
                            corrupted["errors"]
                        );
                    }
                }
            }
        }
    }
}
