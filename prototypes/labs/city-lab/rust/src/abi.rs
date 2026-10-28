//! Versioned packet ABI with owned allocation handles, not caller-supplied Rust pointers.
//! Packet = LE u32 JSON length + UTF-8 JSON + padding to 8 bytes + typed LE payload.
use crate::{ABI_VERSION, dispatch, types::*};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::Mutex,
};

pub const MAX_PACKET_BYTES: usize = 256 * 1024 * 1024;
pub const MAX_JSON_BYTES: usize = 16 * 1024 * 1024;
const MAX_LIVE_BYTES: usize = 512 * 1024 * 1024;
const MAX_BUFFERS: usize = 128;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BufferDescriptor {
    pub name: String,
    pub kind: BufferKind,
    pub offset: usize,
    pub length: usize,
}
#[derive(Debug, Serialize, Deserialize)]
struct Header {
    abi: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    op: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    ok: Option<bool>,
    #[serde(default)]
    meta: Value,
    #[serde(default)]
    buffers: Vec<BufferDescriptor>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    error: Option<EngineError>,
}
fn invalid(message: impl Into<String>) -> EngineError {
    EngineError::new("INVALID_PACKET", message)
}
fn align8(value: usize) -> usize {
    (value + 7) & !7
}

fn unpack(packet: &[u8]) -> EngineResult<(Header, Vec<Buffer>)> {
    if packet.len() < 4 || packet.len() > MAX_PACKET_BYTES {
        return Err(invalid("Invalid packet size"));
    }
    let json_len = u32::from_le_bytes(packet[..4].try_into().unwrap()) as usize;
    if json_len > MAX_JSON_BYTES || 4 + json_len > packet.len() {
        return Err(invalid("Invalid JSON length"));
    }
    let payload_start = align8(4 + json_len);
    if payload_start > packet.len() {
        return Err(invalid("Missing alignment padding"));
    }
    let header: Header =
        serde_json::from_slice(&packet[4..4 + json_len]).map_err(|e| invalid(e.to_string()))?;
    if header.abi != ABI_VERSION {
        return Err(EngineError::new(
            "ABI_MISMATCH",
            "City Rust ABI version must be 1",
        ));
    }
    if header.buffers.len() > MAX_BUFFERS {
        return Err(invalid("Too many buffers"));
    }
    let payload = &packet[payload_start..];
    let mut names = BTreeSet::new();
    let mut ranges = Vec::new();
    for desc in &header.buffers {
        if desc.name.is_empty() || !names.insert(desc.name.as_str()) {
            return Err(invalid("Empty or duplicate buffer name"));
        }
        let width = desc.kind.width();
        let bytes = desc
            .length
            .checked_mul(width)
            .ok_or_else(|| invalid("Buffer size overflow"))?;
        let end = desc
            .offset
            .checked_add(bytes)
            .ok_or_else(|| invalid("Buffer offset overflow"))?;
        if !desc.offset.is_multiple_of(width) || end > payload.len() {
            return Err(invalid("Unaligned or out-of-range buffer"));
        }
        if bytes > 0 {
            ranges.push((desc.offset, end));
        }
    }
    ranges.sort_unstable();
    if ranges.windows(2).any(|r| r[0].1 > r[1].0) {
        return Err(invalid("Overlapping buffers"));
    }
    // Reject overlapping hostile ranges before allocating any buffer copies.
    let buffers = header
        .buffers
        .iter()
        .map(|desc| {
            let end = desc.offset + desc.length * desc.kind.width();
            Buffer {
                name: desc.name.clone(),
                kind: desc.kind,
                bytes: payload[desc.offset..end].to_vec(),
            }
        })
        .collect();
    Ok((header, buffers))
}
fn pack(mut header: Header, buffers: &[Buffer]) -> EngineResult<Vec<u8>> {
    if buffers.len() > MAX_BUFFERS {
        return Err(invalid("Too many buffers"));
    }
    let mut payload = Vec::new();
    let mut names = BTreeSet::new();
    for buffer in buffers {
        if buffer.name.is_empty() || !names.insert(buffer.name.as_str()) {
            return Err(invalid("Empty or duplicate buffer name"));
        }
        buffer.check(buffer.kind)?;
        let start = align8(payload.len());
        let end = start
            .checked_add(buffer.bytes.len())
            .ok_or_else(|| invalid("Payload size overflow"))?;
        if end > MAX_PACKET_BYTES {
            return Err(invalid("Payload exceeds ABI cap"));
        }
        payload.resize(start, 0);
        header.buffers.push(BufferDescriptor {
            name: buffer.name.clone(),
            kind: buffer.kind,
            offset: start,
            length: buffer.bytes.len() / buffer.kind.width(),
        });
        payload.extend_from_slice(&buffer.bytes);
    }
    let json = serde_json::to_vec(&header).map_err(|e| invalid(e.to_string()))?;
    if json.len() > MAX_JSON_BYTES {
        return Err(invalid("JSON exceeds ABI cap"));
    }
    let start = align8(4 + json.len());
    if start + payload.len() > MAX_PACKET_BYTES {
        return Err(invalid("Packet exceeds ABI cap"));
    }
    let mut packet = Vec::with_capacity(start + payload.len());
    packet.extend_from_slice(&(json.len() as u32).to_le_bytes());
    packet.extend_from_slice(&json);
    packet.resize(start, 0);
    packet.extend_from_slice(&payload);
    Ok(packet)
}

/// Native operation-test path: construct Request + buffers, encode, execute, decode_reply.
pub fn encode_request(request: &Request) -> EngineResult<Vec<u8>> {
    pack(
        Header {
            abi: ABI_VERSION,
            op: Some(request.op.clone()),
            ok: None,
            meta: request.meta.clone(),
            buffers: vec![],
            error: None,
        },
        &request.buffers,
    )
}
pub fn decode_request(packet: &[u8]) -> EngineResult<Request> {
    let (header, buffers) = unpack(packet)?;
    if header.ok.is_some() || header.error.is_some() {
        return Err(invalid("Response is not a request"));
    }
    Ok(Request {
        op: header
            .op
            .filter(|s| !s.is_empty())
            .ok_or_else(|| invalid("Missing operation"))?,
        meta: header.meta,
        buffers,
    })
}
pub fn decode_reply(packet: &[u8]) -> EngineResult<Reply> {
    let (header, buffers) = unpack(packet)?;
    match (header.ok, header.error) {
        (Some(true), None) => Ok(Reply {
            meta: header.meta,
            buffers,
        }),
        (Some(false), Some(error)) => Err(error),
        _ => Err(invalid("Malformed response")),
    }
}
pub fn execute_packet(packet: &[u8]) -> Vec<u8> {
    let result = decode_request(packet)
        .and_then(|request| dispatch(&request))
        .and_then(|reply| {
            pack(
                Header {
                    abi: ABI_VERSION,
                    op: None,
                    ok: Some(true),
                    meta: reply.meta,
                    buffers: vec![],
                    error: None,
                },
                &reply.buffers,
            )
        });
    result.unwrap_or_else(|error| {
        // Error metadata must itself fit even if it quotes a huge invalid input.
        let error = EngineError {
            code: error.code.chars().take(128).collect(),
            message: error.message.chars().take(4096).collect(),
        };
        pack(
            Header {
                abi: ABI_VERSION,
                op: None,
                ok: Some(false),
                meta: Value::Null,
                buffers: vec![],
                error: Some(error),
            },
            &[],
        )
        .expect("small ABI error packet")
    })
}

struct Registry {
    next: u32,
    bytes: usize,
    blocks: BTreeMap<u32, Vec<u8>>,
}
impl Registry {
    const fn new() -> Self {
        Self {
            next: 0,
            bytes: 0,
            blocks: BTreeMap::new(),
        }
    }
    fn insert(&mut self, bytes: Vec<u8>) -> u32 {
        if bytes.is_empty()
            || bytes.len() > MAX_PACKET_BYTES
            || self.bytes + bytes.len() > MAX_LIVE_BYTES
        {
            return 0;
        }
        let Some(id) = self.next.checked_add(1) else {
            return 0;
        };
        self.next = id;
        self.bytes += bytes.len();
        self.blocks.insert(id, bytes);
        id
    }
    fn free(&mut self, id: u32) -> bool {
        if let Some(block) = self.blocks.remove(&id) {
            self.bytes -= block.len();
            true
        } else {
            false
        }
    }
}
static REGISTRY: Mutex<Registry> = Mutex::new(Registry::new());

#[unsafe(no_mangle)]
pub extern "C" fn city_abi_version() -> u32 {
    ABI_VERSION
}
#[unsafe(no_mangle)]
pub extern "C" fn city_alloc(length: u32) -> u32 {
    let len = length as usize;
    let mut registry = REGISTRY.lock().unwrap();
    if len == 0 || len > MAX_PACKET_BYTES || registry.bytes + len > MAX_LIVE_BYTES {
        return 0;
    }
    let mut block = Vec::new();
    if block.try_reserve_exact(len).is_err() {
        return 0;
    }
    block.resize(len, 0);
    registry.insert(block)
}
/// Pointer is valid until city_free(handle); refresh JS memory.buffer after every WASM call.
#[unsafe(no_mangle)]
pub extern "C" fn city_buffer_ptr(handle: u32) -> *mut u8 {
    REGISTRY
        .lock()
        .unwrap()
        .blocks
        .get_mut(&handle)
        .map_or(std::ptr::null_mut(), |b| b.as_mut_ptr())
}
#[unsafe(no_mangle)]
pub extern "C" fn city_buffer_len(handle: u32) -> u32 {
    REGISTRY
        .lock()
        .unwrap()
        .blocks
        .get(&handle)
        .map_or(0, |b| b.len() as u32)
}
/// Does not consume input. Returns a distinct owned output handle, or 0 on invalid handle/OOM.
#[unsafe(no_mangle)]
pub extern "C" fn city_run(handle: u32) -> u32 {
    let mut registry = REGISTRY.lock().unwrap();
    let Some(input) = registry.blocks.get(&handle) else {
        return 0;
    };
    let output = execute_packet(input);
    registry.insert(output)
}
#[unsafe(no_mangle)]
pub extern "C" fn city_free(handle: u32) -> u32 {
    u32::from(REGISTRY.lock().unwrap().free(handle))
}
#[unsafe(no_mangle)]
pub extern "C" fn city_live_bytes() -> u32 {
    REGISTRY.lock().unwrap().bytes as u32
}
#[unsafe(no_mangle)]
pub extern "C" fn city_live_allocations() -> u32 {
    REGISTRY.lock().unwrap().blocks.len() as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn typed_buffers_round_trip_without_material_or_float_loss() {
        let mut request = Request::new(
            "core.echo",
            json!({"seed": 4294967295u32, "model": IDENTITY}),
        );
        request.buffers = vec![
            Buffer::u8("vol", vec![0, 7, 255]),
            Buffer::u16("verts", &[0, 65535]),
            Buffer::u32("idx", &[0, u32::MAX]),
            Buffer::i32("ownerSegments", &[-1, 8]),
            Buffer::f32("normals", &[0.25, -1.]),
        ];
        let packet = encode_request(&request).unwrap();
        let decoded = decode_reply(&execute_packet(&packet)).unwrap();
        assert_eq!(decoded.meta, request.meta);
        assert_eq!(decoded.buffers, request.buffers);
    }
    #[test]
    fn malformed_packets_and_unknown_operations_return_errors() {
        for packet in [&[][..], &[0, 0, 0, 0][..], &[255, 255, 255, 255][..]] {
            assert_eq!(
                decode_reply(&execute_packet(packet)).unwrap_err().code,
                "INVALID_PACKET"
            );
        }
        let packet = encode_request(&Request::new("not.an.operation", json!({}))).unwrap();
        assert_eq!(
            decode_reply(&execute_packet(&packet)).unwrap_err().code,
            "UNKNOWN_OPERATION"
        );
        let packet = encode_request(&Request::new(&"x".repeat(8192), json!({}))).unwrap();
        let error = decode_reply(&execute_packet(&packet)).unwrap_err();
        assert_eq!(error.code, "UNKNOWN_OPERATION");
        assert!(error.message.len() <= 4096);
    }
    #[test]
    fn invalid_descriptors_and_versions_are_rejected() {
        let packet = |header: Value, data: &[u8]| {
            let bytes = serde_json::to_vec(&header).unwrap();
            let mut result = (bytes.len() as u32).to_le_bytes().to_vec();
            result.extend(bytes);
            result.resize(align8(result.len()), 0);
            result.extend(data);
            result
        };
        for descriptor in [
            json!({"name":"a","kind":"u32","offset":1,"length":1}),
            json!({"name":"a","kind":"u32","offset":0,"length":100}),
        ] {
            let p = packet(
                json!({"abi":1,"op":"core.echo","buffers":[descriptor]}),
                &[0; 8],
            );
            assert_eq!(
                decode_reply(&execute_packet(&p)).unwrap_err().code,
                "INVALID_PACKET"
            );
        }
        let p = packet(json!({"abi":2,"op":"core.echo"}), &[]);
        assert_eq!(
            decode_reply(&execute_packet(&p)).unwrap_err().code,
            "ABI_MISMATCH"
        );
        let descriptor = json!({"name":"a","kind":"u8","offset":0,"length":2});
        let p = packet(
            json!({"abi":1,"op":"core.echo","buffers":[descriptor.clone(),descriptor]}),
            &[0; 8],
        );
        assert_eq!(
            decode_reply(&execute_packet(&p)).unwrap_err().code,
            "INVALID_PACKET"
        );
        let p = packet(
            json!({"abi":1,"op":"core.echo","buffers":[
                {"name":"a","kind":"u8","offset":0,"length":4},
                {"name":"b","kind":"u8","offset":2,"length":4}
            ]}),
            &[0; 8],
        );
        assert_eq!(
            decode_reply(&execute_packet(&p)).unwrap_err().code,
            "INVALID_PACKET"
        );
    }
    #[test]
    fn allocation_handles_are_not_reused_and_double_free_is_safe() {
        assert_eq!(city_alloc(0), 0);
        assert_eq!(city_alloc((MAX_PACKET_BYTES + 1) as u32), 0);
        let handle = city_alloc(16);
        assert_ne!(handle, 0);
        assert_eq!(city_buffer_len(handle), 16);
        assert!(!city_buffer_ptr(handle).is_null());
        // Zero-filled input yields a structured malformed-packet result, not an unsafe read.
        let output = city_run(handle);
        assert_ne!(output, 0);
        assert_ne!(output, handle);
        assert_eq!(city_free(output), 1);
        assert_eq!(city_free(handle), 1);
        assert_eq!(city_free(handle), 0);
        assert_eq!(city_run(handle), 0);
        assert!(city_buffer_ptr(handle).is_null());
        let next = city_alloc(8);
        assert!(next > output);
        city_free(next);
        assert_eq!(city_live_allocations(), 0);
        assert_eq!(city_live_bytes(), 0);
    }
    #[test]
    fn volume_length_and_layout_contract_are_checked() {
        let spec: VolumeSpec =
            serde_json::from_value(json!({"dims":[2,3,4],"cell":0.0625,"origin":[0,0,0]})).unwrap();
        assert!(
            Volume {
                spec: spec.clone(),
                vol: vec![0; 24]
            }
            .validate()
            .is_ok()
        );
        assert!(
            Volume {
                spec,
                vol: vec![0; 23]
            }
            .validate()
            .is_err()
        );
    }
}
