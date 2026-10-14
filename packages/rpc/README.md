# @heb-stack/rpc

The capnweb API at `/rpc`. `PrimesApi` is the contract the Worker serves and the browser calls: `check` and `next` invoke `primes.check` and `primes.next` on the `rpc` session and answer their `Result`, and `capabilities` lists what the target serves. `@heb-stack/rpc/server` refuses other origins, other media types, oversized batches and text that is not UTF-8 before capnweb reads them. In the catalog, this API is the binding `hs:capnweb` of the `rpc` target.
