//! City Lab CPU core, not a renderer or a Building Lab room-planner port.
pub mod abi;
pub mod city;
pub mod geometry;
pub mod mesh;
pub mod sparse;
pub mod stream;
pub mod types;

use serde_json::json;
use types::{EngineError, EngineResult, Reply, Request};

pub const ABI_VERSION: u32 = 1;
pub const GEOMETRY_BUDGET_BYTES: usize = 128 * 1024 * 1024;
pub const PORT_OPERATIONS: &[&str] = &[
    "city.generate",
    "city.validate",
    "stream.targets",
    "stream.prefetch",
    "geometry.facade",
    "geometry.coarse",
    "geometry.prepare",
    "geometry.doors",
    "mesh.segment",
    "sparse.pack",
];

/// Shared by native tests/benchmarks and the WASM packet ABI. No JS callbacks.
pub fn dispatch(request: &Request) -> EngineResult<Reply> {
    let op = request.op.as_str();
    match op {
        "core.info" => {
            let implemented: Vec<_> = [
                city::implemented_operations(),
                stream::implemented_operations(),
                geometry::implemented_operations(),
                mesh::implemented_operations(),
                sparse::implemented_operations(),
            ]
            .into_iter()
            .flatten()
            .copied()
            .collect();
            Ok(Reply::new(
                json!({"abi": ABI_VERSION, "engine": "rust", "implemented": implemented,
                "operations": PORT_OPERATIONS, "geometryBudgetBytes": GEOMETRY_BUDGET_BYTES}),
            ))
        }
        // An ABI diagnostic, deliberately not a geometry implementation or fallback.
        "core.echo" => Ok(Reply {
            meta: request.meta.clone(),
            buffers: request.buffers.clone(),
        }),
        "city.generate" | "city.validate" => city::handle(op, request),
        "stream.targets" | "stream.prefetch" => stream::handle(op, request),
        "geometry.facade" | "geometry.coarse" | "geometry.prepare" | "geometry.doors" => {
            geometry::handle(op, request)
        }
        "mesh.segment" => mesh::handle(op, request),
        "sparse.pack" => sparse::handle(op, request),
        _ => Err(EngineError::new(
            "UNKNOWN_OPERATION",
            format!("Unknown operation: {op}"),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pending_operations_are_dispatched_but_not_misrepresented_as_ready() {
        let info = dispatch(&Request::new("core.info", json!({}))).unwrap();
        let implemented = info.meta["implemented"].as_array().unwrap();
        assert!(
            implemented
                .iter()
                .all(|v| PORT_OPERATIONS.contains(&v.as_str().unwrap()))
        );
        for op in PORT_OPERATIONS {
            if !implemented.iter().any(|v| v == op) {
                let result = dispatch(&Request::new(op, json!({})));
                assert_eq!(result.unwrap_err().code, "NOT_IMPLEMENTED", "{op}");
            }
        }
        assert_eq!(info.meta["geometryBudgetBytes"], 134_217_728);
    }
}
