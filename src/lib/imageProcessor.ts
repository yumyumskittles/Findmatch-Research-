import type { BaselineFeatures } from '../types';

export const INVALID_IMAGE_ERROR = 'Please upload a valid image (JPG/PNG)';

export class ImageValidationError extends Error {
  constructor(message = INVALID_IMAGE_ERROR) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

export interface ProcessedImageResult {
  imageDataUrl: string;
  imageHash: string;
  width: number;
  height: number;
  baselineFeatures: BaselineFeatures;
}

function hasValidExtension(filename: string): boolean {
  const lower = filename.toLowerCase().trim();
  return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png');
}

function hasValidMimeType(mimeType: string): boolean {
  const lower = mimeType.toLowerCase().trim();
  return (
    lower === 'image/jpeg' ||
    lower === 'image/jpg' ||
    lower === 'image/pjpeg' ||
    lower === 'image/png' ||
    lower === 'image/x-png'
  );
}

function hasValidDeclaredType(file: File): boolean {
  const hasMime = Boolean(file.type && file.type.trim().length > 0);
  const hasExt = file.name.includes('.');

  if (hasMime && !hasValidMimeType(file.type)) return false;
  if (hasExt && !hasValidExtension(file.name)) return false;
  if (!hasMime && !hasExt) return false;

  return true;
}

function hasValidMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;

  // JPEG starts with FF D8 FF
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

  // PNG starts with 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  return isJpeg || isPng;
}

async function decodeImageBitmap(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(blob);
  }
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return [h, s, v];
}

export function computeBaselineFeaturesFromCanvasSource(
  source: CanvasImageSource,
): BaselineFeatures {
  // 1. HSV color histogram (8 x 4 x 4 = 128 bins) at 64x64
  const histSize = 64;
  const histCanvas = document.createElement('canvas');
  histCanvas.width = histSize;
  histCanvas.height = histSize;
  const histCtx = histCanvas.getContext('2d');
  if (!histCtx) {
    throw new Error('Could not acquire 2D canvas context.');
  }
  histCtx.drawImage(source, 0, 0, histSize, histSize);
  const histData = histCtx.getImageData(0, 0, histSize, histSize).data;

  const bins = new Array<number>(8 * 4 * 4).fill(0);
  const totalPixels = histSize * histSize;

  for (let i = 0; i < histData.length; i += 4) {
    const [h, s, v] = rgbToHsv(histData[i], histData[i + 1], histData[i + 2]);
    const hBin = Math.min(7, Math.floor((h / 360) * 8));
    const sBin = Math.min(3, Math.floor(s * 4));
    const vBin = Math.min(3, Math.floor(v * 4));
    const idx = hBin * 16 + sBin * 4 + vBin;
    bins[idx] += 1;
  }

  const hsvHistogram = bins.map((count) => count / totalPixels);

  // 2. 64-bit dHash on 9x8 grayscale grid
  const dCanvas = document.createElement('canvas');
  dCanvas.width = 9;
  dCanvas.height = 8;
  const dCtx = dCanvas.getContext('2d');
  if (!dCtx) {
    throw new Error('Could not acquire 2D canvas context.');
  }
  dCtx.drawImage(source, 0, 0, 9, 8);
  const dData = dCtx.getImageData(0, 0, 9, 8).data;

  const gray = new Float32Array(9 * 8);
  for (let i = 0; i < 9 * 8; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * dData[idx] + 0.587 * dData[idx + 1] + 0.114 * dData[idx + 2];
  }

  let hex = '';
  let nibble = 0;
  let bitCount = 0;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = gray[y * 9 + x];
      const right = gray[y * 9 + x + 1];
      const bit = left > right ? 1 : 0;
      nibble = (nibble << 1) | bit;
      bitCount++;
      if (bitCount === 4) {
        hex += nibble.toString(16);
        nibble = 0;
        bitCount = 0;
      }
    }
  }

  return {
    hsvHistogram,
    dHashHex: hex,
  };
}

export async function validateAndPreprocessImage(
  file: File,
): Promise<ProcessedImageResult> {
  if (!file || file.size === 0) {
    throw new ImageValidationError(INVALID_IMAGE_ERROR);
  }

  if (!hasValidDeclaredType(file)) {
    throw new ImageValidationError(INVALID_IMAGE_ERROR);
  }

  let headerBytes: Uint8Array;
  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    headerBytes = new Uint8Array(buffer);
  } catch {
    throw new ImageValidationError(INVALID_IMAGE_ERROR);
  }

  if (!hasValidMagicBytes(headerBytes)) {
    throw new ImageValidationError(INVALID_IMAGE_ERROR);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeImageBitmap(file);
  } catch {
    throw new ImageValidationError(INVALID_IMAGE_ERROR);
  }

  try {
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    if (srcW <= 0 || srcH <= 0) {
      throw new ImageValidationError(INVALID_IMAGE_ERROR);
    }

    const longestSide = Math.max(srcW, srcH);
    const scale = longestSide > 1024 ? 1024 / longestSide : 1;
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new ImageValidationError(INVALID_IMAGE_ERROR);
    }

    // Fill white background in case PNG has alpha transparency before JPEG re-encode
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const jpegBytes = dataUrlToUint8Array(imageDataUrl);
    const imageHash = await computeSha256Hex(jpegBytes);
    const baselineFeatures = computeBaselineFeaturesFromCanvasSource(canvas);

    return {
      imageDataUrl,
      imageHash,
      width: targetW,
      height: targetH,
      baselineFeatures,
    };
  } finally {
    bitmap.close();
  }
}

export async function recomputeBaselineFromDataUrl(
  imageDataUrl: string,
): Promise<BaselineFeatures> {
  const res = await fetch(imageDataUrl);
  const blob = await res.blob();
  const bitmap = await decodeImageBitmap(blob);
  try {
    return computeBaselineFeaturesFromCanvasSource(bitmap);
  } finally {
    bitmap.close();
  }
}
