//! Stable module boundary. Binary arrays never go through serde_json.
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::Value;
use std::collections::BTreeMap;

pub type EngineResult<T> = Result<T, EngineError>;
pub type Materials = BTreeMap<String, u8>;
pub type Model = [f64; 16];

pub const IDENTITY: Model = [
    1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1.,
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EngineError {
    pub code: String,
    pub message: String,
}
impl EngineError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
    pub fn pending(op: &str) -> Self {
        Self::new(
            "NOT_IMPLEMENTED",
            format!("Rust operation {op} is not implemented; JavaScript fallback is forbidden"),
        )
    }
    pub fn invalid(message: impl Into<String>) -> Self {
        Self::new("INVALID_REQUEST", message)
    }
}
impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}
impl std::error::Error for EngineError {}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BufferKind {
    U8,
    U16,
    U32,
    I32,
    F32,
}
impl BufferKind {
    pub fn width(self) -> usize {
        match self {
            Self::U8 => 1,
            Self::U16 => 2,
            _ => 4,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Buffer {
    pub name: String,
    pub kind: BufferKind,
    pub bytes: Vec<u8>,
}
impl Buffer {
    pub fn u8(name: &str, bytes: Vec<u8>) -> Self {
        Self {
            name: name.into(),
            kind: BufferKind::U8,
            bytes,
        }
    }
    pub fn u16(name: &str, values: &[u16]) -> Self {
        Self::words(
            name,
            BufferKind::U16,
            values.iter().flat_map(|v| v.to_le_bytes()).collect(),
        )
    }
    pub fn u32(name: &str, values: &[u32]) -> Self {
        Self::words(
            name,
            BufferKind::U32,
            values.iter().flat_map(|v| v.to_le_bytes()).collect(),
        )
    }
    pub fn i32(name: &str, values: &[i32]) -> Self {
        Self::words(
            name,
            BufferKind::I32,
            values.iter().flat_map(|v| v.to_le_bytes()).collect(),
        )
    }
    pub fn f32(name: &str, values: &[f32]) -> Self {
        Self::words(
            name,
            BufferKind::F32,
            values.iter().flat_map(|v| v.to_le_bytes()).collect(),
        )
    }
    fn words(name: &str, kind: BufferKind, bytes: Vec<u8>) -> Self {
        Self {
            name: name.into(),
            kind,
            bytes,
        }
    }
    pub fn as_u16(&self) -> EngineResult<Vec<u16>> {
        self.check(BufferKind::U16)?;
        Ok(self
            .bytes
            .chunks_exact(2)
            .map(|v| u16::from_le_bytes([v[0], v[1]]))
            .collect())
    }
    pub fn as_u32(&self) -> EngineResult<Vec<u32>> {
        self.check(BufferKind::U32)?;
        Ok(self
            .bytes
            .chunks_exact(4)
            .map(|v| u32::from_le_bytes(v.try_into().unwrap()))
            .collect())
    }
    pub fn as_i32(&self) -> EngineResult<Vec<i32>> {
        self.check(BufferKind::I32)?;
        Ok(self
            .bytes
            .chunks_exact(4)
            .map(|v| i32::from_le_bytes(v.try_into().unwrap()))
            .collect())
    }
    pub fn check(&self, kind: BufferKind) -> EngineResult<()> {
        if self.kind != kind || !self.bytes.len().is_multiple_of(kind.width()) {
            return Err(EngineError::invalid(format!(
                "Invalid typed buffer {}",
                self.name
            )));
        }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct Request {
    pub op: String,
    pub meta: Value,
    pub buffers: Vec<Buffer>,
}
impl Request {
    pub fn new(op: &str, meta: Value) -> Self {
        Self {
            op: op.into(),
            meta,
            buffers: Vec::new(),
        }
    }
    pub fn meta_as<T: DeserializeOwned>(&self) -> EngineResult<T> {
        serde_json::from_value(self.meta.clone()).map_err(|e| EngineError::invalid(e.to_string()))
    }
    pub fn buffer(&self, name: &str, kind: BufferKind) -> EngineResult<&Buffer> {
        let b = self
            .buffers
            .iter()
            .find(|b| b.name == name)
            .ok_or_else(|| EngineError::invalid(format!("Missing buffer {name}")))?;
        b.check(kind)?;
        Ok(b)
    }
    pub fn volume(&self, spec: &VolumeSpec) -> EngineResult<Volume> {
        let volume = Volume {
            spec: spec.clone(),
            vol: self.buffer("vol", BufferKind::U8)?.bytes.clone(),
        };
        volume.validate()?;
        Ok(volume)
    }
}
#[derive(Debug, Clone)]
pub struct Reply {
    pub meta: Value,
    pub buffers: Vec<Buffer>,
}
impl Reply {
    pub fn new(meta: Value) -> Self {
        Self {
            meta,
            buffers: Vec::new(),
        }
    }
}

/// Exact BuildingVoxels volume coordinates: x + X * (z + Z * y), not XYZ-linear.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeSpec {
    pub dims: [usize; 3],
    pub cell: f64,
    pub origin: [i32; 3],
    #[serde(default)]
    pub levels: Vec<usize>,
    #[serde(default)]
    pub plate: usize,
    #[serde(default)]
    pub city_front: f64,
    #[serde(default, rename = "M")]
    pub materials: Materials,
}
#[derive(Debug, Clone)]
pub struct Volume {
    pub spec: VolumeSpec,
    pub vol: Vec<u8>,
}
impl Volume {
    pub fn validate(&self) -> EngineResult<()> {
        let expected = self
            .spec
            .dims
            .iter()
            .try_fold(1usize, |n, d| n.checked_mul(*d));
        if self.spec.dims.contains(&0)
            || self.spec.dims.iter().any(|d| *d > u16::MAX as usize)
            || expected != Some(self.vol.len())
            || !self.spec.cell.is_finite()
            || self.spec.cell <= 0.
        {
            return Err(EngineError::invalid(
                "Invalid volume dimensions, length or cell size",
            ));
        }
        Ok(())
    }
}
#[derive(Debug, Clone)]
pub struct Ownership {
    pub indices: Vec<u32>,
    pub segments: Vec<i32>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshMeta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub quads: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<Model>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voxel_size: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voxel_bytes: Option<usize>,
}
#[derive(Debug, Clone, Default)]
pub struct Mesh {
    pub meta: MeshMeta,
    /// uint16 x,y,z, normal | material<<8. Normals 0..5 = +X,-X,+Y,-Y,+Z,-Z.
    pub verts: Vec<u16>,
    pub idx: Vec<u32>,
    /// Only vegetation supplies these; architectural meshes must leave this None (hard).
    pub normals: Option<Vec<f32>>,
}
impl Mesh {
    pub fn into_reply(self) -> EngineResult<Reply> {
        let mut buffers = vec![
            Buffer::u16("verts", &self.verts),
            Buffer::u32("idx", &self.idx),
        ];
        if let Some(normals) = self.normals {
            buffers.push(Buffer::f32("normals", &normals));
        }
        Ok(Reply {
            meta: serde_json::to_value(self.meta)
                .map_err(|e| EngineError::invalid(e.to_string()))?,
            buffers,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SparseMeta {
    pub n: [usize; 3],
    pub offset: [usize; 3],
    pub o: [f64; 3],
    pub cvs: f64,
    pub sub: usize,
    pub brick_rows: usize,
    pub nb: usize,
    pub mixed_cells: usize,
    pub frame: SparseFrame,
    pub lo: [usize; 3],
    pub hi: [usize; 3],
    pub bytes: usize,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SparseFrame {
    pub x: f64,
    pub z: f64,
    pub rot: f64,
}
#[derive(Debug, Clone)]
pub struct Sparse {
    pub meta: SparseMeta,
    pub coarse: Vec<u16>,
    pub bricks: Vec<u8>,
    pub pal: Vec<u8>,
}
impl Sparse {
    pub fn into_reply(self) -> EngineResult<Reply> {
        Ok(Reply {
            meta: serde_json::to_value(self.meta)
                .map_err(|e| EngineError::invalid(e.to_string()))?,
            buffers: vec![
                Buffer::u16("coarse", &self.coarse),
                Buffer::u8("bricks", self.bricks),
                Buffer::u8("pal", self.pal),
            ],
        })
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct SparseOptions {
    pub deduplicate: bool,
    pub crop: bool,
}
impl Default for SparseOptions {
    fn default() -> Self {
        Self {
            deduplicate: true,
            crop: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct CityOptions {
    pub layout: String,
    pub terrain: String,
    pub width: f64,
    pub count: u32,
}
impl Default for CityOptions {
    fn default() -> Self {
        Self {
            layout: "woven".into(),
            terrain: "flat".into(),
            width: 1.,
            count: 24,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CityGenerateInput {
    pub seed: u32,
    #[serde(default)]
    pub options: CityOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Target {
    pub id: u32,
    pub mode: String,
    pub near: bool,
    pub voxel_size: f64,
    pub distance: f64,
    pub projected: f64,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct View {
    pub height: Option<f64>,
    pub fov: Option<f64>,
    pub aspect: Option<f64>,
    /// Optional horizontal world [X,Z] camera direction, normalized by policy.
    /// Absent/zero uses conservative all-around streaming, never frustum unloading.
    pub forward: Option<[f64; 2]>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamTargetsInput {
    #[serde(default)]
    pub city: Option<Value>,
    #[serde(default)]
    #[serde(rename = "cityId")]
    pub city_id: Option<u32>,
    #[serde(default)]
    pub compact: bool,
    pub position: [f64; 3],
    #[serde(default)]
    pub previous: Vec<Target>,
    pub mode: String,
    pub pinned: Option<u32>,
    #[serde(default)]
    pub view: View,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntrySummary {
    pub id: u32,
    pub entry: Option<[f64; 2]>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamPrefetchInput {
    pub position: Option<[f64; 3]>,
    pub summaries: Vec<EntrySummary>,
    pub current: Option<u32>,
    #[serde(default)]
    pub inside: bool,
}

/// Keep the full plan language (floors/rooms/openings, masks, roof/facade), not a new house schema.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanGeometryInput {
    pub plan: Value,
    pub parcel: Value,
    pub extent: f64,
    #[serde(rename = "M")]
    pub materials: Materials,
    /// BuildingPlan.facadeSpans(plan.plot, floor, plan.facade.bays), one array per floor.
    #[serde(default)]
    pub spans: Vec<Vec<Value>>,
    /// BuildingVoxels.decompose(mask,w,d); inclusive [x0,z0,x1,z1], per floor.
    #[serde(default)]
    pub rectangles: Vec<Vec<[usize; 4]>>,
    /// Decomposition of mask[f] && !mask[f+1], per floor (top = mask[top]).
    #[serde(default)]
    pub roof_rectangles: Vec<Vec<[usize; 4]>>,
    #[serde(default = "one")]
    pub voxel_size: f64,
}
fn one() -> f64 {
    1.
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrepareInput {
    pub plan: Value,
    pub parcel: Value,
    pub volume: VolumeSpec,
    pub exterior: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoorLeaf {
    pub floor: usize,
    pub room: usize,
    pub r#box: [usize; 6],
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoorsInput {
    pub volume: VolumeSpec,
    pub leaves: Vec<DoorLeaf>,
    pub model: Model,
    pub id: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshInput {
    pub volume: VolumeSpec,
    pub y0: usize,
    pub y1: usize,
    #[serde(default = "minus_one")]
    pub segment: i32,
    pub id: Option<String>,
    pub model: Option<Model>,
}
fn minus_one() -> i32 {
    -1
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SparseInput {
    pub volume: VolumeSpec,
    pub model: Model,
    #[serde(default)]
    pub options: SparseOptions,
}
