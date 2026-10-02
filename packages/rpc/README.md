# @heb-stack/rpc

The capnweb API at `/rpc`. `PrimesApi` is the contract the Worker serves and the browser calls: `check` and `next` invoke `primes.check` and `primes.next` on the `rpc` session and answer their `Result`, and `capabilities` lists what the target serves. `@heb-stack/rpc/server` refuses other origins, other media types and oversized batches before capnweb reads them.
