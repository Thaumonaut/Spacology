//! Lossless CitySparse port: R16UI coarse cells, collision-checked 4³ bricks,
//! 1024-wide R8UI atlas. Dense, coarse and atlas indexing are deliberately different.
use crate::types::{
    BufferKind, EngineError, EngineResult, Model, Reply, Request, Sparse, SparseFrame, SparseInput,
    SparseMeta, SparseOptions, Volume,
};
use std::collections::HashMap;

const SUB: usize = 4;
const ATLAS_WIDTH: usize = 1024;
const BRICKS_PER_ROW: usize = 64;
const MAX_BRICKS: usize = 65280;

pub fn implemented_operations() -> &'static [&'static str] {
    &["sparse.pack"]
}

pub fn handle(op: &str, request: &Request) -> EngineResult<Reply> {
    if op != "sparse.pack" {
        return Err(EngineError::pending(op));
    }
    let input: SparseInput = request.meta_as()?;
    // This explicit dense-volume copy remains part of ABI executeMs. The typed
    // from_volume path borrows the volume; neither path hides module/load costs.
    let volume = request.volume(&input.volume)?;
    let palette = request.buffer("palette", BufferKind::U8)?;
    from_volume(&volume, &palette.bytes, input.model, &input.options)?.into_reply()
}

pub fn from_volume(
    volume: &Volume,
    palette: &[u8],
    model: Model,
    options: &SparseOptions,
) -> EngineResult<Sparse> {
    volume.validate()?;
    if palette.len() != 1024 {
        return Err(EngineError::invalid(
            "Palette must contain exactly 1024 bytes",
        ));
    }
    if model.iter().any(|v| !v.is_finite()) {
        return Err(EngineError::invalid("Sparse model must be finite"));
    }
    let dims = volume.spec.dims;
    let n = dims.map(|v| v.div_ceil(SUB));
    let mut coarse = zeroed(n.iter().product())?;
    let mut mixed: Vec<[u8; 64]> = Vec::new();
    let mut lookup: HashMap<u32, Vec<usize>> = HashMap::new();
    let mut lo = dims;
    let mut hi = [0; 3];
    let mut mixed_cells = 0;
    for z in 0..n[2] {
        for y in 0..n[1] {
            for x in 0..n[0] {
                let mut brick = [0u8; 64];
                let mut same = true;
                for fz in 0..SUB {
                    for fy in 0..SUB {
                        for fx in 0..SUB {
                            let c = [x * SUB + fx, y * SUB + fy, z * SUB + fz];
                            let i = fx + SUB * (fy + SUB * fz);
                            let value = if (0..3).all(|a| c[a] < dims[a]) {
                                volume.vol[c[0] + dims[0] * (c[2] + dims[2] * c[1])]
                            } else {
                                0
                            };
                            brick[i] = value;
                            if value != brick[0] {
                                same = false;
                            }
                            if value != 0 {
                                for a in 0..3 {
                                    lo[a] = lo[a].min(c[a]);
                                    hi[a] = hi[a].max(c[a] + 1);
                                }
                            }
                        }
                    }
                }
                let i = x + n[0] * (y + n[1] * z);
                if same {
                    coarse[i] = brick[0] as u16;
                    continue;
                }
                mixed_cells += 1;
                let hash = if options.deduplicate {
                    hash_brick(&brick)
                } else {
                    0
                };
                let candidate = if options.deduplicate {
                    lookup
                        .get(&hash)
                        .and_then(|bucket| bucket.iter().copied().find(|&k| mixed[k] == brick))
                } else {
                    None
                };
                let index = if let Some(k) = candidate {
                    k
                } else {
                    if mixed.len() >= MAX_BRICKS {
                        return Err(EngineError::new(
                            "SPARSE_BRICK_BUDGET_EXCEEDED",
                            "Sparse brick budget exceeded (maximum 65280 unique bricks)",
                        ));
                    }
                    let k = mixed.len();
                    mixed.push(brick);
                    if options.deduplicate {
                        lookup.entry(hash).or_default().push(k);
                    }
                    k
                };
                coarse[i] = (256 + index) as u16;
            }
        }
    }
    let brick_rows = mixed.len().div_ceil(BRICKS_PER_ROW).max(1) * SUB;
    let mut bricks = zeroed(ATLAS_WIDTH * brick_rows)?;
    for (k, brick) in mixed.iter().enumerate() {
        for z in 0..SUB {
            for y in 0..SUB {
                for x in 0..SUB {
                    bricks[atlas_index(k, x, y, z)] = brick[x + SUB * (y + SUB * z)];
                }
            }
        }
    }
    let mut pal = vec![0; 1024];
    for i in 1..256 {
        pal[(i - 1) * 4..(i - 1) * 4 + 3].copy_from_slice(&palette[i * 4..i * 4 + 3]);
        pal[(i - 1) * 4 + 3] = if volume.spec.materials.get("lantern_glow") == Some(&(i as u8)) {
            128
        } else if volume.spec.materials.get("shoji") == Some(&(i as u8)) {
            64
        } else {
            0
        };
    }
    let nonempty = hi.iter().any(|&v| v != 0);
    let offset = if options.crop && nonempty {
        lo.map(|v| v / SUB)
    } else {
        [0; 3]
    };
    let size = if options.crop {
        if nonempty {
            std::array::from_fn(|a| hi[a].div_ceil(SUB) - offset[a])
        } else {
            [1; 3]
        }
    } else {
        n
    };
    // No additional dense-volume copy. With crop disabled the original coarse
    // storage is moved directly into the result rather than copied for transport.
    let trimmed = if options.crop {
        let mut trimmed = zeroed(size.iter().product())?;
        for z in 0..size[2] {
            for y in 0..size[1] {
                let start = offset[0] + n[0] * (y + offset[1] + n[1] * (z + offset[2]));
                let dest = size[0] * (y + size[1] * z);
                trimmed[dest..dest + size[0]].copy_from_slice(&coarse[start..start + size[0]]);
            }
        }
        trimmed
    } else {
        coarse
    };
    let cvs = volume.spec.cell * SUB as f64;
    let o = [
        offset[0] as f64 * volume.spec.cell * SUB as f64,
        model[13] + offset[1] as f64 * volume.spec.cell * SUB as f64,
        offset[2] as f64 * volume.spec.cell * SUB as f64,
    ];
    if !cvs.is_finite() || o.iter().any(|v| !v.is_finite()) {
        return Err(EngineError::invalid("Sparse world coordinates overflow"));
    }
    let bytes = trimmed.len() * 2 + bricks.len() + pal.len();
    if bytes > crate::GEOMETRY_BUDGET_BYTES {
        return Err(EngineError::new(
            "GEOMETRY_BUDGET_EXCEEDED",
            "Sparse result exceeds 128 MiB geometry cap",
        ));
    }
    Ok(Sparse {
        meta: SparseMeta {
            n: size,
            offset: offset.map(|v| v * SUB),
            o,
            cvs,
            sub: SUB,
            brick_rows,
            nb: mixed.len(),
            mixed_cells,
            // Same rigid yaw/translation extraction as CitySparse. In particular,
            // o.x/z are LOCAL crop origins, not model.x/z or VolumeSpec.origin.
            frame: SparseFrame {
                x: model[12],
                z: model[14],
                rot: model[2].atan2(model[0]),
            },
            lo,
            hi,
            bytes,
        },
        coarse: trimmed,
        bricks,
        pal,
    })
}

fn zeroed<T: Default + Clone>(len: usize) -> EngineResult<Vec<T>> {
    let mut result = Vec::new();
    result
        .try_reserve_exact(len)
        .map_err(|_| EngineError::new("ALLOCATION_FAILED", "Could not allocate sparse storage"))?;
    result.resize(len, T::default());
    Ok(result)
}

fn hash_brick(brick: &[u8; 64]) -> u32 {
    // JS hashes its 16 Uint32 words, not individual bytes. The ABI and WASM
    // contract are explicitly little endian; equality always checks all 64 bytes.
    brick.chunks_exact(4).fold(2166136261u32, |hash, word| {
        (hash ^ u32::from_le_bytes(word.try_into().unwrap())).wrapping_mul(16777619)
    })
}

fn atlas_index(brick: usize, x: usize, y: usize, z: usize) -> usize {
    (brick / BRICKS_PER_ROW * SUB + y) * ATLAS_WIDTH + (brick % BRICKS_PER_ROW) * 16 + z * SUB + x
}

/// Integer fine-voxel sampling in the ORIGINAL volume's coordinates. Negative,
/// cropped-away and padded-air positions return zero, exactly like CitySparse.sample.
/// No model/world transformation is applied to a fine-voxel sampling coordinate.
pub fn sample(sparse: &Sparse, x: i64, y: i64, z: i64) -> u8 {
    let mut c = [0usize; 3];
    for (a, value) in [x, y, z].into_iter().enumerate() {
        let Some(local) = value.checked_sub(sparse.meta.offset[a] as i64) else {
            return 0;
        };
        if local < 0 || local as u64 >= (sparse.meta.n[a] * SUB) as u64 {
            return 0;
        }
        c[a] = local as usize;
    }
    let n = sparse.meta.n;
    let index = c[0] / SUB + n[0] * (c[1] / SUB + n[1] * (c[2] / SUB));
    let Some(&cell) = sparse.coarse.get(index) else {
        return 0;
    };
    if cell < 256 {
        cell as u8
    } else {
        sparse
            .bricks
            .get(atlas_index(
                cell as usize - 256,
                c[0] % SUB,
                c[1] % SUB,
                c[2] % SUB,
            ))
            .copied()
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Buffer, IDENTITY, VolumeSpec};
    use serde_json::json;

    fn volume(dims: [usize; 3], fill: u8) -> Volume {
        Volume {
            spec: serde_json::from_value::<VolumeSpec>(json!({
                "dims":dims,"cell":0.0625,"origin":[-123,9,-77],
                "M":{"lantern_glow":2,"shoji":3}
            }))
            .unwrap(),
            vol: vec![fill; dims.iter().product()],
        }
    }
    fn palette() -> Vec<u8> {
        (0..1024).map(|i| ((i * 31 + 17) % 256) as u8).collect()
    }
    fn assert_samples(v: &Volume, s: &Sparse) {
        let [xmax, ymax, zmax] = v.spec.dims;
        for y in -1..ymax as i64 + 5 {
            for z in -1..zmax as i64 + 5 {
                for x in -1..xmax as i64 + 5 {
                    let expected = if x >= 0
                        && y >= 0
                        && z >= 0
                        && x < xmax as i64
                        && y < ymax as i64
                        && z < zmax as i64
                    {
                        v.vol[x as usize + xmax * (z as usize + zmax * y as usize)]
                    } else {
                        0
                    };
                    assert_eq!(sample(s, x, y, z), expected, "voxel ({x},{y},{z})");
                }
            }
        }
        assert_eq!(sample(s, i64::MIN, 0, 0), 0);
        assert_eq!(sample(s, 0, i64::MAX, 0), 0);
    }

    #[test]
    fn empty_solid_odd_dimensions_and_every_material_id_round_trip() {
        for (dims, fill) in [
            ([1, 1, 1], 0),
            ([8, 12, 4], 0),
            ([8, 12, 4], 255),
            ([11, 9, 13], 7),
        ] {
            let v = volume(dims, fill);
            for crop in [false, true] {
                for deduplicate in [false, true] {
                    let s = from_volume(
                        &v,
                        &palette(),
                        IDENTITY,
                        &SparseOptions { crop, deduplicate },
                    )
                    .unwrap();
                    assert_samples(&v, &s);
                    assert_eq!(
                        s.meta.bytes,
                        s.coarse.len() * 2 + s.bricks.len() + s.pal.len()
                    );
                    assert!(s.meta.brick_rows >= 4);
                    if fill == 0 {
                        assert_eq!(s.meta.lo, dims);
                        assert_eq!(s.meta.hi, [0; 3]);
                        assert_eq!(s.meta.nb, 0);
                        assert_eq!(s.meta.mixed_cells, 0);
                        if crop {
                            assert_eq!(s.meta.n, [1; 3]);
                        }
                    } else if dims.iter().all(|d| d % 4 == 0) {
                        assert_eq!(s.meta.nb, 0);
                        assert!(s.coarse.iter().all(|&c| c == 255));
                    }
                }
            }
        }
        let mut v = volume([256, 1, 1], 0);
        for (i, m) in v.vol.iter_mut().enumerate() {
            *m = i as u8;
        }
        assert_samples(
            &v,
            &from_volume(&v, &palette(), IDENTITY, &SparseOptions::default()).unwrap(),
        );
    }

    #[test]
    fn random_multimaterial_all_option_combinations_are_lossless() {
        let mut seed = 0xa31792cdu32;
        for case in 0..16 {
            let mut v = volume([5 + case % 8, 7 + case % 4, 9 + case % 6], 0);
            for byte in &mut v.vol {
                seed ^= seed << 13;
                seed ^= seed >> 17;
                seed ^= seed << 5;
                *byte = if seed.is_multiple_of(3) {
                    0
                } else {
                    (seed >> 24) as u8
                };
            }
            for crop in [false, true] {
                for deduplicate in [false, true] {
                    let s = from_volume(
                        &v,
                        &palette(),
                        IDENTITY,
                        &SparseOptions { crop, deduplicate },
                    )
                    .unwrap();
                    assert_samples(&v, &s);
                }
            }
        }
    }

    #[test]
    fn cropped_origin_negative_rigid_frame_dedup_and_palette_flags() {
        let mut v = volume([24, 24, 24], 0);
        for y in 8..16 {
            for z in 8..16 {
                for x in 8..16 {
                    v.vol[x + 24 * (z + 24 * y)] = ((x + y + z) % 2 + 1) as u8;
                }
            }
        }
        let mut model = IDENTITY;
        let angle = -0.7f64;
        model[0] = angle.cos();
        model[2] = angle.sin();
        model[8] = -angle.sin();
        model[10] = angle.cos();
        model[12] = -123.5;
        model[13] = -7.;
        model[14] = -99.25;
        let pal = palette();
        let s = from_volume(&v, &pal, model, &SparseOptions::default()).unwrap();
        let plain = from_volume(
            &v,
            &pal,
            model,
            &SparseOptions {
                crop: false,
                deduplicate: false,
            },
        )
        .unwrap();
        assert_eq!(s.meta.nb, 1);
        assert_eq!(s.meta.mixed_cells, 8);
        assert_eq!(plain.meta.nb, 8);
        assert_eq!(s.meta.offset, [8, 8, 8]);
        assert_eq!(s.meta.n, [2, 2, 2]);
        assert_eq!(s.meta.o, [0.5, -6.5, 0.5]);
        assert_eq!(s.meta.lo, [8, 8, 8]);
        assert_eq!(s.meta.hi, [16, 16, 16]);
        assert_eq!(s.meta.frame.x, -123.5);
        assert_eq!(s.meta.frame.z, -99.25);
        assert!((s.meta.frame.rot - angle).abs() < 1e-15);
        assert_eq!(s.meta.frame.rot, plain.meta.frame.rot);
        assert!(s.meta.bytes < plain.meta.bytes);
        for i in 1..256 {
            assert_eq!(&s.pal[(i - 1) * 4..(i - 1) * 4 + 3], &pal[i * 4..i * 4 + 3]);
            assert_eq!(
                s.pal[(i - 1) * 4 + 3],
                if i == 2 {
                    128
                } else if i == 3 {
                    64
                } else {
                    0
                }
            );
        }
        assert_eq!(&s.pal[1020..], &[0, 0, 0, 0]);
        assert_samples(&v, &s);
        v.spec.materials.insert("shoji".into(), 2);
        assert_eq!(
            from_volume(&v, &pal, model, &SparseOptions::default())
                .unwrap()
                .pal[7],
            128,
            "glow takes priority when material aliases match"
        );
    }

    fn write_brick(v: &mut Volume, cell: [usize; 3], brick: &[u8; 64]) {
        let [xmax, _, zmax] = v.spec.dims;
        for z in 0..4 {
            for y in 0..4 {
                for x in 0..4 {
                    let [xx, yy, zz] = [cell[0] * 4 + x, cell[1] * 4 + y, cell[2] * 4 + z];
                    v.vol[xx + xmax * (zz + zmax * yy)] = brick[x + 4 * (y + 4 * z)];
                }
            }
        }
    }

    #[test]
    fn exact_dedup_survives_a_constructed_fnv_collision() {
        let mut a = [0u8; 64];
        let mut b = [0u8; 64];
        a[0] = 1;
        b[0] = 2;
        let prefix = |brick: &[u8; 64]| {
            brick[..60].chunks_exact(4).fold(2166136261u32, |h, w| {
                (h ^ u32::from_le_bytes(w.try_into().unwrap())).wrapping_mul(16777619)
            })
        };
        let correction = prefix(&a) ^ prefix(&b);
        b[60..64].copy_from_slice(&correction.to_le_bytes());
        assert_ne!(a, b);
        assert_eq!(hash_brick(&a), hash_brick(&b));
        let mut v = volume([16, 4, 4], 0);
        write_brick(&mut v, [0, 0, 0], &a);
        write_brick(&mut v, [1, 0, 0], &b);
        write_brick(&mut v, [2, 0, 0], &a);
        write_brick(&mut v, [3, 0, 0], &b);
        let s = from_volume(&v, &palette(), IDENTITY, &SparseOptions::default()).unwrap();
        assert_eq!(s.meta.nb, 2);
        assert_eq!(s.meta.mixed_cells, 4);
        assert_eq!(s.coarse, vec![256, 257, 256, 257]);
        assert_samples(&v, &s);
    }

    #[test]
    fn atlas_row_boundaries_and_last_representable_brick_are_preserved() {
        // 64*16*64 coarse cells; exactly 65280 mixed cells fit uint16 256..65535.
        let mut v = volume([256, 64, 256], 0);
        for k in 0..MAX_BRICKS {
            let [x, y, z] = [k % 64, (k / 64) % 16, k / (64 * 16)];
            v.vol[x * 4 + 256 * (z * 4 + 256 * y * 4)] = 1;
        }
        let options = SparseOptions {
            crop: false,
            deduplicate: false,
        };
        let s = from_volume(&v, &palette(), IDENTITY, &options).unwrap();
        assert_eq!(s.meta.nb, MAX_BRICKS);
        assert_eq!(s.coarse[MAX_BRICKS - 1], 65535);
        assert_eq!(s.meta.brick_rows, 4080);
        for k in [0, 63, 64, 65, MAX_BRICKS - 1] {
            let [x, y, z] = [k % 64, (k / 64) % 16, k / (64 * 16)];
            assert_eq!(
                sample(&s, (x * 4) as i64, (y * 4) as i64, (z * 4) as i64),
                1
            );
            assert_eq!(
                sample(&s, (x * 4 + 1) as i64, (y * 4) as i64, (z * 4) as i64),
                0
            );
        }
        let k = MAX_BRICKS;
        let [x, y, z] = [k % 64, (k / 64) % 16, k / (64 * 16)];
        v.vol[x * 4 + 256 * (z * 4 + 256 * y * 4)] = 1;
        assert_eq!(
            from_volume(&v, &palette(), IDENTITY, &options)
                .unwrap_err()
                .code,
            "SPARSE_BRICK_BUDGET_EXCEEDED"
        );
        let dedup = from_volume(&v, &palette(), IDENTITY, &SparseOptions::default()).unwrap();
        assert_eq!(dedup.meta.nb, 1);
        assert_eq!(dedup.meta.mixed_cells, MAX_BRICKS + 1);
    }

    #[test]
    fn malformed_inputs_fail_and_repeated_packets_own_all_buffers() {
        let v = volume([5, 7, 9], 255);
        assert!(from_volume(&v, &palette()[..1023], IDENTITY, &SparseOptions::default()).is_err());
        let mut bad_model = IDENTITY;
        bad_model[12] = f64::NAN;
        assert!(from_volume(&v, &palette(), bad_model, &SparseOptions::default()).is_err());
        let mut invalid = v.clone();
        invalid.vol.pop();
        assert!(from_volume(&invalid, &palette(), IDENTITY, &SparseOptions::default()).is_err());
        let mut overflow = v.clone();
        overflow.spec.cell = f64::MAX;
        assert!(from_volume(&overflow, &palette(), IDENTITY, &SparseOptions::default()).is_err());
        let mut request = Request::new("sparse.pack", json!({"volume":v.spec,"model":IDENTITY}));
        request.buffers = vec![Buffer::u8("vol", v.vol), Buffer::u8("palette", palette())];
        let packet = crate::abi::encode_request(&request).unwrap();
        let mut first = crate::abi::decode_reply(&crate::abi::execute_packet(&packet)).unwrap();
        let expected = first.buffers.clone();
        first.buffers.iter_mut().for_each(|b| b.bytes.fill(0));
        for _ in 0..100 {
            let reply = crate::abi::decode_reply(&crate::abi::execute_packet(&packet)).unwrap();
            assert_eq!(reply.buffers, expected);
            assert_eq!(reply.buffers.len(), 3);
            assert_eq!(
                reply.meta["bytes"].as_u64().unwrap() as usize,
                reply.buffers.iter().map(|b| b.bytes.len()).sum::<usize>()
            );
        }
        request.buffers.pop();
        assert_eq!(
            handle("sparse.pack", &request).unwrap_err().code,
            "INVALID_REQUEST"
        );
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn all_buffers_and_metadata_match_current_javascript_packer() {
        use std::io::Write;
        use std::process::{Command, Stdio};
        let mut seed = 0x1786fa34u32;
        let mut fixtures = vec![];
        let mut packed = vec![];
        for case in 0..24 {
            let mut v = volume([5 + case % 9, 7 + case % 5, 9 + case % 7], 0);
            for byte in &mut v.vol {
                seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                *byte = if case == 0 {
                    0
                } else if case == 1 {
                    255
                } else {
                    [0, 0, 1, 2, 3, 128, 255][(seed >> 16) as usize % 7]
                };
            }
            if case > 0 && case % 5 == 0 {
                // Interior crop and repeated bricks, not just full-volume bounds.
                v = volume([16, 16, 16], 0);
                let mut brick = [0; 64];
                for (i, b) in brick.iter_mut().enumerate() {
                    *b = (i % 3) as u8;
                }
                write_brick(&mut v, [1, 1, 1], &brick);
                write_brick(&mut v, [2, 1, 1], &brick);
            }
            let mut model = IDENTITY;
            let angle = -(case as f64) * 0.13;
            model[0] = angle.cos();
            model[2] = angle.sin();
            model[8] = -angle.sin();
            model[10] = angle.cos();
            model[12] = -52.5;
            model[13] = -3.25;
            model[14] = -21.5;
            let options = SparseOptions {
                crop: case % 2 == 0,
                deduplicate: case % 4 < 2,
            };
            fixtures.push(
                json!({"b":{"dims":v.spec.dims,"vol":v.vol,"cell":v.spec.cell,
                "origin":v.spec.origin,"palette":palette(),"M":v.spec.materials},
                "model":model,"options":options}),
            );
            packed.push(from_volume(&v, &palette(), model, &options).unwrap());
        }
        let script = r#"const fs=require('node:fs'),S=require(process.argv[1]);
const input=JSON.parse(fs.readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(input.map(f=>{f.b.vol=Uint8Array.from(f.b.vol);f.b.palette=Uint8Array.from(f.b.palette);const v=S.fromVolume(f.b,f.model,f.options),{coarse,bricks,pal,...meta}=v;return {meta,coarse:Array.from(coarse),bricks:Array.from(bricks),pal:Array.from(pal)};})));"#;
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../city-sparse.js");
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
        for (case, (s, js)) in packed.iter().zip(reference).enumerate() {
            assert_eq!(json!(s.coarse), js["coarse"], "coarse fixture {case}");
            assert_eq!(json!(s.bricks), js["bricks"], "atlas fixture {case}");
            assert_eq!(json!(s.pal), js["pal"], "palette fixture {case}");
            let mut meta = serde_json::to_value(&s.meta).unwrap();
            // JS JSON spells integral f64 values as integers (-3 instead of -3.0).
            // Deserialize the same schema before comparing, without changing values.
            let js_meta: SparseMeta = serde_json::from_value(js["meta"].clone()).unwrap();
            let expected = serde_json::to_value(js_meta).unwrap();
            let rust_rot = meta["frame"]["rot"].as_f64().unwrap();
            let js_rot = expected["frame"]["rot"].as_f64().unwrap();
            assert!((rust_rot - js_rot).abs() < 1e-14, "rotation fixture {case}");
            meta["frame"]["rot"] = expected["frame"]["rot"].clone();
            assert_eq!(meta, expected, "metadata fixture {case}");
        }
    }
}
