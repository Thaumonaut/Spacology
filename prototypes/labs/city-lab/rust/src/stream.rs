//! Pure CityStream policy. Targets never schedule interiors; prefetch returns one ID.
//! Queueing, stale epochs, physical doors and the 128 MiB upload cap remain with the caller.
use crate::types::{
    Buffer, BufferKind, EngineError, EngineResult, Reply, Request, StreamPrefetchInput,
    StreamTargetsInput, Target,
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

pub fn implemented_operations() -> &'static [&'static str] {
    &["stream.targets", "stream.prefetch"]
}
pub fn handle(op: &str, request: &Request) -> EngineResult<Reply> {
    match op {
        "stream.targets" => {
            let mut input: StreamTargetsInput = request.meta_as()?;
            if !request.buffers.is_empty() {
                if !input.compact || request.buffers.len() != 1 || !input.previous.is_empty() {
                    return Err(EngineError::invalid("Invalid compact previous targets"));
                }
                let previous = request.buffer("previous", BufferKind::U32)?.as_u32()?;
                if !previous.len().is_multiple_of(2) {
                    return Err(EngineError::invalid("Invalid previous target stride"));
                }
                for pair in previous.chunks_exact(2) {
                    let (mode, near, voxel_size) = decode_flags(pair[1])?;
                    input.previous.push(Target {
                        id: pair[0],
                        mode: mode.into(),
                        near,
                        voxel_size,
                        distance: 0.,
                        projected: 0.,
                    });
                }
            }
            let result = targets(&input)?;
            if !input.compact {
                return Ok(Reply::new(json!({"targets": result})));
            }
            let mut bytes = Vec::with_capacity(result.len() * 24);
            for target in &result {
                bytes.extend_from_slice(&target.id.to_le_bytes());
                bytes.extend_from_slice(&encode_flags(target)?.to_le_bytes());
                bytes.extend_from_slice(&target.distance.to_le_bytes());
                bytes.extend_from_slice(&target.projected.to_le_bytes());
            }
            Ok(Reply {
                meta: json!({"count": result.len(), "stride": 24}),
                buffers: vec![Buffer::u8("targets", bytes)],
            })
        }
        "stream.prefetch" => {
            if !request.buffers.is_empty() {
                return Err(EngineError::invalid("Prefetch takes metadata only"));
            }
            Ok(Reply::new(json!({"id": prefetch(&request.meta_as()?)?})))
        }
        _ => Err(EngineError::pending(op)),
    }
}
fn decode_flags(flags: u32) -> EngineResult<(&'static str, bool, f64)> {
    let mode = match flags & 3 {
        0 => "low",
        1 => "facade",
        2 => "exterior",
        _ => return Err(EngineError::invalid("Invalid packed target mode")),
    };
    let voxel_size = match flags >> 3 {
        0 => 0.5,
        1 => 1.,
        2 => 2.,
        _ => return Err(EngineError::invalid("Invalid packed voxel size")),
    };
    Ok((mode, flags & 4 != 0, voxel_size))
}
fn encode_flags(target: &Target) -> EngineResult<u32> {
    let mode = match target.mode.as_str() {
        "low" => 0,
        "facade" => 1,
        "exterior" => 2,
        _ => return Err(EngineError::invalid("Invalid packed target mode")),
    };
    let size = match target.voxel_size {
        0.5 => 0,
        1. => 1,
        2. => 2,
        _ => return Err(EngineError::invalid("Invalid packed voxel size")),
    };
    Ok(mode | if target.near { 4 } else { 0 } | (size << 3))
}

/// Same cache identity as CityStream.key. It is a typed helper, not an extra ABI operation.
pub fn key(target: &Target) -> String {
    match target.mode.as_str() {
        "low" => format!("low:{}", target.voxel_size),
        "exterior" => format!("exterior:{}", if target.near { "near" } else { "mid" }),
        other => other.into(),
    }
}
#[derive(Deserialize)]
struct City {
    parcels: Vec<Parcel>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Parcel {
    id: u32,
    origin: [f64; 2],
    right: [f64; 2],
    inward: [f64; 2],
    width: f64,
    depth: f64,
    pad_y: f64,
    options: Options,
    envelope: Option<Envelope>,
    #[serde(skip)]
    center: [f64; 2],
    #[serde(skip)]
    height: f64,
    #[serde(skip)]
    a: [f64; 2],
    #[serde(skip)]
    b: [f64; 2],
    #[serde(skip)]
    radius: f64,
    #[serde(skip)]
    margin: f64,
}
#[derive(Deserialize, Default)]
#[serde(default)]
struct Envelope {
    front: f64,
    rear: f64,
    side: f64,
}
#[derive(Deserialize)]
struct Options {
    storeys: Option<Value>,
}
thread_local! {
    static CITIES: RefCell<BTreeMap<u32, Arc<City>>> = const { RefCell::new(BTreeMap::new()) };
}
const MAX_CACHED_CITIES: usize = 4;
fn stream_city(input: &StreamTargetsInput) -> EngineResult<Arc<City>> {
    if let Some(value) = &input.city {
        let mut parsed: City = serde_json::from_value(value.clone())
            .map_err(|e| EngineError::invalid(e.to_string()))?;
        let mut seen = BTreeSet::new();
        for p in &mut parsed.parcels {
            if !seen.insert(p.id)
                || !finite(&p.origin)
                || !finite(&p.right)
                || !finite(&p.inward)
                || !finite(&[p.width, p.depth, p.pad_y])
                || p.width <= 0.
                || p.depth <= 0.
            {
                return Err(EngineError::invalid("Invalid or duplicate stream parcel"));
            }
            p.a = [p.right[0] * p.width, p.right[1] * p.width];
            p.b = [p.inward[0] * p.depth, p.inward[1] * p.depth];
            p.center = [
                p.origin[0] + p.a[0] / 2. + p.b[0] / 2.,
                p.origin[1] + p.a[1] / 2. + p.b[1] / 2.,
            ];
            p.margin = 2.;
            if let Some(e) = &p.envelope {
                if !finite(&[e.front, e.rear, e.side]) {
                    return Err(EngineError::invalid("Invalid stream envelope"));
                }
                p.margin = p.margin.max(e.front).max(e.rear).max(e.side);
            }
            p.radius = hypot2((p.a[0] + p.b[0]) / 2., (p.a[1] + p.b[1]) / 2.)
                .max(hypot2((p.a[0] - p.b[0]) / 2., (p.a[1] - p.b[1]) / 2.))
                + p.margin;
            p.height = storeys(p.options.storeys.as_ref())? * 3. + 3.;
            if !finite(&[
                p.center[0],
                p.center[1],
                p.height,
                p.radius,
                p.a[0] * p.b[1] - p.a[1] * p.b[0],
                p.a[0] * p.a[0] + p.a[1] * p.a[1],
                p.b[0] * p.b[0] + p.b[1] * p.b[1],
            ]) {
                return Err(EngineError::invalid("Stream coordinates overflow"));
            }
        }
        let result = Arc::new(parsed);
        if let Some(id) = input.city_id {
            CITIES.with_borrow_mut(|cities| {
                if cities.len() >= MAX_CACHED_CITIES
                    && !cities.contains_key(&id)
                    && let Some(first) = cities.keys().next().copied()
                {
                    cities.remove(&first);
                }
                cities.insert(id, Arc::clone(&result));
            });
        }
        Ok(result)
    } else if let Some(id) = input.city_id {
        CITIES
            .with_borrow(|cities| cities.get(&id).cloned())
            .ok_or_else(|| EngineError::new("UNKNOWN_CITY", "Rust city cache expired"))
    } else {
        Err(EngineError::invalid("Missing stream city or cityId"))
    }
}
fn storeys(value: Option<&Value>) -> EngineResult<f64> {
    // The baseline uses Number(options.storeys)||3 (normal generated cities use 3 or 4).
    let v = match value {
        None | Some(Value::Null) => 0.,
        Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        Some(Value::String(s)) => {
            if s.trim().is_empty() {
                0.
            } else {
                s.trim().parse().unwrap_or(f64::NAN)
            }
        }
        Some(Value::Bool(b)) => {
            if *b {
                1.
            } else {
                0.
            }
        }
        _ => return Err(EngineError::invalid("Invalid parcel storeys")),
    };
    if v.is_infinite() {
        return Err(EngineError::invalid("Parcel storeys must be finite"));
    }
    Ok(if v == 0. || v.is_nan() { 3. } else { v })
}
fn finite(values: &[f64]) -> bool {
    values.iter().all(|v| v.is_finite())
}
// Match JS scaled Math.hypot evaluation order, including strict policy boundaries.
fn hypot2(a: f64, b: f64) -> f64 {
    let (a, b) = (a.abs(), b.abs());
    let max = a.max(b);
    if max == 0. || max.is_infinite() {
        return max;
    }
    let (a, b) = (a / max, b / max);
    (a * a + b * b).sqrt() * max
}
fn edge_distance(x: f64, z: f64, e: [f64; 2]) -> f64 {
    let length = e[0] * e[0] + e[1] * e[1];
    let t = if length == 0. {
        0.
    } else {
        ((x * e[0] + z * e[1]) / length).clamp(0., 1.)
    };
    hypot2(x - t * e[0], z - t * e[1])
}
fn surface_distance(p: &Parcel, position: [f64; 3]) -> f64 {
    let x = position[0] - p.origin[0];
    let z = position[2] - p.origin[1];
    let det = p.a[0] * p.b[1] - p.a[1] * p.b[0];
    let (u, v) = if det == 0. {
        (-1., -1.)
    } else {
        (
            (x * p.b[1] - z * p.b[0]) / det,
            (p.a[0] * z - p.a[1] * x) / det,
        )
    };
    let horizontal = if (0. ..=1.).contains(&u) && (0. ..=1.).contains(&v) {
        0.
    } else {
        edge_distance(x, z, p.a)
            .min(edge_distance(x, z, p.b))
            .min(edge_distance(x - p.a[0], z - p.a[1], p.b))
            .min(edge_distance(x - p.b[0], z - p.b[1], p.a))
    };
    let dy = 0_f64
        .max(p.pad_y - position[1])
        .max(position[1] - p.pad_y - p.height - 2.);
    hypot2((horizontal - p.margin).max(0.), dy)
}

// Exactly the city-stream.js policy (metres/pixels, strict thresholds).
// Stream: 16 all-around + 24 view + 24 held exteriors including pinned;
// <=6 close-protection flags; no interiors.
// The caller's 128 MiB upload cap remains authoritative, NOT a count-to-byte claim.
// Comparison detailed/full deliberately keep all exteriors. Dense overflow keeps
// facades until tiny: >12px acquire, >8px retain (also when stepping from exterior).
// Surface prism expands XZ by max(2m, declared envelope), roof by 2m. All-around close
// 14/20m and local 36/48m; forward 96/120m at >48/>32px with 25/40deg angular
// margin (min65/80deg, max85/100deg) plus parcel bounding radius. Held exteriors
// have 112m all-around turn retention, 24m rank bias (32m near). Forward rank
// bias 32m applies only outside close/local groups so turns cannot churn near keys.
// It exceeds mid retention so a saturated exterior budget can follow a large turn.
// Absent/zero forward uses all-around 64/80m. Never use the frustum to unload.
const BASE_EXTERIORS: usize = 16;
const VIEW_EXTERIORS: usize = 24;
const HELD_EXTERIORS: usize = 24;
const MAX_NEAR: usize = 6;
struct Ranked<'a> {
    parcel: &'a Parcel,
    old: Option<&'a Target>,
    distance: f64,
    pixels_per_metre: f64,
    projected: f64,
    close: bool,
    eligible: bool,
    visible: bool,
    group: u8,
    rank: f64,
}

/// Output order is JS Map insertion order, not parcel ID order. All decisions use f64.
pub fn targets(input: &StreamTargetsInput) -> EngineResult<Vec<Target>> {
    if !finite(&input.position)
        || !["stream", "detailed", "full", "exterior"].contains(&input.mode.as_str())
    {
        return Err(EngineError::invalid("Invalid stream position or mode"));
    }
    let city = stream_city(input)?;
    let height = input.view.height.filter(|h| *h != 0.).unwrap_or(720.);
    let fov = input
        .view
        .fov
        .filter(|f| *f != 0.)
        .unwrap_or(70. * std::f64::consts::PI / 180.);
    if !height.is_finite()
        || height <= 0.
        || !fov.is_finite()
        || fov <= 0.
        || fov >= std::f64::consts::PI
    {
        return Err(EngineError::invalid("Invalid stream view height or fov"));
    }
    let projection = height / (2. * (fov / 2.).tan());
    let aspect = input.view.aspect.filter(|a| *a != 0.).unwrap_or(1.);
    if !aspect.is_finite() || aspect <= 0. {
        return Err(EngineError::invalid("Invalid stream view aspect"));
    }
    let view_cos = (((fov / 2.).tan() * aspect).atan() + 10. * std::f64::consts::PI / 180.)
        .min(std::f64::consts::PI / 2.)
        .cos();
    let forward = if let Some(v) = input.view.forward {
        if !finite(&v) {
            return Err(EngineError::invalid("Invalid stream forward"));
        }
        let length = hypot2(v[0], v[1]);
        if !length.is_finite() {
            return Err(EngineError::invalid("Stream forward overflow"));
        }
        if length == 0. {
            None
        } else {
            Some([v[0] / length, v[1] / length])
        }
    } else {
        None
    };
    let mut previous = BTreeMap::new();
    for old in &input.previous {
        if previous.insert(old.id, old).is_some()
            || !finite(&[old.voxel_size, old.distance, old.projected])
        {
            return Err(EngineError::invalid("Invalid or duplicate previous target"));
        }
    }
    let angle_cos = [false, true].map(|held| {
        ((if held { 100. } else { 85. }) * std::f64::consts::PI / 180.)
            .min(
                ((if held { 80. } else { 65. }) * std::f64::consts::PI / 180.)
                    .max(fov / 2. + (if held { 40. } else { 25. }) * std::f64::consts::PI / 180.),
            )
            .cos()
    });
    let mut ranked = Vec::new();
    for p in &city.parcels {
        let distance = surface_distance(p, input.position);
        let x = p.center[0] - input.position[0];
        let z = p.center[1] - input.position[2];
        let horizontal = hypot2(x, z);
        let old = previous.get(&p.id).copied();
        let held = old.is_some_and(|t| t.mode == "exterior");
        let ahead = forward.is_none_or(|f| {
            horizontal == 0.
                || (x * f[0] + z * f[1] + p.radius) / horizontal >= angle_cos[usize::from(held)]
        });
        let visible = forward.is_some_and(|f| {
            horizontal == 0. || (x * f[0] + z * f[1] + p.radius) / horizontal >= view_cos
        });
        let close = distance
            < if old.is_some_and(|t| t.near) {
                20.
            } else {
                14.
            };
        let local = distance < if held { 48. } else { 36. };
        let pixels_per_metre = projection / distance.max(1.);
        let projected = (p.radius * 2.).max(p.height) * pixels_per_metre;
        let eligible = close
            || local
            || if forward.is_some() {
                held && distance < 112.
                    || ahead
                        && distance < if held { 120. } else { 96. }
                        && projected > if held { 32. } else { 48. }
            } else {
                distance < if held { 80. } else { 64. }
            };
        let rank = distance
            - if held {
                if old.is_some_and(|t| t.near) {
                    32.
                } else {
                    24.
                }
            } else {
                0.
            }
            - if ahead && forward.is_some() && !close && !local {
                32.
            } else {
                0.
            };
        if !finite(&[distance, horizontal, projected, pixels_per_metre, rank]) {
            return Err(EngineError::invalid(
                "Stream coordinates or projection overflow",
            ));
        }
        ranked.push(Ranked {
            parcel: p,
            old,
            distance,
            pixels_per_metre,
            projected,
            close,
            eligible,
            visible,
            group: if close {
                0
            } else if local {
                1
            } else {
                2
            },
            rank,
        });
    }
    ranked.sort_by(|a, b| {
        (Some(b.parcel.id) == input.pinned)
            .cmp(&(Some(a.parcel.id) == input.pinned))
            .then_with(|| a.group.cmp(&b.group))
            // JS treats signed zero as a tie; do not use total_cmp here.
            .then_with(|| a.rank.partial_cmp(&b.rank).unwrap())
            .then_with(|| a.parcel.id.cmp(&b.parcel.id))
    });
    let mut selected = BTreeSet::new();
    if input.mode == "stream" {
        for (pass, limit) in [BASE_EXTERIORS, VIEW_EXTERIORS, HELD_EXTERIORS]
            .into_iter()
            .enumerate()
        {
            let mut count = 0;
            for r in &ranked {
                if count < limit
                    && !selected.contains(&r.parcel.id)
                    && (r.eligible || Some(r.parcel.id) == input.pinned)
                    && match pass {
                        0 => true,
                        1 => r.visible,
                        _ => r.old.is_some_and(|t| t.mode == "exterior") && r.distance < 112.,
                    }
                {
                    selected.insert(r.parcel.id);
                    count += 1;
                }
            }
        }
        ranked.sort_by_key(|r| !selected.contains(&r.parcel.id));
    }
    let mut near_count = 0;
    let mut desired = Vec::with_capacity(ranked.len());
    for Ranked {
        parcel: p,
        distance,
        old,
        pixels_per_metre,
        projected,
        close,
        ..
    } in ranked
    {
        let (mut tier, mut near) = ("low", false);
        if Some(p.id) == input.pinned {
            tier = "exterior";
            near = true;
            near_count += 1;
        } else if input.mode == "detailed" || input.mode == "full" {
            tier = "exterior";
            near = near_count < MAX_NEAR;
            near_count += 1;
        } else if input.mode == "stream" && selected.contains(&p.id) {
            tier = "exterior";
            near = close && near_count < MAX_NEAR;
            near_count += usize::from(near);
        }
        if tier == "low"
            && input.mode != "exterior"
            && projected
                > if old.is_some_and(|t| t.mode == "facade" || t.mode == "exterior") {
                    8.
                } else {
                    12.
                }
        {
            tier = "facade";
        }
        let mut voxel_size = if pixels_per_metre > 1. {
            0.5
        } else if pixels_per_metre > 0.5 {
            1.
        } else {
            2.
        };
        if let Some(old) = old
            && old.mode == "low"
        {
            if old.voxel_size == 0.5 && pixels_per_metre > 0.85 {
                voxel_size = 0.5;
            } else if old.voxel_size == 1. && pixels_per_metre < 1.15 && pixels_per_metre > 0.425 {
                voxel_size = 1.;
            } else if old.voxel_size == 2. && pixels_per_metre < 0.575 {
                voxel_size = 2.;
            }
        }
        if !finite(&[projected, pixels_per_metre]) {
            return Err(EngineError::invalid("Stream projection overflow"));
        }
        desired.push(Target {
            id: p.id,
            mode: tier.into(),
            near,
            voxel_size,
            distance,
            projected,
        });
    }
    Ok(desired)
}

/// A single nearby doorway: <12m acquire, <18m retain, 2m competition hysteresis.
/// Null position is checked before inside, matching JS; inside otherwise holds current.
pub fn prefetch(input: &StreamPrefetchInput) -> EngineResult<Option<u32>> {
    let Some(position) = input.position else {
        return Ok(None);
    };
    if !finite(&position) {
        return Err(EngineError::invalid("Invalid prefetch position"));
    }
    if input.inside && input.current.is_some() {
        return Ok(input.current);
    }
    let mut seen = BTreeSet::new();
    let mut ranked = Vec::new();
    for s in &input.summaries {
        if !seen.insert(s.id) {
            return Err(EngineError::invalid("Duplicate entry summary"));
        }
        if let Some(entry) = s.entry {
            if !finite(&entry) {
                return Err(EngineError::invalid("Invalid doorway entry"));
            }
            let distance = hypot2(position[0] - entry[0], position[2] - entry[1]);
            if !distance.is_finite() {
                return Err(EngineError::invalid("Prefetch coordinates overflow"));
            }
            ranked.push((s.id, distance));
        }
    }
    ranked.sort_by(|(a, ad), (b, bd)| ad.total_cmp(bd).then_with(|| a.cmp(b)));
    let held = ranked.iter().find(|(id, _)| Some(*id) == input.current);
    let nearest = ranked.first();
    if let Some((_, distance)) = held
        && *distance < 18.
        && nearest.is_none_or(|(id, d)| Some(*id) == input.current || d + 2. >= *distance)
    {
        return Ok(input.current);
    }
    Ok(nearest.filter(|(_, d)| *d < 12.).map(|(id, _)| *id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CityGenerateInput, CityOptions, EntrySummary, View};
    use std::io::Write;
    use std::process::{Command, Stdio};

    fn city(count: u32) -> Value {
        crate::city::generate(CityGenerateInput {
            seed: 1,
            options: CityOptions {
                count,
                ..Default::default()
            },
        })
        .unwrap()
    }
    fn request(city: Value, position: [f64; 3], mode: &str) -> StreamTargetsInput {
        StreamTargetsInput {
            city: Some(city),
            city_id: None,
            compact: false,
            position,
            previous: vec![],
            mode: mode.into(),
            pinned: None,
            view: View::default(),
        }
    }
    fn parcel_at(id: u32, x: f64) -> Value {
        // Centre exactly at [x,0], so threshold tests do not depend on topology/trig rounding.
        json!({"id":id,"origin":[x-4.,-6.],"right":[1.,0.],"inward":[0.,1.],"width":8.,"depth":12.,"padY":0.,"options":{"storeys":3}})
    }
    #[test]
    fn targets_are_architecture_first_and_never_unbounded_interiors() {
        let c = city(24);
        let position = [0., 2., c["landmarks"]["gate"]["z"].as_f64().unwrap()];
        let mut r = request(c.clone(), position, "stream");
        let initial = targets(&r).unwrap();
        assert!(initial.iter().all(|t| t.mode != "full" && t.mode != "low"));
        assert!(initial.iter().filter(|t| t.near).count() <= MAX_NEAR);
        assert!(initial.iter().filter(|t| t.mode == "exterior").count() <= 64);
        assert!(initial.iter().any(|t| t.mode == "facade"));
        r.previous = initial.clone();
        assert_eq!(json!(targets(&r).unwrap()), json!(initial));
        for mode in ["detailed", "full"] {
            r.mode = mode.into();
            let t = targets(&r).unwrap();
            assert!(t.iter().all(|t| t.mode == "exterior"));
            assert_eq!(t.iter().filter(|t| t.near).count(), MAX_NEAR);
        }
        r.mode = "exterior".into();
        assert!(targets(&r).unwrap().iter().all(|t| t.mode == "low"));
        r = request(c.clone(), [999., 2., 999.], "stream");
        assert!(
            targets(&r)
                .unwrap()
                .iter()
                .all(|t| t.mode == "low" && t.voxel_size == 2.)
        );
        r.pinned = Some(0);
        let t = targets(&r).unwrap();
        assert_eq!(t[0].id, 0);
        assert_eq!(t[0].mode, "exterior");
        assert!(t[0].near);
        let big = targets(&request(city(1000), position, "stream")).unwrap();
        assert!(big.iter().any(|t| t.mode == "facade"));
        assert!(big.iter().all(|t| t.mode != "low" || t.projected <= 12.));
        let mut zoom = request(c, [500., 2., 500.], "stream");
        zoom.view = View {
            height: Some(1440.),
            fov: Some(0.4),
            ..Default::default()
        };
        assert!(targets(&zoom).unwrap().iter().all(|t| t.mode == "facade"));
    }
    #[test]
    fn strict_thresholds_ranking_biases_and_cache_keys() {
        let mut r = request(
            json!({"parcels":[parcel_at(2,20.),parcel_at(1,20.),parcel_at(3,70.),parcel_at(4,86.)]}),
            [0., 2., 0.],
            "stream",
        );
        let t = targets(&r).unwrap();
        assert_eq!(t.iter().map(|t| t.id).collect::<Vec<_>>(), [1, 2, 3, 4]);
        assert!(t.iter().all(|t| !t.near));
        assert_eq!(t[0].mode, "exterior");
        assert_ne!(t[2].mode, "exterior"); // surface exactly 64 is not acquired
        r.previous = t;
        r.previous[0].near = true;
        r.previous[2].mode = "exterior".into();
        let t = targets(&r).unwrap();
        assert!(t[0].near);
        assert_eq!(t[2].mode, "exterior");
        r.city = Some(json!({"parcels":[parcel_at(1,26.),parcel_at(3,86.)]}));
        let t = targets(&r).unwrap();
        assert!(!t[0].near);
        assert_ne!(t[1].mode, "exterior");
        let mut t = t[0].clone();
        t.mode = "low".into();
        t.voxel_size = 0.5;
        assert_eq!(key(&t), "low:0.5");
        t.voxel_size = 1.;
        assert_eq!(key(&t), "low:1");
        t.voxel_size = 2.;
        assert_eq!(key(&t), "low:2");
        t.mode = "facade".into();
        assert_eq!(key(&t), "facade");
        t.mode = "full".into();
        assert_eq!(key(&t), "full");
        t.mode = "exterior".into();
        t.near = true;
        assert_eq!(key(&t), "exterior:near");
        t.near = false;
        assert_eq!(key(&t), "exterior:mid");
    }
    #[test]
    fn prefetch_exact_boundaries_competition_hold_and_release() {
        let mut r = StreamPrefetchInput {
            position: None,
            summaries: vec![
                EntrySummary {
                    id: 0,
                    entry: Some([0., 0.]),
                },
                EntrySummary {
                    id: 1,
                    entry: Some([20., 0.]),
                },
            ],
            current: None,
            inside: false,
        };
        assert_eq!(prefetch(&r).unwrap(), None);
        for (z, expected) in [(11.999, Some(0)), (12., None)] {
            r.position = Some([0., 2., z]);
            assert_eq!(prefetch(&r).unwrap(), expected);
        }
        r.current = Some(0);
        for (z, expected) in [(17.999, Some(0)), (18., None)] {
            r.position = Some([0., 2., z]);
            assert_eq!(prefetch(&r).unwrap(), expected);
        }
        r.position = Some([11., 2., 0.]);
        assert_eq!(prefetch(&r).unwrap(), Some(0)); // 9+2 == 11
        r.position = Some([11.001, 2., 0.]);
        assert_eq!(prefetch(&r).unwrap(), Some(1));
        r.position = Some([999., 2., 999.]);
        r.inside = true;
        assert_eq!(prefetch(&r).unwrap(), Some(0));
        r.position = None;
        assert_eq!(prefetch(&r).unwrap(), None);
        r.inside = false;
        r.position = Some([10., 2., 0.]);
        r.current = None;
        r.summaries.reverse();
        assert_eq!(prefetch(&r).unwrap(), Some(0)); // ID tie break, not array order
        r.summaries[0].entry = None;
        assert_eq!(prefetch(&r).unwrap(), Some(0));
        r.summaries[1].entry = None;
        assert_eq!(prefetch(&r).unwrap(), None);
    }
    #[test]
    fn cached_compact_targets_preserve_full_f64_results_and_expire_safely() {
        let value = city(24);
        let mut input = request(value.clone(), [0., 2., 0.], "stream");
        let expected = targets(&input).unwrap();
        let mut query = Request::new(
            "stream.targets",
            json!({
                "city":value,"cityId":17,"position":input.position,
                "mode":"stream","pinned":null,"compact":true,
            }),
        );
        let first = handle("stream.targets", &query).unwrap();
        assert_eq!(first.meta, json!({"count":expected.len(),"stride":24}));
        for (bytes, target) in first.buffers[0].bytes.chunks_exact(24).zip(&expected) {
            assert_eq!(
                u32::from_le_bytes(bytes[0..4].try_into().unwrap()),
                target.id
            );
            assert_eq!(
                u32::from_le_bytes(bytes[4..8].try_into().unwrap()),
                encode_flags(target).unwrap()
            );
            assert_eq!(
                f64::from_le_bytes(bytes[8..16].try_into().unwrap()).to_bits(),
                target.distance.to_bits()
            );
            assert_eq!(
                f64::from_le_bytes(bytes[16..24].try_into().unwrap()).to_bits(),
                target.projected.to_bits()
            );
        }
        input.previous = expected;
        let words: Vec<u32> = input
            .previous
            .iter()
            .flat_map(|t| [t.id, encode_flags(t).unwrap()])
            .collect();
        query.meta.as_object_mut().unwrap().remove("city");
        query.buffers = vec![Buffer::u32("previous", &words)];
        let held = handle("stream.targets", &query).unwrap();
        for (bytes, target) in held.buffers[0]
            .bytes
            .chunks_exact(24)
            .zip(targets(&input).unwrap())
        {
            assert_eq!(
                f64::from_le_bytes(bytes[8..16].try_into().unwrap()).to_bits(),
                target.distance.to_bits()
            );
            assert_eq!(
                u32::from_le_bytes(bytes[4..8].try_into().unwrap()),
                encode_flags(&target).unwrap()
            );
        }
        for id in 18..=21 {
            let mut cached = input.clone();
            cached.city_id = Some(id);
            targets(&cached).unwrap();
        }
        assert_eq!(
            handle("stream.targets", &query).unwrap_err().code,
            "UNKNOWN_CITY"
        );
        query.meta["city"] = value;
        assert!(handle("stream.targets", &query).is_ok());
    }
    #[test]
    fn node_buffer_matrix_matches_exact_policy_flags_order_and_compact_records() {
        // This JS fixture also has independent behavioral assertions in npm's
        // focused city-stream route. No WASM asset is rebuilt by native tests.
        let output = Command::new("node")
            .args([
                "../../../../tests/unit/city-stream-buffer.cjs",
                "--fixtures",
            ])
            .current_dir(env!("CARGO_MANIFEST_DIR"))
            .output()
            .expect("Node 24 required for buffer matrix parity");
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        #[derive(Deserialize)]
        struct Case {
            input: StreamTargetsInput,
            expected: Vec<Target>,
        }
        let cases: Vec<Case> = serde_json::from_slice(&output.stdout).unwrap();
        assert!(
            cases.len() >= 1396,
            "keep the full boundary/turn/density matrix"
        );
        for (
            index,
            Case {
                mut input,
                expected,
            },
        ) in cases.into_iter().enumerate()
        {
            let actual = targets(&input).unwrap();
            assert_eq!(actual.len(), expected.len(), "case {index}");
            for (a, b) in actual.iter().zip(&expected) {
                assert_eq!(
                    (a.id, &a.mode, a.near, a.voxel_size),
                    (b.id, &b.mode, b.near, b.voxel_size),
                    "case {index}: {}",
                    json!(input)
                );
                assert_eq!(
                    encode_flags(a).unwrap(),
                    encode_flags(b).unwrap(),
                    "case {index}"
                );
                for (x, y) in [(a.distance, b.distance), (a.projected, b.projected)] {
                    assert!(
                        (x - y).abs() <= 1e-12 * x.abs().max(1.),
                        "case {index}: {x} != {y}"
                    );
                }
            }
            // Exercise exactly the production packed previous-state/24-byte path,
            // with cached geometry descriptors and the new optional view field.
            input.city_id = Some(100);
            input.compact = true;
            let words: Vec<u32> = input
                .previous
                .iter()
                .flat_map(|t| [t.id, encode_flags(t).unwrap()])
                .collect();
            input.previous.clear();
            let mut query = Request::new("stream.targets", json!(input));
            query.buffers = vec![Buffer::u32("previous", &words)];
            let compact = handle("stream.targets", &query).unwrap();
            query.meta.as_object_mut().unwrap().remove("city");
            let cached = handle("stream.targets", &query).unwrap();
            assert_eq!(
                compact.buffers, cached.buffers,
                "cached matrix case {index}"
            );
            for (bytes, t) in compact.buffers[0].bytes.chunks_exact(24).zip(&actual) {
                assert_eq!(u32::from_le_bytes(bytes[..4].try_into().unwrap()), t.id);
                assert_eq!(
                    u32::from_le_bytes(bytes[4..8].try_into().unwrap()),
                    encode_flags(t).unwrap()
                );
                assert_eq!(
                    f64::from_le_bytes(bytes[8..16].try_into().unwrap()).to_bits(),
                    t.distance.to_bits()
                );
                assert_eq!(
                    f64::from_le_bytes(bytes[16..24].try_into().unwrap()).to_bits(),
                    t.projected.to_bits()
                );
            }
        }
    }
    #[test]
    fn compact_targets_reject_malformed_previous_buffers_and_flags() {
        let mut query = Request::new(
            "stream.targets",
            json!({
                "city":city(24),"position":[0.,2.,0.],"mode":"stream","pinned":null,"compact":true,
            }),
        );
        for words in [vec![0], vec![0, 3], vec![0, 24], vec![0, 0, 0, 0]] {
            query.buffers = vec![Buffer::u32("previous", &words)];
            assert_eq!(
                handle("stream.targets", &query).unwrap_err().code,
                "INVALID_REQUEST"
            );
        }
        query.buffers = vec![Buffer::u8("previous", vec![0; 8])];
        assert_eq!(
            handle("stream.targets", &query).unwrap_err().code,
            "INVALID_REQUEST"
        );
        query.buffers = vec![Buffer::u32("unexpected", &[0, 0])];
        assert_eq!(
            handle("stream.targets", &query).unwrap_err().code,
            "INVALID_REQUEST"
        );
    }
    #[test]
    fn metadata_operations_round_trip_through_native_packet_abi() {
        use crate::abi::{decode_reply, encode_request, execute_packet};
        let input = request(
            json!({"parcels":[parcel_at(2,20.),parcel_at(1,10.)]}),
            [0., 2., 0.],
            "stream",
        );
        let packet = encode_request(&Request::new("stream.targets", json!(input))).unwrap();
        let reply = decode_reply(&execute_packet(&packet)).unwrap();
        assert!(reply.buffers.is_empty());
        assert_eq!(reply.meta["targets"][0]["id"], 1);
        assert_eq!(reply.meta["targets"][0]["mode"], "exterior");
        assert_eq!(reply.meta["targets"][0]["near"], true);
        let packet = encode_request(&Request::new("stream.prefetch", json!({"position":[0.,2.,0.],"summaries":[{"id":7,"entry":[0.,0.]}],"current":null,"inside":false}))).unwrap();
        let reply = decode_reply(&execute_packet(&packet)).unwrap();
        assert!(reply.buffers.is_empty());
        assert_eq!(reply.meta, json!({"id":7}));
    }
    #[test]
    fn invalid_requests_return_bounded_errors() {
        let mut r = request(
            json!({"parcels":[parcel_at(1,0.),parcel_at(1,1.)]}),
            [0., 2., 0.],
            "stream",
        );
        assert_eq!(targets(&r).unwrap_err().code, "INVALID_REQUEST");
        r.city = Some(json!({"parcels":[parcel_at(1,0.)]}));
        r.position[0] = f64::NAN;
        assert_eq!(targets(&r).unwrap_err().code, "INVALID_REQUEST");
        r.position[0] = 0.;
        r.view.fov = Some(-1.);
        assert_eq!(targets(&r).unwrap_err().code, "INVALID_REQUEST");
        r.view.fov = None;
        r.view.forward = Some([f64::NAN, 0.]);
        assert_eq!(targets(&r).unwrap_err().code, "INVALID_REQUEST");
        r.view.forward = Some([f64::MAX, f64::MAX]);
        assert_eq!(targets(&r).unwrap_err().code, "INVALID_REQUEST");
        r.view.forward = None;
        r.mode = "other".into();
        assert_eq!(targets(&r).unwrap_err().code, "INVALID_REQUEST");
        let p = StreamPrefetchInput {
            position: Some([f64::INFINITY, 0., 0.]),
            summaries: vec![],
            current: None,
            inside: false,
        };
        assert_eq!(prefetch(&p).unwrap_err().code, "INVALID_REQUEST");
        for op in implemented_operations() {
            assert_eq!(
                handle(op, &Request::new(op, json!({}))).unwrap_err().code,
                "INVALID_REQUEST"
            );
        }
    }
    #[test]
    fn node_policy_parity_camera_paths_hysteresis_modes_prefetch_and_keys() {
        let script = r#"
const S=require('../city-stream.js'),assert=require('node:assert/strict'),fs=require('node:fs');
const cases=JSON.parse(fs.readFileSync(0,'utf8'));
for(const {input,actual,cityIndex} of cases.targets){
 if(input.city===null)input.city=cases.cities[cityIndex];
 const previous=new Map(input.previous.map(({id,...t})=>[id,t]));
 const expected=[...S.targets(input.city,input.position,previous,input.mode,input.pinned,input.view)].map(([id,t])=>({id,...t}));
 assert.equal(actual.length,expected.length);
 actual.forEach((a,i)=>{const b=expected[i];for(const k of ['id','mode','near','voxelSize'])assert.equal(a[k],b[k],JSON.stringify({i,k,position:input.position,mode:input.mode,a,b}));for(const k of ['distance','projected'])assert.ok(Math.abs(a[k]-b[k])<=1e-6,k+': '+a[k]+' '+b[k]);assert.equal(S.key(a),S.key(b));});
}
for(const {input,actual} of cases.prefetch){const summaries=Object.fromEntries(input.summaries.map(s=>[s.id,{entry:s.entry}]));assert.equal(actual,S.prefetch(input.position,summaries,input.current,input.inside),JSON.stringify(input));}
"#;
        let mut target_cases = Vec::new();
        let cities: Vec<Value> = [24, 100, 1000].into_iter().map(city).collect();
        for (city_index, city) in cities.iter().enumerate() {
            for mode in ["stream", "detailed", "full", "exterior"] {
                for view in [
                    View::default(),
                    View {
                        height: Some(1440.),
                        fov: Some(0.4),
                        ..Default::default()
                    },
                    View {
                        height: Some(0.),
                        fov: Some(0.),
                        ..Default::default()
                    },
                    View {
                        forward: Some([0., 1.]),
                        ..Default::default()
                    },
                    View {
                        forward: Some([-3., 4.]),
                        ..Default::default()
                    },
                    View {
                        forward: Some([0., 0.]),
                        ..Default::default()
                    },
                ] {
                    let mut r = request(city.clone(), [0., 2., 0.], mode);
                    r.view = view;
                    for (step, pos) in [
                        [0., 2., 42.],
                        [3., 2., 30.],
                        [-15., 2., 12.],
                        [-20., 2., 0.],
                        [30., 40., -10.],
                        [100., 2., 100.],
                        [500., 2., 500.],
                        [999., 200., 999.],
                        [0., 2., 42.],
                    ]
                    .into_iter()
                    .enumerate()
                    {
                        r.position = pos;
                        r.pinned = if step == 5 { Some(0) } else { None };
                        let actual = targets(&r).unwrap();
                        let mut wire_input = serde_json::to_value(&r).unwrap();
                        wire_input["city"] = Value::Null;
                        target_cases.push(
                            json!({"input":wire_input,"cityIndex":city_index,"actual":actual}),
                        );
                        r.previous = actual;
                    }
                }
            }
        }
        // Synthetic projection/voxel/facade threshold sweeps with all prior states.
        for ppm in [
            0.4, 0.425, 0.426, 0.499, 0.5, 0.501, 0.574, 0.575, 0.85, 0.851, 0.999, 1., 1.001,
            1.149, 1.15, 1.151, 1.34, 1.67,
        ] {
            for mode in ["low", "facade", "exterior"] {
                for voxel_size in [0.5, 1., 2.] {
                    let mut r = request(
                        json!({"parcels":[parcel_at(9,1000.)]}),
                        [0., 2., 0.],
                        "stream",
                    );
                    r.view = View {
                        height: Some(ppm * 1000. * 2. * (0.5_f64).tan()),
                        fov: Some(1.),
                        ..Default::default()
                    };
                    r.previous = vec![Target {
                        id: 9,
                        mode: mode.into(),
                        near: false,
                        voxel_size,
                        distance: 1000.,
                        projected: 12. * ppm,
                    }];
                    target_cases.push(json!({"actual":targets(&r).unwrap(),"input":r}));
                }
            }
        }
        // Diagonal threshold circles catch one-ulp changes in Math.hypot, not just X-axis cases.
        for radius in [14., 20., 36., 48., 64., 80., 96., 112., 120.] {
            for angle in [0.1_f64, 0.3, 0.7, 1.1, 1.7, 2.3, 3.5, 4.7] {
                let mut p = parcel_at(9, radius * angle.cos());
                p["origin"][1] = json!(radius * angle.sin() - 6.);
                for prior in [None, Some("near"), Some("exterior")] {
                    let mut r = request(json!({"parcels":[p.clone()]}), [0., 2., 0.], "stream");
                    if let Some(prior) = prior {
                        r.previous = vec![Target {
                            id: 9,
                            mode: "exterior".into(),
                            near: prior == "near",
                            voxel_size: 0.5,
                            distance: radius,
                            projected: 100.,
                        }];
                    }
                    target_cases.push(json!({"actual":targets(&r).unwrap(),"input":r}));
                }
            }
        }
        let mut prefetch_cases = Vec::new();
        for radius in [12., 18.] {
            for angle in [0.1_f64, 0.3, 0.7, 1.1, 1.7, 2.3, 3.5, 4.7] {
                for current in [None, Some(0)] {
                    let input = StreamPrefetchInput {
                        position: Some([radius * angle.cos(), 2., radius * angle.sin()]),
                        summaries: vec![EntrySummary {
                            id: 0,
                            entry: Some([0., 0.]),
                        }],
                        current,
                        inside: false,
                    };
                    prefetch_cases.push(json!({"actual":prefetch(&input).unwrap(),"input":input}));
                }
            }
        }
        for x in [
            -20., 0., 9., 10., 11., 11.001, 12., 17.999, 18., 20., 40., 999.,
        ] {
            for z in [0., 11.999, 12., 17.999, 18., 999.] {
                for current in [None, Some(0), Some(1), Some(99)] {
                    for inside in [false, true] {
                        let input = StreamPrefetchInput {
                            position: Some([x, 2., z]),
                            summaries: vec![
                                EntrySummary {
                                    id: 1,
                                    entry: Some([20., 0.]),
                                },
                                EntrySummary {
                                    id: 0,
                                    entry: Some([0., 0.]),
                                },
                                EntrySummary { id: 2, entry: None },
                            ],
                            current,
                            inside,
                        };
                        prefetch_cases
                            .push(json!({"actual":prefetch(&input).unwrap(),"input":input}));
                    }
                }
            }
        }
        let data = serde_json::to_vec(
            &json!({"cities":cities,"targets":target_cases,"prefetch":prefetch_cases}),
        )
        .unwrap();
        let mut child = Command::new("node")
            .args(["-e", script])
            .current_dir(env!("CARGO_MANIFEST_DIR"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("Node 24 required for JS policy parity");
        // Child drains stdin before evaluating fixtures, so large city cases cannot deadlock output.
        child.stdin.take().unwrap().write_all(&data).unwrap();
        let output = child.wait_with_output().unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
}
