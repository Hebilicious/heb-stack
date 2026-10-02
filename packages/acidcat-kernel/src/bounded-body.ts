/**
 * A request body's bytes, or `undefined` as soon as more than `maximum` arrive.
 *
 * The bound counts the bytes that actually arrive, because a declared
 * `Content-Length` may be absent or understated. Leaving the read early cancels
 * the stream instead of buffering a body the caller will refuse, and a stream
 * that fails to cancel does not turn that refusal into a failure.
 */
export async function readAtMost(
  stream: ReadableStream<Uint8Array>,
  maximum: number
): Promise<Uint8Array | undefined> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  let exceeded = false;
  try {
    for await (const chunk of stream) {
      length += chunk.byteLength;
      if (length > maximum) {
        exceeded = true;
        break;
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (!exceeded) {
      throw error;
    }
  }
  if (exceeded) {
    return undefined;
  }
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}
