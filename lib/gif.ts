function u16le(value: number) {
  return [value & 0xff, (value >> 8) & 0xff];
}

function ascii(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 0xff;
  return bytes;
}

function buildPalette332() {
  const palette = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const r = (i >> 5) & 0x07;
    const g = (i >> 2) & 0x07;
    const b = i & 0x03;
    palette[i * 3] = Math.round((r / 7) * 255);
    palette[i * 3 + 1] = Math.round((g / 7) * 255);
    palette[i * 3 + 2] = Math.round((b / 3) * 255);
  }
  return palette;
}

function rgbaTo332(image: ImageData) {
  const indexed = new Uint8Array(image.width * image.height);
  const source = image.data;
  for (let i = 0, p = 0; i < source.length; i += 4, p++) {
    const alpha = source[i + 3] / 255;
    const r = Math.round(source[i] * alpha + 255 * (1 - alpha));
    const g = Math.round(source[i + 1] * alpha + 255 * (1 - alpha));
    const b = Math.round(source[i + 2] * alpha + 255 * (1 - alpha));
    indexed[p] = (r & 0xe0) | ((g & 0xe0) >> 3) | (b >> 6);
  }
  return indexed;
}

function lzwEncode(indices: Uint8Array, minCodeSize = 8) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let nextCode = endCode + 1;
  let codeSize = minCodeSize + 1;
  const dictionary = new Map<number, number>();
  const bytes: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;

  const emit = (code: number) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      bytes.push(bitBuffer & 0xff);
      bitBuffer >>>= 8;
      bitCount -= 8;
    }
  };

  const resetDictionary = () => {
    dictionary.clear();
    nextCode = endCode + 1;
    codeSize = minCodeSize + 1;
  };

  emit(clearCode);
  if (indices.length === 0) {
    emit(endCode);
  } else {
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const suffix = indices[i];
      const key = (prefix << 8) | suffix;
      const found = dictionary.get(key);
      if (found !== undefined) {
        prefix = found;
        continue;
      }

      emit(prefix);

      if (nextCode < 4096) {
        dictionary.set(key, nextCode++);
        // GIF decoders add the newly learned dictionary entry one emitted code
        // later than the encoder. Grow the code width only after the next code
        // has crossed the current width boundary. Using === here produces a
        // truncated/corrupt stream on larger frames (often only the first rows
        // decode correctly).
        if (nextCode > 1 << codeSize && codeSize < 12) codeSize++;
      } else {
        emit(clearCode);
        resetDictionary();
      }
      prefix = suffix;
    }
    emit(prefix);
    emit(endCode);
  }

  if (bitCount > 0) bytes.push(bitBuffer & 0xff);
  return new Uint8Array(bytes);
}

function subBlocks(data: Uint8Array) {
  const out: number[] = [];
  for (let offset = 0; offset < data.length; offset += 255) {
    const size = Math.min(255, data.length - offset);
    out.push(size);
    for (let i = 0; i < size; i++) out.push(data[offset + i]);
  }
  out.push(0);
  return Uint8Array.from(out);
}

/**
 * Streaming GIF encoder: each frame is turned into its own Uint8Array chunk
 * and handed to the caller (or buffered internally) as it is produced, so a
 * long export never needs to hold every ImageData / encoded frame in memory
 * at once — the caller can discard a frame's ImageData right after addFrame.
 */
export class GifEncoder {
  private readonly width: number;
  private readonly height: number;
  private readonly parts: Uint8Array[] = [];
  private cumulativeMs = 0;
  private cumulativeCs = 0;
  private frameCount = 0;
  private finished = false;

  constructor(width: number, height: number, loop = true) {
    if (width <= 0 || height <= 0) throw new Error("Invalid GIF dimensions.");
    this.width = width;
    this.height = height;

    const header: number[] = [];
    header.push(...u16le(width));
    header.push(...u16le(height));
    header.push(0xf7, 0, 0); // global table, 8-bit color resolution, 256 entries
    this.parts.push(ascii("GIF89a"));
    this.parts.push(Uint8Array.from(header));
    this.parts.push(buildPalette332());

    if (loop) {
      const netscape: number[] = [0x21, 0xff, 0x0b];
      this.parts.push(Uint8Array.from(netscape));
      this.parts.push(ascii("NETSCAPE2.0"));
      this.parts.push(Uint8Array.from([0x03, 0x01, 0x00, 0x00, 0x00])); // loop forever
    }
  }

  addFrame(image: ImageData, delayMs: number) {
    if (this.finished) throw new Error("Cannot add frames after finish().");
    if (image.width !== this.width || image.height !== this.height) {
      throw new Error("All GIF frames must have identical dimensions.");
    }

    // Round the running total instead of each frame's delay independently, so
    // per-frame 1/10s truncation error doesn't compound into a GIF that runs
    // measurably longer or shorter than the requested duration.
    this.cumulativeMs += delayMs;
    const nextCumulativeCs = Math.round(this.cumulativeMs / 10);
    const delayCs = Math.max(1, nextCumulativeCs - this.cumulativeCs);
    this.cumulativeCs = nextCumulativeCs;

    const descriptor: number[] = [0x21, 0xf9, 0x04, 0x00, ...u16le(delayCs), 0x00, 0x00, 0x2c];
    descriptor.push(...u16le(0), ...u16le(0), ...u16le(this.width), ...u16le(this.height), 0x00);
    this.parts.push(Uint8Array.from(descriptor));

    const indexed = rgbaTo332(image);
    this.parts.push(Uint8Array.from([0x08]));
    this.parts.push(subBlocks(lzwEncode(indexed, 8)));
    this.frameCount++;
  }

  finish(): Blob {
    if (this.finished) throw new Error("finish() already called.");
    if (this.frameCount === 0) throw new Error("GIF export requires at least one frame.");
    this.finished = true;
    this.parts.push(Uint8Array.from([0x3b]));
    // TS's DOM lib parameterizes Uint8Array<ArrayBufferLike> here while
    // BlobPart expects the ArrayBuffer-backed form; every chunk above is a
    // plain Uint8Array, which Blob has always accepted at runtime.
    return new Blob(this.parts as BlobPart[], { type: "image/gif" });
  }
}
