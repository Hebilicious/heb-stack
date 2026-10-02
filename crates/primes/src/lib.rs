//! One pure function, exported to WebAssembly as a plain `wasm32-unknown-unknown` symbol.
//!
//! A `u64` crosses the module boundary as a JavaScript `bigint`, so the TypeScript port passes and receives
//! `bigint` and never loses precision.

/// The smallest factor of `n` greater than one, found by trial division. A prime is its own smallest factor.
///
/// `n` below 2 has no such factor; the answer is `n` itself, and callers reject that range before asking.
#[unsafe(no_mangle)]
pub extern "C" fn smallest_factor(n: u64) -> u64 {
    if n < 4 {
        return n;
    }
    if n.is_multiple_of(2) {
        return 2;
    }
    let mut divisor = 3;
    while divisor <= n / divisor {
        if n.is_multiple_of(divisor) {
            return divisor;
        }
        divisor += 2;
    }
    n
}
