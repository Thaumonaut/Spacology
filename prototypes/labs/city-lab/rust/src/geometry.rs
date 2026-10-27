//! Plan-derived CityGeometry CPU port, not a renderer or a room/furniture planner.
//!
//! Full BuildingPlan JSON remains authoritative. Facade spans and inclusive mask/
//! exposed-roof decompositions are supplied by the existing shared JS helpers;
//! their time must remain in end-to-end comparisons. All packed architecture is
//! hard-shaded (no smooth-normal buffer), with the original material IDs.
use crate::types::{
    Buffer, BufferKind, DoorLeaf, DoorsInput, EngineError, EngineResult, IDENTITY, Materials, Mesh,
    Model, PlanGeometryInput, PrepareInput, Reply, Request, SparseOptions, Volume, VolumeSpec,
};
use serde::Deserialize;
use serde_json::{Value, json};

const MAX_BYTES: usize = crate::GEOMETRY_BUDGET_BYTES;

pub fn implemented_operations() -> &'static [&'static str] {
    // Never advertise dependent conversions until the independently owned native
    // mesher is ready. There is deliberately no JS conversion fallback.
    if crate::mesh::implemented_operations().contains(&"mesh.segment") {
        &[
            "geometry.facade",
            "geometry.coarse",
            "geometry.prepare",
            "geometry.doors",
        ]
    } else {
        &["geometry.facade", "geometry.prepare"]
    }
}

pub fn handle(op: &str, request: &Request) -> EngineResult<Reply> {
    if !implemented_operations().contains(&op) {
        return Err(EngineError::pending(op));
    }
    match op {
        "geometry.facade" => facade(&request.meta_as()?)?.into_reply(),
        "geometry.coarse" => coarse(&request.meta_as()?)?.into_reply(),
        "geometry.prepare" => prepare(request),
        "geometry.doors" => doors(request),
        _ => Err(EngineError::pending(op)),
    }
}

// Consume only CityGeometry fields; never regenerate or replace room, stair,
// furnishing, lot, or other fields of the authoritative complete input plan.
#[derive(Debug, Deserialize)]
struct Plan {
    cell: f64,
    plot: Plot,
    floors: Vec<Floor>,
    facade: Facade,
    roof: Roof,
}
#[derive(Debug, Deserialize)]
struct Plot {
    w: usize,
    d: usize,
    front: f64,
    party: [bool; 2],
    masks: Vec<Vec<u8>>,
}
#[derive(Debug, Deserialize)]
struct Floor {
    openings: Vec<Opening>,
}
#[derive(Debug, Deserialize)]
struct Opening {
    #[serde(default)]
    side: String,
    kind: String,
    cells: Vec<[f64; 2]>,
}
#[derive(Debug, Deserialize)]
struct Facade {
    wall: String,
    timber: String,
    base: String,
}
#[derive(Debug, Deserialize)]
struct Roof {
    ridge: String,
    pitch: f64,
    eave: f64,
    mat: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Parcel {
    id: Value,
    origin: [f64; 2],
    right: [f64; 2],
    inward: [f64; 2],
    pad_y: f64,
}
impl Parcel {
    fn parse(value: &Value) -> EngineResult<Self> {
        let p: Self = serde_json::from_value(value.clone())
            .map_err(|e| EngineError::invalid(format!("Invalid parcel: {e}")))?;
        if !p.pad_y.is_finite()
            || p.origin
                .iter()
                .chain(&p.right)
                .chain(&p.inward)
                .any(|v| !v.is_finite())
            || (!p.id.is_string() && !p.id.is_number())
        {
            return Err(EngineError::invalid("Invalid parcel frame/id"));
        }
        Ok(p)
    }
    fn point(&self, x: f64, z: f64) -> [f64; 2] {
        [
            self.origin[0] + self.right[0] * x + self.inward[0] * z,
            self.origin[1] + self.right[1] * x + self.inward[1] * z,
        ]
    }
    fn normal(&self, n: u16) -> u16 {
        if n < 2 {
            if self.right[0] > 0. { n } else { 1 - n }
        } else if n >= 4 {
            if self.inward[1] > 0. { n } else { 9 - n }
        } else {
            n
        }
    }
    fn mesh_id(&self) -> String {
        format!(
            "building:{}",
            self.id
                .as_str()
                .map(str::to_owned)
                .unwrap_or_else(|| self.id.to_string())
        )
    }
}

fn parse_plan(value: &Value) -> EngineResult<Plan> {
    let p: Plan = serde_json::from_value(value.clone())
        .map_err(|e| EngineError::invalid(format!("Invalid Building Lab plan: {e}")))?;
    let n = p.plot.w.checked_mul(p.plot.d);
    if !p.cell.is_finite()
        || p.cell <= 0.
        || p.plot.w == 0
        || p.plot.d == 0
        || p.plot.w > u16::MAX as usize
        || p.plot.d > u16::MAX as usize
        || n.is_none_or(|n| n > MAX_BYTES)
        || p.plot.masks.is_empty()
        || p.plot.masks.len() != p.floors.len()
        || p.plot.masks.iter().any(|m| Some(m.len()) != n)
        || !p.plot.front.is_finite()
        || p.plot.front < 0.
        || p.plot.front > p.plot.d as f64
        || !p.roof.pitch.is_finite()
        || p.roof.pitch < 0.
        || !p.roof.eave.is_finite()
        || p.roof.eave < 0.
    {
        return Err(EngineError::invalid(
            "Invalid plan masks, dimensions, floors or roof",
        ));
    }
    Ok(p)
}

fn material(m: &Materials, name: &str) -> EngineResult<u8> {
    m.get(name).copied().filter(|v| *v != 0).ok_or_else(|| {
        EngineError::invalid(format!("Missing/non-solid architecture material {name}"))
    })
}

// City coordinates are 1/16 m packed uint16. Near facade ground must use exact
// padY; quantizing absolute y first floats/sinks non-grid-aligned uneven pads.
struct Builder {
    mesh: Mesh,
    extent: f64,
    ground: f64,
}
impl Builder {
    fn new(extent: f64, ground: f64) -> EngineResult<Self> {
        if !extent.is_finite() || extent < 0. || !ground.is_finite() {
            return Err(EngineError::invalid("Invalid geometry extent/ground"));
        }
        Ok(Self {
            mesh: Mesh::default(),
            extent,
            ground,
        })
    }
    fn quad(&mut self, points: [[f64; 3]; 4], n: u16, mat: u8) -> EngineResult<()> {
        // Six u32 indices plus sixteen u16 components per quad, no normals.
        if self.mesh.meta.quads >= MAX_BYTES / 56 {
            return Err(EngineError::new(
                "GEOMETRY_BUDGET",
                "Geometry exceeds 128 MiB",
            ));
        }
        let base = (self.mesh.verts.len() / 4) as u32;
        for [x, y, z] in points {
            let packed = [
                ((x + self.extent) * 16. + 0.5).floor(),
                ((y - self.ground + 32.) * 16. + 0.5).floor(),
                ((z + self.extent) * 16. + 0.5).floor(),
            ];
            if packed
                .iter()
                .any(|v| !v.is_finite() || *v < 0. || *v > u16::MAX as f64)
            {
                return Err(EngineError::invalid(
                    "Geometry outside uint16 city packing range",
                ));
            }
            self.mesh.verts.extend([
                packed[0] as u16,
                packed[1] as u16,
                packed[2] as u16,
                n | ((mat as u16) << 8),
            ]);
        }
        self.mesh
            .idx
            .extend([base, base + 1, base + 2, base, base + 2, base + 3]);
        self.mesh.meta.quads += 1;
        Ok(())
    }
    fn finish(mut self, id: String) -> Mesh {
        let mut model = IDENTITY;
        model[12] = -self.extent;
        model[13] = -32. + self.ground;
        model[14] = -self.extent;
        self.mesh.meta.id = Some(id);
        self.mesh.meta.model = Some(model);
        self.mesh
    }
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Side {
    Xm,
    Xp,
    Zm,
    Zp,
}
impl Side {
    fn parse(s: &str) -> Option<Self> {
        match s {
            "xm" => Some(Self::Xm),
            "xp" => Some(Self::Xp),
            "zm" => Some(Self::Zm),
            "zp" => Some(Self::Zp),
            _ => None,
        }
    }
    fn z_side(self) -> bool {
        matches!(self, Self::Zm | Self::Zp)
    }
    fn sign(self) -> f64 {
        if matches!(self, Self::Xm | Self::Zm) {
            -1.
        } else {
            1.
        }
    }
    fn normal(self) -> u16 {
        match self {
            Self::Xm => 1,
            Self::Xp => 0,
            Self::Zm => 5,
            Self::Zp => 4,
        }
    }
    fn point(self, along: f64, edge: f64, y: f64) -> [f64; 3] {
        if self.z_side() {
            [along, edge, y]
        } else {
            [edge, along, y]
        }
    }
}
#[derive(Debug, Deserialize)]
struct Span {
    side: Side,
    fixed: f64,
    start: f64,
    end: f64,
    posts: Vec<f64>,
}

struct FacadeBuilder<'a> {
    builder: Builder,
    plan: &'a Plan,
    parcel: &'a Parcel,
}
impl FacadeBuilder<'_> {
    // Local tuples deliberately retain JS [x,z,y] order. EVERY point, including
    // frames, timber and roofs, clips to flagged party footprint edges.
    fn quad(&mut self, points: [[f64; 3]; 4], n: u16, mat: u8) -> EngineResult<()> {
        let p = &self.plan;
        let points = points.map(|[mut x, z, y]| {
            if p.plot.party[1] {
                x = x.min(p.plot.w as f64);
            }
            if p.plot.party[0] {
                x = x.max(0.);
            }
            let [a, b] = self
                .parcel
                .point(x * p.cell, z * p.cell - p.plot.front * p.cell);
            [a, self.parcel.pad_y + y, b]
        });
        self.builder.quad(points, self.parcel.normal(n), mat)
    }
    fn box_mesh(&mut self, lo: [f64; 3], hi: [f64; 3], mat: u8) -> EngineResult<()> {
        let [x0, z0, y0] = lo;
        let [x1, z1, y1] = hi;
        for (points, n) in [
            ([[x0, z0, y1], [x1, z0, y1], [x1, z1, y1], [x0, z1, y1]], 2),
            ([[x0, z1, y0], [x1, z1, y0], [x1, z0, y0], [x0, z0, y0]], 3),
            ([[x0, z0, y0], [x0, z0, y1], [x0, z1, y1], [x0, z1, y0]], 1),
            ([[x1, z1, y0], [x1, z1, y1], [x1, z0, y1], [x1, z0, y0]], 0),
            ([[x0, z1, y0], [x0, z1, y1], [x1, z1, y1], [x1, z1, y0]], 4),
            ([[x1, z0, y0], [x1, z0, y1], [x0, z0, y1], [x0, z0, y0]], 5),
        ] {
            self.quad(points, n, mat)?;
        }
        Ok(())
    }
    fn frame(
        &mut self,
        side: Side,
        fixed: f64,
        along: [f64; 2],
        heights: [f64; 2],
        mat: u8,
    ) -> EngineResult<()> {
        let a = fixed + side.sign() * 0.2;
        let b = fixed + side.sign() * 0.4;
        let [l, r] = along;
        let [bottom, top] = heights;
        if side.z_side() {
            self.box_mesh([l, a.min(b), bottom], [r, a.max(b), top], mat)
        } else {
            self.box_mesh([a.min(b), l, bottom], [a.max(b), r, top], mat)
        }
    }
}

fn validate_rectangles(
    rects: &[[usize; 4]],
    plot: &Plot,
    mask: &[u8],
    above: Option<&[u8]>,
) -> EngineResult<()> {
    if rects
        .iter()
        .any(|&[x0, z0, x1, z1]| x0 > x1 || z0 > z1 || x1 >= plot.w || z1 >= plot.d)
    {
        return Err(EngineError::invalid(
            "Invalid inclusive mask decomposition rectangle",
        ));
    }
    let occupied = |i: usize| mask[i] != 0 && above.is_none_or(|next| next[i] == 0);
    let mut covered = vec![false; mask.len()];
    for &[x0, z0, x1, z1] in rects {
        for z in z0..=z1 {
            for x in x0..=x1 {
                let i = x + plot.w * z;
                if covered[i] || !occupied(i) {
                    return Err(EngineError::invalid(
                        "Shared decomposition overlaps or covers unoccupied mask",
                    ));
                }
                covered[i] = true;
            }
        }
    }
    // Authoritative BuildingVoxels.decompose stops when the largest remaining
    // rectangle has area < 4 (voxels.js:505). Do NOT invent extra roof/ceiling
    // patches for those residual cells, nor accept omission of a real rectangle.
    let remains = |x: usize, z: usize| {
        let i = x + plot.w * z;
        occupied(i) && !covered[i]
    };
    for z in 0..plot.d {
        for x in 0..plot.w {
            if remains(x, z)
                && (x + 3 < plot.w && (x..x + 4).all(|xx| remains(xx, z))
                    || z + 3 < plot.d && (z..z + 4).all(|zz| remains(x, zz))
                    || x + 1 < plot.w
                        && z + 1 < plot.d
                        && remains(x + 1, z)
                        && remains(x, z + 1)
                        && remains(x + 1, z + 1))
            {
                return Err(EngineError::invalid(
                    "Shared decomposition omits occupied architecture/roof rectangle",
                ));
            }
        }
    }
    Ok(())
}

fn facade(input: &PlanGeometryInput) -> EngineResult<Mesh> {
    let p = parse_plan(&input.plan)?;
    let parcel = Parcel::parse(&input.parcel)?;
    let n = p.floors.len();
    if input.spans.len() != n || input.rectangles.len() != n || input.roof_rectangles.len() != n {
        return Err(EngineError::invalid(
            "Facade requires per-floor shared spans, rectangles and roofRectangles",
        ));
    }
    let wall = material(&input.materials, &p.facade.wall)?;
    let timber = material(&input.materials, &p.facade.timber)?;
    let tile = material(&input.materials, &p.roof.mat)?;
    let base = material(&input.materials, &p.facade.base)?;
    let glass = material(&input.materials, "glass")?;
    let door = material(&input.materials, "door_wood")?;
    let mut g = FacadeBuilder {
        builder: Builder::new(input.extent, parcel.pad_y)?,
        plan: &p,
        parcel: &parcel,
    };
    let w = p.plot.w;
    let d = p.plot.d;
    for f in 0..n {
        let mask = &p.plot.masks[f];
        let y = f as f64 * 3.;
        let topy = y + 3.;
        validate_rectangles(&input.rectangles[f], &p.plot, mask, None)?;
        if input.spans[f].is_empty() && mask.iter().any(|v| *v != 0) {
            return Err(EngineError::invalid(
                "Shared facade spans omit occupied floor timber",
            ));
        }
        for &[x0, z0, x1, z1] in &input.rectangles[f] {
            let x = (x1 + 1) as f64;
            let z = (z1 + 1) as f64;
            let a = x0 as f64;
            let b = z0 as f64;
            g.quad(
                [[a, b, topy], [x, b, topy], [x, z, topy], [a, z, topy]],
                2,
                wall,
            )?;
            if f > 0 && p.plot.masks[f - 1][x0 + w * z0] == 0 {
                g.quad([[a, b, y], [a, z, y], [x, z, y], [x, b, y]], 3, timber)?;
            }
        }
        for z in 0..d {
            for x in 0..w {
                if mask[x + w * z] == 0 {
                    continue;
                }
                let a = x as f64;
                let b = z as f64;
                if x == 0 || mask[x - 1 + w * z] == 0 {
                    let mat = if x == 0 && p.plot.party[0] {
                        wall
                    } else if x == 0 && f == 0 {
                        base
                    } else {
                        wall
                    };
                    g.quad(
                        [[a, b, y], [a, b, topy], [a, b + 1., topy], [a, b + 1., y]],
                        1,
                        mat,
                    )?;
                }
                if x == w - 1 || mask[x + 1 + w * z] == 0 {
                    let mat = if x == w - 1 && p.plot.party[1] {
                        wall
                    } else if x == w - 1 && f == 0 {
                        base
                    } else {
                        wall
                    };
                    g.quad(
                        [
                            [a + 1., b + 1., y],
                            [a + 1., b + 1., topy],
                            [a + 1., b, topy],
                            [a + 1., b, y],
                        ],
                        0,
                        mat,
                    )?;
                }
                if z == 0 || mask[x + w * (z - 1)] == 0 {
                    g.quad(
                        [[a + 1., b, y], [a + 1., b, topy], [a, b, topy], [a, b, y]],
                        5,
                        if f == 0 { base } else { wall },
                    )?;
                }
                if z == d - 1 || mask[x + w * (z + 1)] == 0 {
                    g.quad(
                        [
                            [a, b + 1., y],
                            [a, b + 1., topy],
                            [a + 1., b + 1., topy],
                            [a + 1., b + 1., y],
                        ],
                        4,
                        if f == 0 { base } else { wall },
                    )?;
                }
            }
        }
        for opening in &p.floors[f].openings {
            let Some(side) = Side::parse(&opening.side) else {
                continue;
            };
            if !["window", "small", "bay", "door", "front", "back"].contains(&opening.kind.as_str())
            {
                continue;
            }
            if opening.cells.is_empty() || opening.cells.iter().flatten().any(|v| !v.is_finite()) {
                return Err(EngineError::invalid("Facade opening needs finite cells"));
            }
            let axis = if side.z_side() { 0 } else { 1 };
            let a0 = opening
                .cells
                .iter()
                .map(|c| c[axis])
                .fold(f64::INFINITY, f64::min)
                + 0.1;
            let a1 = opening
                .cells
                .iter()
                .map(|c| c[axis])
                .fold(f64::NEG_INFINITY, f64::max)
                + 0.9;
            let fixed = opening.cells[0][1 - axis] + if side.sign() > 0. { 1. } else { 0. };
            // 0.25 plan cells = 12.5 cm on the existing 0.5 m grid. Do not
            // shrink this back to coplanar glass/timber after 6.25 cm packing.
            let edge = fixed + side.sign() * 0.25;
            let is_door = ["front", "back", "door"].contains(&opening.kind.as_str());
            let bottom = y + if is_door {
                0.0625
            } else if opening.kind == "small" {
                1.25
            } else {
                0.9
            };
            let top = y + if is_door { 2.3 } else { 2.1 };
            g.quad(
                [
                    side.point(a0, edge, bottom),
                    side.point(a1, edge, bottom),
                    side.point(a1, edge, top),
                    side.point(a0, edge, top),
                ],
                side.normal(),
                if is_door { door } else { glass },
            )?;
            g.frame(side, fixed, [a0 - 0.15, a0], [bottom, top + 0.1], timber)?;
            g.frame(side, fixed, [a1, a1 + 0.15], [bottom, top + 0.1], timber)?;
            g.frame(
                side,
                fixed,
                [a0 - 0.15, a1 + 0.15],
                [top, top + 0.1],
                timber,
            )?;
            if !is_door {
                g.frame(
                    side,
                    fixed,
                    [a0 - 0.15, a1 + 0.15],
                    [bottom - 0.1, bottom],
                    timber,
                )?;
            }
        }
        for span in &input.spans[f] {
            let span: Span = serde_json::from_value(span.clone())
                .map_err(|e| EngineError::invalid(format!("Invalid facade span: {e}")))?;
            if !span.fixed.is_finite()
                || !span.start.is_finite()
                || !span.end.is_finite()
                || span.end < span.start
                || span.posts.iter().any(|v| !v.is_finite())
            {
                return Err(EngineError::invalid("Invalid facade span coordinates"));
            }
            let side = span.side;
            let edge = span.fixed + if side.sign() > 0. { 1. } else { 0. } + side.sign() * 0.25;
            for post in span.posts {
                let end = span.end.min(post + 0.24);
                g.quad(
                    [
                        side.point(post, edge, y),
                        side.point(end, edge, y),
                        side.point(end, edge, topy),
                        side.point(post, edge, topy),
                    ],
                    side.normal(),
                    timber,
                )?;
            }
            for v in [y, topy - 0.12] {
                g.quad(
                    [
                        side.point(span.start, edge, v),
                        side.point(span.end, edge, v),
                        side.point(span.end, edge, v + 0.12),
                        side.point(span.start, edge, v + 0.12),
                    ],
                    side.normal(),
                    timber,
                )?;
            }
        }
    }
    let top = n - 1;
    let eave = 0.24_f64.min(p.roof.eave / 2.);
    let rise = 2.3_f64.min(p.roof.pitch * 3.);
    for f in 0..n {
        validate_rectangles(
            &input.roof_rectangles[f],
            &p.plot,
            &p.plot.masks[f],
            p.plot.masks.get(f + 1).map(Vec::as_slice),
        )?;
        for &[x0, z0, x1, z1] in &input.roof_rectangles[f] {
            let a = x0 as f64;
            let b = z0 as f64;
            let x = (x1 + 1) as f64;
            let z = (z1 + 1) as f64;
            let y = (f + 1) as f64 * 3. + 0.1;
            let ridge_x = p.roof.ridge == "frontage" || p.roof.ridge != "depth" && x - a >= z - b;
            if f < top {
                g.quad(
                    [[a, b, y + 0.7], [x, b, y + 0.7], [x, z, y], [a, z, y]],
                    2,
                    tile,
                )?;
                continue;
            }
            if ridge_x {
                let mid = (b + z) / 2.;
                g.quad(
                    [
                        [a, b - eave, y],
                        [x, b - eave, y],
                        [x, mid, y + rise],
                        [a, mid, y + rise],
                    ],
                    2,
                    tile,
                )?;
                g.quad(
                    [
                        [a, mid, y + rise],
                        [x, mid, y + rise],
                        [x, z + eave, y],
                        [a, z + eave, y],
                    ],
                    2,
                    tile,
                )?;
                for (v, normal) in [(a, 1), (x, 0)] {
                    g.quad(
                        [[v, b, y], [v, z, y], [v, mid, y + rise], [v, mid, y + rise]],
                        normal,
                        wall,
                    )?;
                }
            } else {
                let mid = (a + x) / 2.;
                let left = a - if p.plot.party[0] { 0. } else { eave };
                let right = x + if p.plot.party[1] { 0. } else { eave };
                g.quad(
                    [
                        [left, b, y],
                        [mid, b, y + rise],
                        [mid, z, y + rise],
                        [left, z, y],
                    ],
                    2,
                    tile,
                )?;
                g.quad(
                    [
                        [mid, b, y + rise],
                        [right, b, y],
                        [right, z, y],
                        [mid, z, y + rise],
                    ],
                    2,
                    tile,
                )?;
                for (v, normal) in [(b, 5), (z, 4)] {
                    g.quad(
                        [[a, v, y], [x, v, y], [mid, v, y + rise], [mid, v, y + rise]],
                        normal,
                        wall,
                    )?;
                }
            }
        }
    }
    if p.plot.front != 0. {
        for x in [1., (w as f64 / 2.).floor(), w as f64 - 2.] {
            g.quad(
                [
                    [x, p.plot.front, 2.3],
                    [x + 1., p.plot.front, 2.3],
                    [x + 1., 0., 2.92],
                    [x, 0., 2.92],
                ],
                3,
                timber,
            )?;
        }
    }
    Ok(g.builder.finish(parcel.mesh_id()))
}

fn coarse_volume(p: &Plan, m: &Materials, size: f64) -> EngineResult<Volume> {
    if ![0.5, 1., 2.].contains(&size) {
        return Err(EngineError::invalid(
            "Coarse voxel size must be .5, 1 or 2 metres",
        ));
    }
    let n = p.plot.masks.len();
    let w = p.plot.w;
    let d = p.plot.d;
    let dims = [
        (w as f64 * p.cell / size).ceil() as usize,
        ((n as f64 * 3. + 3.) / size).ceil() as usize,
        (d as f64 * p.cell / size).ceil() as usize,
    ];
    let count = dims.iter().try_fold(1usize, |a, b| a.checked_mul(*b));
    if dims.contains(&0)
        || dims.iter().any(|v| *v > u16::MAX as usize)
        || count.is_none_or(|v| v > MAX_BYTES)
    {
        return Err(EngineError::invalid(
            "Coarse volume dimensions exceed bounded allocation",
        ));
    }
    let [xx, yy, zz] = dims;
    let mut vol = vec![0; count.unwrap()];
    let top = &p.plot.masks[n - 1];
    let axis_z = p.roof.ridge == "frontage";
    let mut lo = f64::INFINITY;
    let mut hi = f64::NEG_INFINITY;
    for (i, v) in top.iter().enumerate() {
        if *v != 0 {
            let coord = if axis_z { i / w } else { i % w } as f64 * p.cell;
            lo = lo.min(coord);
            hi = hi.max(coord);
        }
    }
    hi += p.cell;
    if !lo.is_finite() || !hi.is_finite() || hi <= lo {
        return Err(EngineError::invalid(
            "Coarse roof needs an occupied top mask",
        ));
    }
    let mid = (lo + hi) / 2.;
    let rise = 2.3_f64.min(0.5_f64.max(p.roof.pitch * 3.));
    let base = material(m, &p.facade.base)?;
    let wall = material(m, &p.facade.wall)?;
    let tile = material(m, &p.roof.mat)?;
    for z in 0..zz {
        for x in 0..xx {
            let px = ((x as f64 + 0.5) * size).min(w as f64 * p.cell - p.cell / 2.);
            let pz = ((z as f64 + 0.5) * size).min(d as f64 * p.cell - p.cell / 2.);
            let i = (px / p.cell).floor() as usize + w * (pz / p.cell).floor() as usize;
            let roof = n as f64 * 3.
                + rise
                    * (1. - ((if axis_z { pz } else { px }) - mid).abs() / ((hi - lo) / 2.))
                        .max(0.);
            for y in 0..yy {
                let yc = (y as f64 + 0.5) * size;
                let f = (yc / 3.).floor() as usize;
                let mat = if f < n && p.plot.masks[f][i] != 0 {
                    if f == 0 { base } else { wall }
                } else if (f == n && top[i] != 0 && (y as f64) * size < roof)
                    || (f > 0
                        && f < n
                        && p.plot.masks[f - 1][i] != 0
                        && yc - f as f64 * 3. < size / 2. + 0.2)
                {
                    tile
                } else {
                    0
                };
                vol[x + xx * (z + zz * y)] = mat;
            }
        }
    }
    Ok(Volume {
        spec: VolumeSpec {
            dims,
            cell: size,
            origin: [0; 3],
            levels: Vec::new(),
            plate: 0,
            city_front: 0.,
            materials: m.clone(),
        },
        vol,
    })
}

fn coarse(input: &PlanGeometryInput) -> EngineResult<Mesh> {
    let p = parse_plan(&input.plan)?;
    let parcel = Parcel::parse(&input.parcel)?;
    let volume = coarse_volume(&p, &input.materials, input.voxel_size)?;
    let raw = crate::mesh::mesh_segment(&volume, 0, volume.spec.dims[1], None, -1)?;
    if !raw.verts.len().is_multiple_of(16) || raw.normals.is_some() {
        return Err(EngineError::invalid(
            "Native architectural mesher returned invalid quads/normals",
        ));
    }
    // Exact CityGeometry.coarseMesh packing/transform, not a replacement box.
    let mut g = Builder::new(input.extent, 0.)?;
    for vertices in raw.verts.chunks_exact(16) {
        let mut points = [[0.; 3]; 4];
        for (j, point) in points.iter_mut().enumerate() {
            let v = j * 4;
            let [x, z] = parcel.point(
                (vertices[v] as f64 * input.voxel_size).min(p.plot.w as f64 * p.cell),
                (vertices[v + 2] as f64 * input.voxel_size).min(p.plot.d as f64 * p.cell)
                    - p.plot.front * p.cell,
            );
            *point = [
                x,
                parcel.pad_y + vertices[v + 1] as f64 * input.voxel_size,
                z,
            ];
        }
        g.quad(
            points,
            parcel.normal(vertices[3] & 255),
            (vertices[3] >> 8) as u8,
        )?;
    }
    let mut mesh = g.finish(parcel.mesh_id());
    mesh.meta.voxel_size = Some(input.voxel_size);
    mesh.meta.voxel_bytes = Some(volume.vol.len());
    Ok(mesh)
}

fn model(parcel: &Parcel, spec: &VolumeSpec) -> EngineResult<Model> {
    if !spec.city_front.is_finite() {
        return Err(EngineError::invalid("Invalid cityFront"));
    }
    let mut m = IDENTITY;
    let c = spec.cell;
    let z = spec.origin[2] as f64 * c + spec.city_front;
    m[0] = parcel.right[0];
    m[2] = parcel.right[1];
    m[8] = parcel.inward[0];
    m[10] = parcel.inward[1];
    m[12] = parcel.origin[0] - parcel.right[0] * spec.origin[0] as f64 * c - parcel.inward[0] * z;
    m[13] = parcel.pad_y - spec.origin[1] as f64 * c;
    m[14] = parcel.origin[1] - parcel.right[1] * spec.origin[0] as f64 * c - parcel.inward[1] * z;
    if m.iter().any(|v| !v.is_finite()) {
        return Err(EngineError::invalid("Non-finite volume model"));
    }
    Ok(m)
}

fn prepare_volume(p: &Plan, b: &mut Volume, exterior: bool) -> EngineResult<()> {
    b.validate()?;
    let [xx, yy, zz] = b.spec.dims;
    let [mx, y0, mz] = b.spec.origin.map(i64::from);
    let cv_float = (p.cell / b.spec.cell + 0.5).floor();
    if !cv_float.is_finite()
        || cv_float < 1.
        || cv_float > u16::MAX as f64
        || y0 < 0
        || y0 > yy as i64
    {
        return Err(EngineError::invalid("Invalid cityVolume grid/origin"));
    }
    let cv = cv_float as i64;
    let left = mx - if p.plot.party[0] { 0 } else { 4 };
    let right = mx + p.plot.w as i64 * cv + if p.plot.party[1] { 0 } else { 4 };
    let front = mz - 8;
    let back = mz + p.plot.d as i64 * cv + 4;
    if left < 0 || right > xx as i64 || left > right {
        return Err(EngineError::invalid("Volume lacks city clipping margins"));
    }
    if exterior {
        if b.spec.levels.len() != p.floors.len() + 1
            || b.spec.levels.iter().any(|v| *v > yy)
            || b.spec.levels.windows(2).any(|v| v[0] > v[1])
            || mx < 0
            || mz < 0
            || mz + p.plot.d as i64 * cv > zz as i64
        {
            return Err(EngineError::invalid(
                "Invalid exterior floor levels or mask origin",
            ));
        }
        material(&b.spec.materials, &p.facade.wall)?;
    }
    b.spec.city_front = p.plot.front * p.cell;
    b.vol[..xx * zz * y0 as usize].fill(0);
    for y in y0 as usize..yy {
        for z in 0..zz {
            let row = xx * (z + zz * y);
            if (z as i64) < front || (z as i64) >= back {
                b.vol[row..row + xx].fill(0);
            } else {
                b.vol[row..row + left as usize].fill(0);
                b.vol[row + right as usize..row + xx].fill(0);
            }
        }
    }
    if exterior {
        let wall = material(&b.spec.materials, &p.facade.wall)?;
        let w = p.plot.w;
        let d = p.plot.d;
        for (f, mask) in p.plot.masks.iter().enumerate() {
            for z in 1..d.saturating_sub(1) {
                for x in 1..w.saturating_sub(1) {
                    if mask[x + w * z] == 0
                        || !(z - 1..=z + 1)
                            .all(|dz| (x - 1..=x + 1).all(|dx| mask[dx + w * dz] != 0))
                    {
                        continue;
                    }
                    let x0 = (mx + x as i64 * cv) as usize;
                    let x1 = x0 + cv as usize;
                    for y in b.spec.levels[f]..b.spec.levels[f + 1] {
                        for z in (mz + z as i64 * cv) as usize..(mz + (z + 1) as i64 * cv) as usize
                        {
                            let row = xx * (z + zz * y);
                            b.vol[row + x0..row + x1].fill(wall);
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

// ABI 1 extension: an optional `batch` on geometry.prepare performs the same
// preparation, selected-door extraction, all-leaf opening and native conversion
// without returning/re-uploading a dense intermediate. Absent batch stays legacy.
// These types are deliberately local: the ten public operations are unchanged.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchedPrepareInput {
    #[serde(flatten)]
    prepare: PrepareInput,
    batch: Option<PrepareBatch>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum BatchRender {
    Mesh,
    Sparse,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PrepareBatch {
    render: BatchRender,
    #[serde(default)]
    navigation: bool,
    // All recorded leaves: matches BuildingReview.openDoors, not just the entry.
    #[serde(default)]
    leaves: Vec<DoorLeaf>,
    #[serde(default)]
    selected_leaves: Vec<DoorLeaf>,
    #[serde(default)]
    options: SparseOptions,
}

fn prepare(request: &Request) -> EngineResult<Reply> {
    let input: BatchedPrepareInput = request.meta_as()?;
    if let Some(batch) = input.batch {
        return prepare_batch(request, input.prepare, batch);
    }
    let input = input.prepare;
    let p = parse_plan(&input.plan)?;
    let parcel = Parcel::parse(&input.parcel)?;
    let mut volume = request.volume(&input.volume)?;
    prepare_volume(&p, &mut volume, input.exterior)?;
    let model = model(&parcel, &volume.spec)?;
    Ok(Reply {
        meta: json!({"volume":volume.spec,"model":model}),
        buffers: vec![Buffer::u8("vol", volume.vol)],
    })
}

struct SelectedDoors {
    mesh: Mesh,
    indices: Vec<u32>,
    materials: Vec<u8>,
    boxes: Vec<[usize; 6]>,
}

fn validate_leaf(b: &Volume, leaf: &DoorLeaf) -> EngineResult<()> {
    let [x0, y0, z0, x1, y1, z1] = leaf.r#box;
    let [xx, yy, zz] = b.spec.dims;
    if x0 >= x1 || y0 >= y1 || z0 >= z1 || x1 > xx || y1 > yy || z1 > zz {
        return Err(EngineError::invalid(
            "Door leaf box is empty or outside the volume",
        ));
    }
    Ok(())
}

fn extract_doors(
    b: &Volume,
    leaves: &[DoorLeaf],
    model: Model,
    id: String,
) -> EngineResult<SelectedDoors> {
    if model.iter().any(|v| !v.is_finite()) {
        return Err(EngineError::invalid("Invalid door model"));
    }
    let wood = material(&b.spec.materials, "door_wood")?;
    let timber = material(&b.spec.materials, "timber_dark")?;
    let [xx, _, zz] = b.spec.dims;
    let mut mesh = Mesh::default();
    let mut indices = Vec::new();
    let mut materials = Vec::new();
    let mut boxes = Vec::new();
    for leaf in leaves {
        validate_leaf(b, leaf)?;
        let [x0, y0, z0, x1, y1, z1] = leaf.r#box;
        let dims = [x1 - x0, y1 - y0, z1 - z0];
        let [nx, ny, nz] = dims;
        let mut local = Volume {
            spec: VolumeSpec {
                dims,
                cell: b.spec.cell,
                origin: [0; 3],
                levels: Vec::new(),
                plate: 0,
                city_front: 0.,
                materials: b.spec.materials.clone(),
            },
            vol: vec![0; nx * ny * nz],
        };
        for y in y0..y1 {
            for z in z0..z1 {
                for x in x0..x1 {
                    let i = x + xx * (z + zz * y);
                    let mat = b.vol[i];
                    if mat != wood && mat != timber {
                        continue;
                    }
                    if indices.len() >= MAX_BYTES / 5 {
                        return Err(EngineError::new(
                            "GEOMETRY_BUDGET",
                            "Door data exceeds bounded allocation",
                        ));
                    }
                    local.vol[x - x0 + nx * (z - z0 + nz * (y - y0))] = mat;
                    indices
                        .push(u32::try_from(i).map_err(|_| {
                            EngineError::invalid("Door dense index exceeds uint32")
                        })?);
                    materials.push(mat);
                }
            }
        }
        let raw = crate::mesh::mesh_segment(&local, 0, ny, None, -1)?;
        if !raw.verts.len().is_multiple_of(16) || raw.normals.is_some() {
            return Err(EngineError::invalid(
                "Native door mesher returned invalid quads/normals",
            ));
        }
        if (mesh.verts.len() + raw.verts.len()) * 2 + (mesh.idx.len() + raw.idx.len()) * 4
            > MAX_BYTES
        {
            return Err(EngineError::new(
                "GEOMETRY_BUDGET",
                "Door geometry exceeds 128 MiB",
            ));
        }
        let base = (mesh.verts.len() / 4) as u32;
        for v in raw.verts.chunks_exact(4) {
            // Offsets cannot overflow: validated leaf high corners <= uint16.
            mesh.verts
                .extend([v[0] + x0 as u16, v[1] + y0 as u16, v[2] + z0 as u16, v[3]]);
        }
        mesh.idx.extend(raw.idx.iter().map(|i| i + base));
        mesh.meta.quads += raw.meta.quads;
        boxes.push(leaf.r#box);
    }
    mesh.meta.id = Some(id);
    mesh.meta.model = Some(model);
    Ok(SelectedDoors {
        mesh,
        indices,
        materials,
        boxes,
    })
}

fn doors(request: &Request) -> EngineResult<Reply> {
    let input: DoorsInput = request.meta_as()?;
    let b = request.volume(&input.volume)?;
    let d = extract_doors(&b, &input.leaves, input.model, input.id)?;
    let mut reply = d.mesh.into_reply()?;
    reply.meta = json!({"mesh":reply.meta,"boxes":d.boxes});
    reply.buffers.push(Buffer::u32("indices", &d.indices));
    reply.buffers.push(Buffer::u8("materials", d.materials));
    Ok(reply)
}

// In-place equivalent of shared BuildingReview.openDoors. Selected entry data
// was captured before this pass, including duplicate/overlapping leaf ordering.
fn open_leaves(b: &mut Volume, leaves: &[DoorLeaf]) -> EngineResult<()> {
    if leaves.is_empty() {
        return Ok(());
    }
    let wood = material(&b.spec.materials, "door_wood")?;
    let timber = material(&b.spec.materials, "timber_dark")?;
    for leaf in leaves {
        validate_leaf(b, leaf)?;
    }
    let [xx, _, zz] = b.spec.dims;
    for leaf in leaves {
        let [x0, y0, z0, x1, y1, z1] = leaf.r#box;
        for y in y0..y1 {
            for z in z0..z1 {
                for x in x0..x1 {
                    let mat = &mut b.vol[x + xx * (z + zz * y)];
                    if *mat == wood || *mat == timber {
                        *mat = 0;
                    }
                }
            }
        }
    }
    Ok(())
}

fn local_bounds(spec: &VolumeSpec, lo: [usize; 3], hi: [usize; 3]) -> Value {
    let convert = |v: [usize; 3]| {
        [0, 1, 2].map(|j| {
            (v[j] as f64 - spec.origin[j] as f64) * spec.cell
                - if j == 2 { spec.city_front } else { 0. }
        })
    };
    json!({"lo":convert(lo),"hi":convert(hi)})
}

fn prepare_batch(
    request: &Request,
    input: PrepareInput,
    batch: PrepareBatch,
) -> EngineResult<Reply> {
    if input.exterior
        && (batch.navigation || !batch.leaves.is_empty() || !batch.selected_leaves.is_empty())
    {
        return Err(EngineError::invalid(
            "Exterior batches cannot contain navigation/door leaves",
        ));
    }
    if !batch.navigation && !batch.selected_leaves.is_empty() {
        return Err(EngineError::invalid(
            "Selected door leaves require navigation",
        ));
    }
    let p = parse_plan(&input.plan)?;
    let parcel = Parcel::parse(&input.parcel)?;
    // Request is borrowed by the stable dispatcher, so this one mutable dense
    // copy remains necessary. Door extraction, opening, mesh and sparse then
    // borrow it; do not construct cloned dense Requests for dependent handlers.
    let mut b = request.volume(&input.volume)?;
    prepare_volume(&p, &mut b, input.exterior)?;
    let model = model(&parcel, &b.spec)?;
    let building_id = parcel.mesh_id();
    let selected = if batch.navigation {
        Some(extract_doors(
            &b,
            &batch.selected_leaves,
            model,
            format!("door:{}", &building_id["building:".len()..]),
        )?)
    } else {
        None
    };
    if !input.exterior {
        open_leaves(&mut b, &batch.leaves)?;
    }
    let (mut render, bounds, sparse) = match batch.render {
        BatchRender::Sparse => {
            let palette = request.buffer("palette", BufferKind::U8)?;
            let packed = crate::sparse::from_volume(&b, &palette.bytes, model, &batch.options)?;
            let bounds = local_bounds(&b.spec, packed.meta.lo, packed.meta.hi);
            (packed.into_reply()?, bounds, true)
        }
        BatchRender::Mesh => {
            let mut mesh = crate::mesh::mesh_segment(&b, 0, b.spec.dims[1], None, -1)?;
            let mut lo = [usize::MAX; 3];
            let mut hi = [0; 3];
            for v in mesh.verts.chunks_exact(4) {
                for j in 0..3 {
                    lo[j] = lo[j].min(v[j] as usize);
                    hi[j] = hi[j].max(v[j] as usize);
                }
            }
            // Empty legacy meshes have infinite JS bounds, not JSON numbers.
            // Signal null so the adapter preserves those via shared G.bounds.
            let bounds = if mesh.verts.is_empty() {
                Value::Null
            } else {
                local_bounds(&b.spec, lo, hi)
            };
            mesh.meta.model = Some(model);
            mesh.meta.id = Some(building_id);
            (mesh.into_reply()?, bounds, false)
        }
    };
    let mut meta = json!({"batched":true,"volume":b.spec,"model":model,"bounds":bounds,
        "mesh":null,"ray":null,"doorMesh":null,"boxes":null});
    meta[if sparse { "ray" } else { "mesh" }] = render.meta;
    if let Some(d) = selected {
        let door = d.mesh.into_reply()?;
        meta["doorMesh"] = door.meta;
        meta["boxes"] = json!(d.boxes);
        for mut buffer in door.buffers {
            buffer.name = match buffer.name.as_str() {
                "verts" => "doorVerts",
                "idx" => "doorIdx",
                _ => unreachable!(),
            }
            .into();
            render.buffers.push(buffer);
        }
        render.buffers.push(Buffer::u32("doorIndices", &d.indices));
        render
            .buffers
            .push(Buffer::u8("doorMaterials", d.materials));
    }
    if batch.navigation {
        // Move, never clone, the exact opened collision volume into the reply.
        render.buffers.push(Buffer::u8("vol", b.vol));
    }
    Ok(Reply {
        meta,
        buffers: render.buffers,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::BufferKind;

    fn input() -> PlanGeometryInput {
        let w = 8;
        let d = 6;
        let mut lower = vec![1u8; w * d];
        lower[..w].fill(0);
        serde_json::from_value(json!({
            "plan":{"cell":0.5,"plot":{"w":w,"d":d,"front":1,"party":[false,false],
                "masks":[lower,vec![1u8;w*d]]},
                "facade":{"wall":"wall","timber":"timber","base":"base"},
                "roof":{"ridge":"frontage","pitch":0.5,"eave":2,"mat":"tile"},
                "floors":[{"openings":[
                    {"side":"xm","kind":"window","cells":[[0,2],[0,3]]},
                    {"side":"xp","kind":"small","cells":[[7,2],[7,3]]},
                    {"side":"zm","kind":"front","cells":[[2,1],[3,1]]},
                    {"side":"zp","kind":"back","cells":[[2,5],[3,5]]}
                ]},{"openings":[
                    {"side":"zm","kind":"bay","cells":[[2,0],[3,0]]},
                    {"side":"zp","kind":"window","cells":[[2,5],[3,5]]}
                ]}]},
            "parcel":{"id":17,"origin":[0,0],"right":[1,0],"inward":[0,1],"padY":0.137},
            "extent":100,
            "M":{"wall":1,"timber":2,"base":3,"glass":4,"door_wood":5,"tile":6,"timber_dark":7},
            "spans":[[
                {"side":"xm","fixed":0,"start":1,"end":6,"posts":[1,3,6]},
                {"side":"xp","fixed":7,"start":1,"end":6,"posts":[1,3,6]}
            ],[{"side":"zm","fixed":0,"start":0,"end":8,"posts":[0,3,7,8]}]],
            "rectangles":[[[0,1,7,5]],[[0,0,7,5]]],
            "roofRectangles":[[],[[0,0,7,5]]]
        }))
        .unwrap()
    }

    fn small_volume() -> Volume {
        Volume {
            spec: VolumeSpec {
                dims: [20, 12, 20],
                cell: 0.5,
                origin: [6, 2, 9],
                levels: vec![3, 6, 9],
                plate: 9,
                city_front: 0.,
                materials: input().materials,
            },
            vol: vec![8; 20 * 12 * 20],
        }
    }

    fn packet(request: &Request) -> EngineResult<Reply> {
        let input = crate::abi::encode_request(request)?;
        crate::abi::decode_reply(&crate::abi::execute_packet(&input))
    }

    fn buffer<'a>(reply: &'a Reply, name: &str) -> &'a Buffer {
        reply.buffers.iter().find(|b| b.name == name).unwrap()
    }

    fn compare_json(actual: &Value, expected: &Value) {
        match (actual, expected) {
            (Value::Number(a), Value::Number(b)) => assert_eq!(a.as_f64(), b.as_f64()),
            (Value::Array(a), Value::Array(b)) => {
                assert_eq!(a.len(), b.len());
                for (a, b) in a.iter().zip(b) {
                    compare_json(a, b);
                }
            }
            (Value::Object(a), Value::Object(b)) => {
                assert_eq!(a.keys().collect::<Vec<_>>(), b.keys().collect::<Vec<_>>());
                for (key, a) in a {
                    compare_json(a, &b[key]);
                }
            }
            _ => assert_eq!(actual, expected),
        }
    }

    #[test]
    fn batch_packets_match_legacy_conversions_and_validate_without_mutating_source() {
        let i = input();
        let source = small_volume();
        let base = json!({"plan":i.plan,"parcel":i.parcel,"volume":source.spec,"exterior":false});
        let mut request = Request::new("geometry.prepare", base.clone());
        request.buffers.push(Buffer::u8("vol", source.vol.clone()));
        let legacy = packet(&request).unwrap();
        assert_eq!(legacy.buffers.len(), 1);
        assert!(legacy.meta.get("batched").is_none());
        let model: Model = serde_json::from_value(legacy.meta["model"].clone()).unwrap();
        for exterior in [true, false] {
            for navigation in [false, true] {
                if exterior && navigation {
                    continue;
                }
                for render in ["mesh", "sparse"] {
                    for crop in [false, true] {
                        for deduplicate in [false, true] {
                            request.meta = base.clone();
                            request.meta["exterior"] = json!(exterior);
                            request.meta["batch"] = json!({"render":render,"navigation":navigation,
                                "options":{"crop":crop,"deduplicate":deduplicate}});
                            request.buffers.truncate(1);
                            request.buffers.push(Buffer::u8("palette", vec![128; 1024]));
                            let batch = packet(&request).unwrap();
                            let mut legacy_request = Request::new("geometry.prepare", base.clone());
                            legacy_request.meta["exterior"] = json!(exterior);
                            legacy_request
                                .buffers
                                .push(Buffer::u8("vol", source.vol.clone()));
                            let legacy = packet(&legacy_request).unwrap();
                            assert_eq!(batch.meta["volume"], legacy.meta["volume"]);
                            assert_eq!(batch.meta["model"], legacy.meta["model"]);
                            let expected = Volume {
                                spec: serde_json::from_value(legacy.meta["volume"].clone())
                                    .unwrap(),
                                vol: buffer(&legacy, "vol").bytes.clone(),
                            };
                            let mut conversion = if render == "mesh" {
                                Request::new(
                                    "mesh.segment",
                                    json!({"volume":expected.spec,
                                    "y0":0,"y1":expected.spec.dims[1],"segment":-1,
                                    "model":model,"id":"building:17"}),
                                )
                            } else {
                                Request::new(
                                    "sparse.pack",
                                    json!({"volume":expected.spec,
                                    "model":model,"options":{"crop":crop,"deduplicate":deduplicate}}),
                                )
                            };
                            conversion
                                .buffers
                                .push(Buffer::u8("vol", expected.vol.clone()));
                            conversion
                                .buffers
                                .push(Buffer::u8("palette", vec![128; 1024]));
                            let converted = packet(&conversion).unwrap();
                            assert_eq!(
                                batch.meta[if render == "sparse" { "ray" } else { "mesh" }],
                                converted.meta
                            );
                            for b in &converted.buffers {
                                assert_eq!(buffer(&batch, &b.name), b);
                            }
                            assert_eq!(batch.buffers.iter().any(|b| b.name == "vol"), navigation);
                            if navigation {
                                assert_eq!(buffer(&batch, "vol").bytes, expected.vol);
                            }
                            assert_eq!(
                                request.buffers[0].bytes, source.vol,
                                "borrowed source not changed"
                            );
                        }
                    }
                }
            }
        }
        for batch in [
            json!({"render":"invalid"}),
            json!({"render":"mesh","navigation":true}),
            json!({"render":"mesh","leaves":[{"floor":0,"room":0,"box":[0,0,0,99,1,1]}]}),
            json!({"render":"mesh","selectedLeaves":[{"floor":0,"room":0,"box":[0,0,0,1,1,1]}]}),
        ] {
            request.meta = base.clone();
            request.meta["exterior"] = json!(batch["navigation"] == true);
            request.meta["batch"] = batch;
            assert_eq!(packet(&request).unwrap_err().code, "INVALID_REQUEST");
        }
        request.meta = base;
        request.meta["batch"] = json!({"render":"sparse"});
        request.buffers.truncate(1);
        assert_eq!(
            packet(&request).unwrap_err().code,
            "INVALID_REQUEST",
            "palette is required"
        );
        // Like JS openDoors, an empty leaf list needs no door material lookup.
        // Empty mesh bounds are intentionally delegated to the JS Infinity path.
        request.meta["batch"] = json!({"render":"mesh"});
        request.meta["volume"]["M"] = json!({});
        request.buffers[0].bytes.fill(0);
        let empty = packet(&request).unwrap();
        assert_eq!(empty.meta["bounds"], Value::Null);
        assert_eq!(buffer(&empty, "verts").bytes.len(), 0);
        assert_eq!(buffer(&empty, "idx").bytes.len(), 0);
        assert!(empty.buffers.iter().all(|b| b.name != "vol"));
    }

    #[test]
    fn facade_has_all_side_framed_openings_materials_and_exact_ground() {
        let i = input();
        let mesh = facade(&i).unwrap();
        assert!(mesh.normals.is_none(), "buildings must remain hard-shaded");
        assert_eq!(mesh.meta.id.as_deref(), Some("building:17"));
        assert_eq!(mesh.idx.len(), mesh.meta.quads * 6);
        let ground = mesh.verts.chunks_exact(4).map(|v| v[1]).min().unwrap();
        assert_eq!(ground, 512, "ground packed relative to exact padY");
        assert!((ground as f64 / 16. + mesh.meta.model.unwrap()[13] - 0.137).abs() < 1e-12);
        let glass: Vec<_> = mesh
            .verts
            .chunks_exact(16)
            .filter(|v| v[3] >> 8 == 4)
            .collect();
        for n in [0, 1, 4, 5] {
            assert!(glass.iter().any(|v| v[3] & 255 == n), "missing side {n}");
        }
        let door: Vec<_> = mesh
            .verts
            .chunks_exact(16)
            .filter(|v| v[3] >> 8 == 5)
            .collect();
        assert_eq!(
            door.len(),
            2,
            "front/back must be visible closed wood doors"
        );
        assert_eq!(door[0][1], 513, "threshold stays one packed step above pad");
        for mat in [1, 2, 3, 4, 5, 6] {
            assert!(
                mesh.verts.chunks_exact(4).any(|v| v[3] >> 8 == mat),
                "missing material {mat}"
            );
        }
        for pane in glass {
            let n = pane[3] & 255;
            let axis = (n / 2) as usize;
            for wall in mesh
                .verts
                .chunks_exact(16)
                .filter(|v| v[3] >> 8 == 1 || v[3] >> 8 == 3)
            {
                if wall[3] & 255 != n || wall[axis] != pane[axis] {
                    continue;
                }
                let range = |v: &[u16], a: usize| {
                    let values = [v[a], v[4 + a], v[8 + a], v[12 + a]];
                    (*values.iter().min().unwrap(), *values.iter().max().unwrap())
                };
                assert!(
                    (0..3).filter(|a| *a != axis).any(|a| {
                        let (a0, a1) = range(pane, a);
                        let (b0, b1) = range(wall, a);
                        a1.min(b1) <= a0.max(b0)
                    }),
                    "quantization put glass coplanar with opaque wall"
                );
            }
        }
    }

    #[test]
    fn all_facade_points_clip_to_party_footprint_including_roofs_and_timber() {
        for ridge in ["frontage", "depth", "auto"] {
            let mut i = input();
            i.plan["plot"]["party"] = json!([true, true]);
            i.plan["roof"]["ridge"] = json!(ridge);
            let mesh = facade(&i).unwrap();
            let m = mesh.meta.model.unwrap();
            for v in mesh.verts.chunks_exact(4) {
                let x = v[0] as f64 / 16. + m[12];
                assert!((0. ..=4.).contains(&x), "{ridge}: party overrun {x}");
            }
        }
    }

    #[test]
    fn facade_requires_shared_preprocessing_materials_and_bounded_packing() {
        let mut i = input();
        i.roof_rectangles.pop();
        assert_eq!(facade(&i).unwrap_err().code, "INVALID_REQUEST");
        let mut i = input();
        i.spans.clear();
        assert!(facade(&i).is_err());
        let mut i = input();
        i.rectangles[0][0][2] = 1000;
        assert!(facade(&i).is_err());
        let mut i = input();
        i.materials.remove("glass");
        assert!(facade(&i).is_err());
        let mut i = input();
        i.extent = 5000.;
        assert!(
            facade(&i).is_err(),
            "uint16 overflow must not silently wrap"
        );
        let mut g = Builder::new(1., 0.).unwrap();
        g.mesh.meta.quads = MAX_BYTES / 56;
        assert_eq!(
            g.quad([[0.; 3]; 4], 2, 1).unwrap_err().code,
            "GEOMETRY_BUDGET"
        );
    }

    #[test]
    fn coarse_volume_uses_masks_projections_and_materials_not_a_proxy_box() {
        let i = input();
        let p = parse_plan(&i.plan).unwrap();
        for size in [0.5, 1., 2.] {
            let b = coarse_volume(&p, &i.materials, size).unwrap();
            b.validate().unwrap();
            for material in [1, 3, 6] {
                assert!(b.vol.contains(&material));
            }
            let [x, _, z] = b.spec.dims;
            assert_eq!(b.vol[0], if size == 0.5 { 0 } else { 3 });
            if size == 0.5 {
                assert_eq!(
                    b.vol[x * z * 6],
                    1,
                    "upper occupied front projection survives"
                );
            }
        }
        assert!(coarse_volume(&p, &i.materials, 0.25).is_err());
    }

    #[test]
    fn preparation_prunes_ground_and_margins_and_only_solidifies_deep_interior() {
        let mut i = input();
        i.plan["plot"]["party"] = json!([true, false]);
        let p = parse_plan(&i.plan).unwrap();
        let mut full = small_volume();
        let mut exterior = full.clone();
        prepare_volume(&p, &mut full, false).unwrap();
        prepare_volume(&p, &mut exterior, true).unwrap();
        assert_eq!(full.spec.city_front, 0.5);
        let at = |b: &Volume, x: usize, y: usize, z: usize| b.vol[x + 20 * (z + 20 * y)];
        assert!(full.vol[..20 * 20 * 2].iter().all(|v| *v == 0));
        assert_eq!(at(&full, 5, 3, 10), 0, "party margin clipped");
        assert_eq!(
            at(&full, 17, 3, 10),
            8,
            "non-party margin kept up to four voxels"
        );
        assert_eq!(at(&full, 18, 3, 10), 0);
        assert_eq!(at(&full, 8, 3, 0), 0, "front scenery pruned");
        assert_eq!(at(&full, 8, 3, 10), 8);
        assert_eq!(
            at(&exterior, 8, 3, 11),
            1,
            "deep 3x3 mask interior filled with wall"
        );
        assert_eq!(
            at(&exterior, 6, 3, 11),
            8,
            "edge remains genuine authored shell"
        );
        assert_eq!(
            at(&exterior, 8, 3, 10),
            8,
            "edge by lower-front setback preserved"
        );
        let mut invalid = small_volume();
        invalid.spec.levels[1] = 100;
        assert_eq!(
            prepare_volume(&p, &mut invalid, true).unwrap_err().code,
            "INVALID_REQUEST"
        );
    }

    #[test]
    fn preparation_model_preserves_rotated_frame_and_city_front_compensation() {
        let mut i = input();
        i.parcel["right"] = json!([-0.6, 0.8]);
        i.parcel["inward"] = json!([0.8, 0.6]);
        i.parcel["origin"] = json!([34.25, -16.7]);
        let p = Parcel::parse(&i.parcel).unwrap();
        let mut b = small_volume();
        b.spec.city_front = 0.5;
        let m = model(&p, &b.spec).unwrap();
        for [x, y, z] in [[0., 0., 0.], [4., 2., 3.]] {
            let a = [
                x + b.spec.origin[0] as f64 * b.spec.cell,
                y + b.spec.origin[1] as f64 * b.spec.cell,
                z + b.spec.origin[2] as f64 * b.spec.cell + b.spec.city_front,
            ];
            let world =
                [0, 1, 2].map(|j| a[0] * m[j] + a[1] * m[4 + j] + a[2] * m[8 + j] + m[12 + j]);
            let target = p.point(x, z);
            assert!((world[0] - target[0]).abs() < 1e-12);
            assert!((world[2] - target[1]).abs() < 1e-12);
            assert!((world[1] - p.pad_y - y).abs() < 1e-12);
        }
    }

    #[test]
    fn doors_extract_only_selected_leaf_wood_and_timber_with_original_indices_and_model() {
        if !crate::mesh::implemented_operations().contains(&"mesh.segment") {
            return;
        }
        let mut b = small_volume();
        let index = |x: usize, y: usize, z: usize| x + 20 * (z + 20 * y);
        b.vol.fill(0);
        b.vol[index(7, 3, 10)] = 5;
        b.vol[index(8, 3, 10)] = 7;
        b.vol[index(7, 4, 10)] = 4; // glass in the box is NOT a movable leaf.
        b.vol[index(9, 3, 10)] = 5; // nearby door outside selected box stays put.
        let mut m = IDENTITY;
        m[0] = -0.6;
        m[2] = 0.8;
        m[8] = 0.8;
        m[10] = 0.6;
        m[12] = 23.;
        m[13] = 0.137;
        m[14] = -8.;
        let mut request = Request::new(
            "geometry.doors",
            json!({"volume":b.spec,
            "model":m,"id":"door:17","leaves":[{"floor":0,"room":2,"box":[7,3,10,9,5,11]}]}),
        );
        request.buffers.push(Buffer::u8("vol", b.vol.clone()));
        let reply = handle("geometry.doors", &request).unwrap();
        assert_eq!(reply.meta["mesh"]["model"], json!(m));
        assert_eq!(reply.meta["mesh"]["id"], "door:17");
        assert_eq!(reply.meta["boxes"], json!([[7, 3, 10, 9, 5, 11]]));
        let indices = reply
            .buffers
            .iter()
            .find(|b| b.name == "indices")
            .unwrap()
            .as_u32()
            .unwrap();
        assert_eq!(
            indices,
            vec![index(7, 3, 10) as u32, index(8, 3, 10) as u32]
        );
        assert_eq!(
            reply
                .buffers
                .iter()
                .find(|b| b.name == "materials")
                .unwrap()
                .bytes,
            vec![5, 7]
        );
        assert_eq!(
            request.buffer("vol", BufferKind::U8).unwrap().bytes,
            b.vol,
            "extraction must not open/remove source doors"
        );
        request.meta["leaves"][0]["box"] = json!([7, 3, 10, 21, 5, 11]);
        assert_eq!(
            handle("geometry.doors", &request).unwrap_err().code,
            "INVALID_REQUEST"
        );
    }

    // This is a native-only CPU oracle, not a browser test. Its generated arrays
    // live only on stdout/in memory. No fixtures/targets are written to source.
    #[cfg(not(target_arch = "wasm32"))]
    fn node_json(script: &str) -> Value {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../..");
        let output = std::process::Command::new("node")
            .arg("-e")
            .arg(script)
            .current_dir(root)
            .output()
            .expect("native parity tests require repository Node setup");
        assert!(
            output.status.success(),
            "Node CPU oracle: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        serde_json::from_slice(&output.stdout).expect("JSON from shared JS geometry oracle")
    }

    fn compare_vec<T: std::fmt::Debug + PartialEq>(actual: &[T], expected: &[T], label: &str) {
        assert_eq!(actual.len(), expected.len(), "{label} length");
        if let Some(i) = actual.iter().zip(expected).position(|(a, b)| a != b) {
            panic!(
                "{label} component {i}: Rust {:?}, JS {:?}",
                actual[i], expected[i]
            );
        }
    }

    // RLE is test-fixture compression only, never the production typed-buffer ABI.
    fn fixture_volume(spec: &VolumeSpec, rle: &Value) -> Vec<u8> {
        let count = spec.dims.iter().product();
        let mut bytes = Vec::with_capacity(count);
        for run in rle.as_array().unwrap() {
            let length = run[0].as_u64().unwrap() as usize;
            let value = run[1].as_u64().unwrap() as u8;
            bytes.resize(bytes.len() + length, value);
        }
        assert_eq!(bytes.len(), count);
        bytes
    }

    #[cfg(not(target_arch = "wasm32"))]
    #[test]
    fn preparation_and_selected_doors_match_real_shared_building_voxels_exactly() {
        let fixtures = node_json(
            r#"
            const C=require('./prototypes/labs/city-lab/city-model.js'),
                P=require('./prototypes/labs/building-lab/plan.js'),
                V=require('./prototypes/labs/building-lab/voxels.js'),
                G=require('./prototypes/labs/city-lab/city-geometry.js');
            const city=C.generate(2,{terrain:'uneven'}),parcel=city.parcels[12],plan=P.generate(parcel.seed,parcel.options);
            const rle=v=>{const out=[];for(let i=0;i<v.length;){let j=i+1;while(j<v.length&&v[j]===v[i])j++;out.push([j-i,v[i]]);i=j;}return out;};
            const spec=b=>({dims:b.dims,cell:b.cell,origin:b.origin,levels:b.levels,plate:b.plate,cityFront:b.cityFront||0,M:b.M});
            const fixtures=[];
            for(const exterior of [false,true]){
                const b=V.build(plan,{exterior,closedDoors:true}),volume=spec(b),sourceRle=rle(b.vol);
                G.cityVolume(plan,b,exterior);
                const model=G.model(parcel,b),expected={volume:spec(b),model,rle:rle(b.vol)};
                const entry=plan.floors[0].openings.find(o=>o.kind==='front'&&plan.floors[0].rooms[o.room]?.zone==='resident')||plan.floors[0].openings.find(o=>o.kind==='front');
                const leaves=b.info.doorLeaves.filter(l=>l.floor===0&&l.room===entry?.room);
                let doors=null;
                if(!exterior){const d=G.doors(b,leaves);doors={leaves,
                    mesh:{...d.mesh,id:'door:'+parcel.id,model,verts:Array.from(d.mesh.verts),idx:Array.from(d.mesh.idx)},
                    indices:Array.from(d.indices),materials:Array.from(d.materials),boxes:d.boxes};}
                fixtures.push({meta:{plan,parcel,volume,exterior},sourceRle,expected,doors});
            }
            console.log(JSON.stringify(fixtures));
        "#,
        );
        for fixture in fixtures.as_array().unwrap() {
            let meta = fixture["meta"].clone();
            let spec: VolumeSpec = serde_json::from_value(meta["volume"].clone()).unwrap();
            let bytes = fixture_volume(&spec, &fixture["sourceRle"]);
            let mut request = Request::new("geometry.prepare", meta);
            request.buffers.push(Buffer::u8("vol", bytes));
            let reply = handle("geometry.prepare", &request).unwrap();
            let updated: VolumeSpec = serde_json::from_value(reply.meta["volume"].clone()).unwrap();
            let expected_spec: VolumeSpec =
                serde_json::from_value(fixture["expected"]["volume"].clone()).unwrap();
            assert_eq!(updated.dims, expected_spec.dims);
            assert_eq!(updated.origin, expected_spec.origin);
            assert_eq!(updated.cell, expected_spec.cell);
            assert_eq!(updated.levels, expected_spec.levels);
            assert_eq!(updated.plate, expected_spec.plate);
            assert_eq!(updated.materials, expected_spec.materials);
            assert_eq!(updated.city_front, expected_spec.city_front);
            let expected_model: Model =
                serde_json::from_value(fixture["expected"]["model"].clone()).unwrap();
            let actual_model: Model = serde_json::from_value(reply.meta["model"].clone()).unwrap();
            assert_eq!(actual_model, expected_model);
            let expected = fixture_volume(&spec, &fixture["expected"]["rle"]);
            compare_vec(&reply.buffers[0].bytes, &expected, "real prepared volume");
            if fixture["doors"].is_null()
                || !crate::mesh::implemented_operations().contains(&"mesh.segment")
            {
                continue;
            }
            let expected = &fixture["doors"];
            assert!(
                !expected["indices"].as_array().unwrap().is_empty(),
                "real entry leaf fixture must exercise extraction"
            );
            let mut request = Request::new(
                "geometry.doors",
                json!({"volume":updated,
                "model":actual_model,"id":expected["mesh"]["id"],"leaves":expected["leaves"]}),
            );
            request.buffers.push(reply.buffers[0].clone());
            let reply = handle("geometry.doors", &request).unwrap();
            let mesh = Mesh {
                meta: serde_json::from_value(reply.meta["mesh"].clone()).unwrap(),
                verts: reply
                    .buffers
                    .iter()
                    .find(|b| b.name == "verts")
                    .unwrap()
                    .as_u16()
                    .unwrap(),
                idx: reply
                    .buffers
                    .iter()
                    .find(|b| b.name == "idx")
                    .unwrap()
                    .as_u32()
                    .unwrap(),
                normals: None,
            };
            compare_mesh(&mesh, &expected["mesh"], "real selected entry door");
            assert_eq!(reply.meta["boxes"], expected["boxes"]);
            let indices: Vec<u32> = serde_json::from_value(expected["indices"].clone()).unwrap();
            let materials: Vec<u8> = serde_json::from_value(expected["materials"].clone()).unwrap();
            compare_vec(
                &reply
                    .buffers
                    .iter()
                    .find(|b| b.name == "indices")
                    .unwrap()
                    .as_u32()
                    .unwrap(),
                &indices,
                "real door indices",
            );
            compare_vec(
                &reply
                    .buffers
                    .iter()
                    .find(|b| b.name == "materials")
                    .unwrap()
                    .bytes,
                &materials,
                "real door materials",
            );
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    #[test]
    fn batch_packets_match_js_real_flat_then_uneven_exterior_full_mesh_sparse_and_rotated_doors() {
        let fixtures = node_json(
            r#"
            const C=require('./prototypes/labs/city-lab/city-model.js'),
                P=require('./prototypes/labs/building-lab/plan.js'),
                V=require('./prototypes/labs/building-lab/voxels.js'),
                G=require('./prototypes/labs/city-lab/city-geometry.js'),
                R=require('./prototypes/labs/building-lab/renderer.js'),
                Q=require('./prototypes/labs/city-lab/city-sparse.js'),
                B=require('./prototypes/labs/building-lab/review.js');
            const rle=v=>{const out=[];for(let i=0;i<v.length;){let j=i+1;while(j<v.length&&v[j]===v[i])j++;out.push([j-i,v[i]]);i=j;}return out;};
            const spec=b=>({dims:b.dims,cell:b.cell,origin:b.origin,levels:b.levels,plate:b.plate,cityFront:b.cityFront||0,M:b.M});
            const packed=(name,a)=>({name,rle:rle(new Uint8Array(a.buffer,a.byteOffset,a.byteLength))});
            const fixtures=[];
            for(const terrain of ['flat','uneven']){
                const city=C.generate(2,{terrain}),parcel={...city.parcels[12],right:[-.6,.8],inward:[.8,.6]},plan=P.generate(parcel.seed,parcel.options);
                for(const exterior of [true,false]){
                    const source=V.build(plan,{exterior,closedDoors:true}),volume=spec(source),sourceRle=rle(source.vol);
                    G.cityVolume(plan,source,exterior);
                    const model=G.model(parcel,source),entry=plan.floors[0].openings.find(o=>o.kind==='front'&&plan.floors[0].rooms[o.room]?.zone==='resident')||plan.floors[0].openings.find(o=>o.kind==='front');
                    const leaves=exterior?[]:source.info.doorLeaves,selectedLeaves=leaves.filter(l=>l.floor===0&&l.room===entry?.room);
                    const door=exterior?null:G.doors(source,selectedLeaves),opened=exterior?source:B.openDoors(source);
                    for(const render of ['mesh','sparse']){
                        const result=render==='mesh'?{...R.meshSegment(opened.vol,opened.dims,0,opened.dims[1]),id:'building:'+parcel.id,model}:Q.fromVolume(opened,model);
                        const names=render==='mesh'?['verts','idx']:['coarse','bricks','pal'],meta={...result},buffers=names.map(k=>{delete meta[k];return packed(k,result[k]);});
                        const bounds=G.bounds(render==='mesh'?result:{verts:Uint16Array.from([...result.lo,0,...result.hi,0])},opened);
                        let doorMesh=null;
                        if(door){doorMesh={quads:door.mesh.quads,id:'door:'+parcel.id,model};buffers.push(packed('doorVerts',door.mesh.verts),packed('doorIdx',door.mesh.idx),packed('doorIndices',door.indices),packed('doorMaterials',door.materials),packed('vol',opened.vol));}
                        fixtures.push({meta:{plan,parcel,volume,exterior,batch:{render,navigation:!exterior,leaves,selectedLeaves}},sourceRle,palette:Array.from(source.palette),expected:{meta,bounds,doorMesh,boxes:door?.boxes||null},buffers});
                    }
                }
            }
            console.log(JSON.stringify(fixtures));
        "#,
        );
        for fixture in fixtures.as_array().unwrap() {
            let spec: VolumeSpec =
                serde_json::from_value(fixture["meta"]["volume"].clone()).unwrap();
            let mut request = Request::new("geometry.prepare", fixture["meta"].clone());
            request.buffers.push(Buffer::u8(
                "vol",
                fixture_volume(&spec, &fixture["sourceRle"]),
            ));
            request.buffers.push(Buffer::u8(
                "palette",
                serde_json::from_value(fixture["palette"].clone()).unwrap(),
            ));
            let reply = packet(&request).unwrap();
            let render = if request.meta["batch"]["render"] == "mesh" {
                "mesh"
            } else {
                "ray"
            };
            compare_json(&reply.meta[render], &fixture["expected"]["meta"]);
            compare_json(&reply.meta["bounds"], &fixture["expected"]["bounds"]);
            compare_json(&reply.meta["doorMesh"], &fixture["expected"]["doorMesh"]);
            compare_json(&reply.meta["boxes"], &fixture["expected"]["boxes"]);
            let expand = |rle: &Value| {
                let mut bytes = Vec::new();
                for run in rle.as_array().unwrap() {
                    bytes.resize(
                        bytes.len() + run[0].as_u64().unwrap() as usize,
                        run[1].as_u64().unwrap() as u8,
                    );
                }
                bytes
            };
            assert_eq!(
                reply.buffers.len(),
                fixture["buffers"].as_array().unwrap().len()
            );
            for expected in fixture["buffers"].as_array().unwrap() {
                let name = expected["name"].as_str().unwrap();
                compare_vec(&buffer(&reply, name).bytes, &expand(&expected["rle"]), name);
            }
            // Same full render with nav disabled: no collision/source or selected
            // door buffers retained. Native CPU opening semantics stay identical.
            if request.meta["batch"]["navigation"] == true {
                request.meta["batch"]["navigation"] = json!(false);
                request.meta["batch"]["selectedLeaves"] = json!([]);
                let no_nav = packet(&request).unwrap();
                assert_eq!(no_nav.meta[render], reply.meta[render]);
                for b in &no_nav.buffers {
                    assert_eq!(b, buffer(&reply, &b.name));
                }
                assert!(
                    !no_nav
                        .buffers
                        .iter()
                        .any(|b| b.name == "vol" || b.name.starts_with("door"))
                );
                assert!(no_nav.meta["doorMesh"].is_null());
            }
        }
    }

    fn compare_mesh(actual: &Mesh, expected: &Value, label: &str) {
        let verts: Vec<u16> = serde_json::from_value(expected["verts"].clone()).unwrap();
        let idx: Vec<u32> = serde_json::from_value(expected["idx"].clone()).unwrap();
        let meta: crate::types::MeshMeta = serde_json::from_value(expected.clone()).unwrap();
        compare_vec(&actual.verts, &verts, &format!("{label} verts"));
        compare_vec(&actual.idx, &idx, &format!("{label} idx"));
        assert_eq!(actual.meta.id, meta.id, "{label} id");
        assert_eq!(actual.meta.quads, meta.quads, "{label} quads");
        assert_eq!(actual.meta.model, meta.model, "{label} model");
        assert_eq!(
            actual.meta.voxel_size, meta.voxel_size,
            "{label} voxel size"
        );
        assert_eq!(
            actual.meta.voxel_bytes, meta.voxel_bytes,
            "{label} voxel bytes"
        );
        assert!(actual.normals.is_none());
    }

    #[cfg(not(target_arch = "wasm32"))]
    #[test]
    fn facade_and_coarse_match_authoritative_js_buffers_for_real_city_plans() {
        let fixtures = node_json(
            r#"
            const C=require('./prototypes/labs/city-lab/city-model.js'),
                P=require('./prototypes/labs/building-lab/plan.js'),
                V=require('./prototypes/labs/building-lab/voxels.js'),
                G=require('./prototypes/labs/city-lab/city-geometry.js');
            const fixtures=[],mesh=m=>({verts:Array.from(m.verts),idx:Array.from(m.idx),
                id:m.id,quads:m.quads,model:m.model,voxelSize:m.voxelSize,voxelBytes:m.voxelBytes});
            for(const [seed,layout,width,terrain] of [[1,'woven',1,'flat'],[99,'grid',.75,'uneven'],[5,'woven',1.25,'uneven']]){
                const city=C.generate(seed,{layout,width,terrain});
                for(const id of [0,8,12,23]){
                    const parcel=city.parcels[id],plan=P.generate(parcel.seed,parcel.options),{w,d,masks}=plan.plot;
                    const input={plan,parcel,extent:city.extent,M:V.M,
                        spans:masks.map((m,f)=>P.facadeSpans(plan.plot,f,plan.facade.bays)),
                        rectangles:masks.map(m=>V.decompose(m,w,d)),
                        roofRectangles:masks.map((m,f)=>V.decompose(m.map((v,i)=>v&&!(f<masks.length-1&&masks[f+1][i])?1:0),w,d))};
                    fixtures.push({input,facade:mesh(G.planMesh(plan,parcel,city.extent,V.M)),
                        coarse:[.5,1,2].map(s=>mesh(G.coarseMesh(plan,parcel,city.extent,V.M,s)))});
                }
            }
            console.log(JSON.stringify(fixtures));
        "#,
        );
        for (case, fixture) in fixtures.as_array().unwrap().iter().enumerate() {
            let mut input: PlanGeometryInput =
                serde_json::from_value(fixture["input"].clone()).unwrap();
            let actual = facade(&input).unwrap();
            compare_mesh(&actual, &fixture["facade"], &format!("case {case} facade"));
            if crate::mesh::implemented_operations().contains(&"mesh.segment") {
                for (j, size) in [0.5, 1., 2.].into_iter().enumerate() {
                    input.voxel_size = size;
                    let actual = coarse(&input).unwrap();
                    let expected = &fixture["coarse"][j];
                    compare_mesh(&actual, expected, &format!("case {case} coarse {size}"));
                }
            }
        }
    }
}
