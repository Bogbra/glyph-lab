function writeUint16LE(target: number[], value: number) {
  target.push(value & 0xff, (value >> 8) & 0xff);
}

function writeAscii(target: number[], value: string) {
  for (let i = 0; i < value.length; i++) target.push(value.charCodeAt(i) & 0xff);
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

function writeSubBlocks(target: number[], data: Uint8Array) {
  for (let offset = 0; offset < data.length; offset += 255) {
    const size = Math.min(255, data.length - offset);
    target.push(size);
    for (let i = 0; i < size; i++) target.push(data[offset + i]);
  }
  target.push(0);
}

export type GifFrame = {
  image: ImageData;
  delayMs: number;
};

export function encodeGif(frames: GifFrame[], loop = true) {
  if (!frames.length) throw new Error("GIF export requires at least one frame.");
  const width = frames[0].image.width;
  const height = frames[0].image.height;
  if (width <= 0 || height <= 0) throw new Error("Invalid GIF dimensions.");
  if (frames.some((frame) => frame.image.width !== width || frame.image.height !== height)) {
    throw new Error("All GIF frames must have identical dimensions.");
  }

  const out: number[] = [];
  writeAscii(out, "GIF89a");
  writeUint16LE(out, width);
  writeUint16LE(out, height);
  out.push(0xf7, 0, 0); // global table, 8-bit color resolution, 256 entries
  const palette = buildPalette332();
  for (const byte of palette) out.push(byte);

  if (loop) {
    out.push(0x21, 0xff, 0x0b);
    writeAscii(out, "NETSCAPE2.0");
    out.push(0x03, 0x01, 0x00, 0x00, 0x00); // loop forever
  }

  for (const frame of frames) {
    const delayCs = Math.max(1, Math.round(frame.delayMs / 10));
    out.push(0x21, 0xf9, 0x04, 0x00);
    writeUint16LE(out, delayCs);
    out.push(0x00, 0x00);

    out.push(0x2c);
    writeUint16LE(out, 0);
    writeUint16LE(out, 0);
    writeUint16LE(out, width);
    writeUint16LE(out, height);
    out.push(0x00);

    const indexed = rgbaTo332(frame.image);
    out.push(0x08);
    writeSubBlocks(out, lzwEncode(indexed, 8));
  }

  out.push(0x3b);
  return new Blob([new Uint8Array(out)], { type: "image/gif" });
}
