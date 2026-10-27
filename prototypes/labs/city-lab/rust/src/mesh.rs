//! Exact BuildingRenderer.meshSegment port: voxel corners, hard normals, greedy order.
use crate::types::{
    BufferKind, EngineError, EngineResult, Mesh, MeshInput, Ownership, Reply, Request, Volume,
};
use std::collections::HashMap;

pub fn implemented_operations() -> &'static [&'static str] {
    &["mesh.segment"]
}

pub fn handle(op: &str, request: &Request) -> EngineResult<Reply> {
    if op != "mesh.segment" {
        return Err(EngineError::pending(op));
    }
    let input: MeshInput = request.meta_as()?;
    // Request::volume copies the input buffer. This is intentionally inside ABI execution,
    // not excluded from loader executeMs; direct geometry calls borrow their existing Volume.
    let volume = request.volume(&input.volume)?;
    let has_indices = request.buffers.iter().any(|b| b.name == "ownerIndices");
    let has_segments = request.buffers.iter().any(|b| b.name == "ownerSegments");
    if has_indices != has_segments {
        return Err(EngineError::invalid(
            "ownerIndices and ownerSegments must be supplied together",
        ));
    }
    let ownership = if has_indices {
        Some(Ownership {
            indices: request.buffer("ownerIndices", BufferKind::U32)?.as_u32()?,
            segments: request.buffer("ownerSegments", BufferKind::I32)?.as_i32()?,
        })
    } else {
        None
    };
    if input
        .model
        .is_some_and(|m| m.iter().any(|v| !v.is_finite()))
    {
        return Err(EngineError::invalid("Mesh model must be finite"));
    }
    let mut mesh = mesh_segment(
        &volume,
        input.y0,
        input.y1,
        ownership.as_ref(),
        input.segment,
    )?;
    mesh.meta.id = input.id;
    mesh.meta.model = input.model;
    mesh.into_reply()
}

/// Ownership is an exact JS Map: an explicit owner overrides the clip, including
/// when it excludes an otherwise in-clip voxel or includes one beyond the clip.
/// Segment IDs are signed i32 values and are matched exactly (default -1).
/// Unowned voxels alone obey [y0,y1); selected owned voxels extend scan bounds.
pub fn mesh_segment(
    volume: &Volume,
    y0: usize,
    y1: usize,
    ownership: Option<&Ownership>,
    segment: i32,
) -> EngineResult<Mesh> {
    volume.validate()?;
    let dims = volume.spec.dims;
    if y0 > y1 || y1 > dims[1] {
        return Err(EngineError::invalid("Invalid mesh y clip"));
    }
    let mut owners = HashMap::new();
    let (mut scan0, mut scan1) = (y0, y1);
    if let Some(ownership) = ownership {
        if ownership.indices.len() != ownership.segments.len() {
            return Err(EngineError::invalid("Ownership lengths differ"));
        }
        for (&i, &owner) in ownership.indices.iter().zip(&ownership.segments) {
            if i as usize >= volume.vol.len() || owners.insert(i as usize, owner).is_some() {
                return Err(EngineError::invalid(
                    "Ownership indices must be unique and within the volume",
                ));
            }
            if owner == segment {
                let y = i as usize / (dims[0] * dims[2]);
                scan0 = scan0.min(y);
                scan1 = scan1.max(y + 1);
            }
        }
    }
    let at = |c: [isize; 3]| -> u8 {
        if (0..3).any(|a| c[a] < 0 || c[a] as usize >= dims[a]) {
            return 0;
        }
        let [x, y, z] = c.map(|v| v as usize);
        let i = x + dims[0] * (z + dims[2] * y);
        let visible = match owners.get(&i) {
            Some(&owner) => owner == segment,
            None => y >= y0 && y < y1,
        };
        if visible { volume.vol[i] } else { 0 }
    };
    let mut lo = dims;
    let mut hi = [0; 3];
    let mut solid = false;
    for y in scan0..scan1 {
        for z in 0..dims[2] {
            for x in 0..dims[0] {
                let c = [x, y, z];
                if at(c.map(|v| v as isize)) != 0 {
                    solid = true;
                    for a in 0..3 {
                        lo[a] = lo[a].min(c[a]);
                        hi[a] = hi[a].max(c[a]);
                    }
                }
            }
        }
    }
    let mut mesh = Mesh::default();
    if !solid {
        return Ok(mesh);
    }
    for axis in 0..3 {
        let u = (axis + 1) % 3;
        let v = (axis + 2) % 3;
        let width = hi[u] - lo[u] + 1;
        let height = hi[v] - lo[v] + 1;
        let mut mask = vec![0u8; width * height];
        for dir in [1isize, -1] {
            let normal = (axis * 2 + usize::from(dir < 0)) as u16;
            for q in lo[axis]..=hi[axis] {
                mask.fill(0);
                for b in 0..height {
                    for a in 0..width {
                        let mut c = [0; 3];
                        c[axis] = q as isize;
                        c[u] = (lo[u] + a) as isize;
                        c[v] = (lo[v] + b) as isize;
                        let material = at(c);
                        if material != 0 {
                            c[axis] += dir;
                            // A material boundary is NOT an air boundary.
                            if at(c) == 0 {
                                mask[a + width * b] = material;
                            }
                        }
                    }
                }
                for b in 0..height {
                    let mut a = 0;
                    while a < width {
                        let material = mask[a + width * b];
                        if material == 0 {
                            a += 1;
                            continue;
                        }
                        let mut w = 1;
                        while a + w < width && mask[a + w + width * b] == material {
                            w += 1;
                        }
                        let mut h = 1;
                        'rows: while b + h < height {
                            for k in 0..w {
                                if mask[a + k + width * (b + h)] != material {
                                    break 'rows;
                                }
                            }
                            h += 1;
                        }
                        for hh in 0..h {
                            mask[a + width * (b + hh)..a + w + width * (b + hh)].fill(0);
                        }
                        let mut p = [0; 3];
                        p[axis] = q + usize::from(dir > 0);
                        p[u] = lo[u] + a;
                        p[v] = lo[v] + b;
                        let mut du = [0; 3];
                        let mut dv = [0; 3];
                        du[u] = w;
                        dv[v] = h;
                        append_quad(&mut mesh, p, du, dv, normal | ((material as u16) << 8))?;
                        a += w;
                    }
                }
            }
        }
    }
    Ok(mesh)
}

fn append_quad(
    mesh: &mut Mesh,
    p: [usize; 3],
    du: [usize; 3],
    dv: [usize; 3],
    packed: u16,
) -> EngineResult<()> {
    // 4 * 8-byte packed vertices + 6 * uint32 indices. This is a per-result guard;
    // the caller still enforces the unchanged 128 MiB aggregate residency cap.
    if mesh.meta.quads >= crate::GEOMETRY_BUDGET_BYTES / 56 {
        return Err(EngineError::new(
            "GEOMETRY_BUDGET_EXCEEDED",
            "Mesh exceeds 128 MiB geometry cap",
        ));
    }
    // Keep baseline winding even for negative faces: du/dv are NOT swapped by dir.
    for [a, b] in [[0, 0], [1, 0], [1, 1], [0, 1]] {
        for axis in 0..3 {
            mesh.verts
                .push((p[axis] + a * du[axis] + b * dv[axis]) as u16);
        }
        mesh.verts.push(packed);
    }
    let base = (mesh.meta.quads * 4) as u32;
    mesh.idx
        .extend_from_slice(&[base, base + 1, base + 2, base, base + 2, base + 3]);
    mesh.meta.quads += 1;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Buffer, IDENTITY, VolumeSpec};
    use serde_json::json;
    use std::collections::BTreeSet;

    fn volume(dims: [usize; 3], fill: u8) -> Volume {
        Volume {
            spec: serde_json::from_value::<VolumeSpec>(json!({
                "dims":dims,"cell":0.0625,"origin":[-3,7,-11]
            }))
            .unwrap(),
            vol: vec![fill; dims.iter().product()],
        }
    }

    #[test]
    fn single_voxel_golden_bytes_indices_and_baseline_winding() {
        let mesh = mesh_segment(&volume([1, 1, 1], 255), 0, 1, None, -1).unwrap();
        let faces = [
            [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
            [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]],
            [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
            [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]],
            [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
            [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
        ];
        let expected: Vec<u16> = faces
            .iter()
            .enumerate()
            .flat_map(|(n, corners)| {
                corners
                    .iter()
                    .flat_map(move |&[x, y, z]| [x, y, z, 0xff00 | n as u16])
            })
            .collect();
        assert_eq!(mesh.verts, expected);
        assert_eq!(mesh.meta.quads, 6);
        assert!(mesh.normals.is_none(), "architecture must stay hard");
        for q in 0..6 {
            let b = q as u32 * 4;
            assert_eq!(
                &mesh.idx[q * 6..q * 6 + 6],
                &[b, b + 1, b + 2, b, b + 2, b + 3]
            );
        }
    }

    #[test]
    fn empty_solid_clips_and_uint16_corner_limit() {
        assert_eq!(
            mesh_segment(&volume([4, 5, 6], 0), 0, 5, None, -1)
                .unwrap()
                .meta
                .quads,
            0
        );
        let v = volume([5, 6, 7], 17);
        assert_eq!(mesh_segment(&v, 0, 6, None, -1).unwrap().meta.quads, 6);
        assert_eq!(mesh_segment(&v, 2, 4, None, -1).unwrap().meta.quads, 6);
        assert_eq!(mesh_segment(&v, 3, 3, None, -1).unwrap().meta.quads, 0);
        assert!(mesh_segment(&v, 4, 3, None, -1).is_err());
        assert!(mesh_segment(&v, 0, 7, None, -1).is_err());
        let m = mesh_segment(&volume([65535, 1, 1], 255), 0, 1, None, -1).unwrap();
        assert_eq!(m.meta.quads, 6);
        assert_eq!(m.verts.chunks_exact(4).map(|p| p[0]).max(), Some(65535));
        let mut over = Mesh::default();
        over.meta.quads = crate::GEOMETRY_BUDGET_BYTES / 56;
        assert_eq!(
            append_quad(&mut over, [0; 3], [0; 3], [0; 3], 0)
                .unwrap_err()
                .code,
            "GEOMETRY_BUDGET_EXCEEDED"
        );
        assert!(over.verts.is_empty());
    }

    type Face = (usize, usize, usize, usize, u8);
    fn unit_faces(mesh: &Mesh) -> BTreeSet<Face> {
        let mut faces = BTreeSet::new();
        for quad in mesh.verts.chunks_exact(16) {
            let n = (quad[3] & 255) as usize;
            let material = (quad[3] >> 8) as u8;
            let axis = n / 2;
            let u = (axis + 1) % 3;
            let v = (axis + 2) % 3;
            let width = quad[4 + u] - quad[u];
            let height = quad[12 + v] - quad[v];
            assert!(width > 0 && height > 0);
            for a in 0..width {
                for b in 0..height {
                    assert!(
                        faces.insert((
                            n,
                            quad[axis] as usize,
                            (quad[u] + a) as usize,
                            (quad[v] + b) as usize,
                            material
                        )),
                        "overlapping faces"
                    );
                }
            }
        }
        faces
    }

    #[test]
    fn randomized_unit_face_material_and_ownership_parity() {
        let mut seed = 0x12345678u32;
        for case in 0..40 {
            let mut v = volume([7, 9, 5], 0);
            for value in &mut v.vol {
                seed ^= seed << 13;
                seed ^= seed >> 17;
                seed ^= seed << 5;
                *value = [0, 0, 0, 1, 7, 128, 255][seed as usize % 7];
            }
            let (y0, y1) = (case % 5, 5 + case % 5);
            let owner = Ownership {
                indices: (0..v.vol.len()).step_by(11).map(|i| i as u32).collect(),
                segments: (0..v.vol.len())
                    .step_by(11)
                    .map(|i| (i % 3) as i32 - 1)
                    .collect(),
            };
            let segment = (case % 3) as i32 - 1;
            let owners: HashMap<_, _> = owner
                .indices
                .iter()
                .zip(&owner.segments)
                .map(|(&i, &s)| (i as usize, s))
                .collect();
            let at = |c: [isize; 3]| {
                if c[0] < 0 || c[0] >= 7 || c[1] < 0 || c[1] >= 9 || c[2] < 0 || c[2] >= 5 {
                    return 0;
                }
                let [x, y, z] = c.map(|a| a as usize);
                let i = x + 7 * (z + 5 * y);
                if owners.get(&i).map_or(y >= y0 && y < y1, |&o| o == segment) {
                    v.vol[i]
                } else {
                    0
                }
            };
            let mut expected = BTreeSet::new();
            for y in 0..9 {
                for z in 0..5 {
                    for x in 0..7 {
                        let c = [x, y, z];
                        let material = at(c.map(|a| a as isize));
                        if material == 0 {
                            continue;
                        }
                        for n in 0..6 {
                            let axis = n / 2;
                            let mut neighbor = c.map(|a| a as isize);
                            neighbor[axis] += if n % 2 == 0 { 1 } else { -1 };
                            if at(neighbor) == 0 {
                                expected.insert((
                                    n,
                                    c[axis] + usize::from(n % 2 == 0),
                                    c[(axis + 1) % 3],
                                    c[(axis + 2) % 3],
                                    material,
                                ));
                            }
                        }
                    }
                }
            }
            let mesh = mesh_segment(&v, y0, y1, Some(&owner), segment).unwrap();
            assert_eq!(unit_faces(&mesh), expected, "case {case}");
            assert!(mesh.normals.is_none());
        }
    }

    #[test]
    fn owned_voxels_override_even_an_empty_clip_and_close_selected_segments() {
        let mut v = volume([1, 6, 1], 0);
        v.vol[0] = 1;
        v.vol[3] = 7;
        v.vol[5] = 255;
        let owner = Ownership {
            indices: vec![0, 3, 5],
            segments: vec![-1, 2, -1],
        };
        let selected = mesh_segment(&v, 3, 3, Some(&owner), -1).unwrap();
        assert_eq!(
            selected.meta.quads, 12,
            "two owned voxels beyond both empty-clip bounds"
        );
        let faces = unit_faces(&selected);
        assert!(faces.iter().all(|f| f.4 == 1 || f.4 == 255));
        assert_eq!(
            mesh_segment(&v, 0, 6, Some(&owner), 2).unwrap().meta.quads,
            6
        );
        assert_eq!(
            mesh_segment(&v, 0, 6, Some(&owner), 99).unwrap().meta.quads,
            0
        );
    }

    #[test]
    fn invalid_ownership_and_handler_buffers_are_rejected() {
        let v = volume([2, 3, 4], 1);
        for owner in [
            Ownership {
                indices: vec![0],
                segments: vec![],
            },
            Ownership {
                indices: vec![0, 0],
                segments: vec![1, 1],
            },
            Ownership {
                indices: vec![24],
                segments: vec![0],
            },
        ] {
            assert_eq!(
                mesh_segment(&v, 0, 3, Some(&owner), -1).unwrap_err().code,
                "INVALID_REQUEST"
            );
        }
        let mut request = Request::new("mesh.segment", json!({"volume":v.spec,"y0":0,"y1":3}));
        request.buffers = vec![Buffer::u8("vol", v.vol), Buffer::u32("ownerIndices", &[0])];
        assert!(handle("mesh.segment", &request).is_err());
        request.buffers.push(Buffer::u32("ownerSegments", &[0]));
        assert!(
            handle("mesh.segment", &request).is_err(),
            "wrong signed buffer kind"
        );
    }

    #[test]
    fn repeated_packet_results_own_buffers_and_preserve_models() {
        let v = volume([3, 4, 5], 7);
        let mut model = IDENTITY;
        model[12] = -31.;
        model[13] = -2.;
        model[14] = 17.;
        model[0] = 0.;
        model[2] = -1.;
        model[8] = 1.;
        model[10] = 0.;
        let mut request = Request::new(
            "mesh.segment",
            json!({"volume":v.spec,"y0":0,"y1":4,
                                                           "id":"negative-frame","model":model}),
        );
        request.buffers = vec![Buffer::u8("vol", v.vol)];
        let packet = crate::abi::encode_request(&request).unwrap();
        let mut first = crate::abi::decode_reply(&crate::abi::execute_packet(&packet)).unwrap();
        let expected = first.buffers.clone();
        first.buffers[0].bytes.fill(0);
        for _ in 0..100 {
            let reply = crate::abi::decode_reply(&crate::abi::execute_packet(&packet)).unwrap();
            assert_eq!(reply.buffers, expected);
            assert_eq!(reply.meta["model"], json!(model));
            assert_eq!(reply.meta["id"], "negative-frame");
            assert_eq!(reply.buffers.len(), 2, "no smooth architectural normals");
        }
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn byte_identical_to_current_javascript_greedy_mesher() {
        use std::io::Write;
        use std::process::{Command, Stdio};
        let mut fixtures = vec![];
        let mut meshes = vec![];
        let mut seed = 0xdecafbadu32;
        for case in 0..24 {
            let mut v = volume([5 + case % 3, 7, 6 + case % 4], 0);
            for material in &mut v.vol {
                seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                *material = if case == 0 {
                    0
                } else if case == 1 {
                    255
                } else {
                    [0, 0, 1, 7, 255][(seed >> 16) as usize % 5]
                };
            }
            let owner = Ownership {
                indices: (0..v.vol.len()).step_by(17).map(|i| i as u32).collect(),
                segments: (0..v.vol.len())
                    .step_by(17)
                    .map(|i| (i % 3) as i32 - 1)
                    .collect(),
            };
            let (y0, y1, segment) = (case % 4, 4 + case % 4, (case % 3) as i32 - 1);
            let ownership = if case.is_multiple_of(2) {
                None
            } else {
                Some(&owner)
            };
            fixtures.push(json!({"dims":v.spec.dims,"vol":v.vol,"y0":y0,"y1":y1,
                "owners":ownership.map(|o|o.indices.iter().zip(&o.segments).collect::<Vec<_>>()),"segment":segment}));
            meshes.push(mesh_segment(&v, y0, y1, ownership, segment).unwrap());
        }
        let script = r#"const fs=require('node:fs'),R=require(process.argv[1]);
const input=JSON.parse(fs.readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(input.map(f=>{const m=R.meshSegment(Uint8Array.from(f.vol),f.dims,f.y0,f.y1,f.owners===null?null:new Map(f.owners),f.segment);return {verts:Array.from(m.verts),idx:Array.from(m.idx),quads:m.quads};})));"#;
        let path =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../building-lab/renderer.js");
        let mut child = Command::new("node")
            .arg("-e")
            .arg(script)
            .arg(path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .expect("Node is required for JS parity");
        child
            .stdin
            .take()
            .unwrap()
            .write_all(&serde_json::to_vec(&fixtures).unwrap())
            .unwrap();
        let output = child.wait_with_output().unwrap();
        assert!(output.status.success());
        let reference: Vec<serde_json::Value> = serde_json::from_slice(&output.stdout).unwrap();
        for (case, (mesh, js)) in meshes.iter().zip(reference).enumerate() {
            assert_eq!(
                json!(mesh.verts),
                js["verts"],
                "vertex bytes, fixture {case}"
            );
            assert_eq!(json!(mesh.idx), js["idx"], "index bytes, fixture {case}");
            assert_eq!(json!(mesh.meta.quads), js["quads"]);
        }
    }
}
