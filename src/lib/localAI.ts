import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
  pipeline,
} from '@huggingface/transformers';

// Everything here runs inside the browser. The models are downloaded once
// from the Hugging Face hub and then cached by the browser.
env.allowLocalModels = false;

const CLIP_MODEL = 'Xenova/clip-vit-base-patch32';
const TEXT_MODEL = 'Xenova/all-MiniLM-L6-v2';

/* eslint-disable @typescript-eslint/no-explicit-any */
let clipVisionPromise: Promise<{ processor: any; model: any }> | null = null;
let clipTextPromise: Promise<{ tokenizer: any; model: any }> | null = null;
let sentencePromise: Promise<any> | null = null;

function getClipVision() {
  if (!clipVisionPromise) {
    clipVisionPromise = (async () => {
      const processor = await AutoProcessor.from_pretrained(CLIP_MODEL);
      const model = await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL);
      return { processor, model };
    })();
  }
  return clipVisionPromise;
}

function getClipText() {
  if (!clipTextPromise) {
    clipTextPromise = (async () => {
      const tokenizer = await AutoTokenizer.from_pretrained(CLIP_MODEL);
      const model = await CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL);
      return { tokenizer, model };
    })();
  }
  return clipTextPromise;
}

function getSentenceModel() {
  if (!sentencePromise) {
    sentencePromise = pipeline('feature-extraction', TEXT_MODEL);
  }
  return sentencePromise;
}

function normalize(values: ArrayLike<number>): number[] {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i] * values[i];
  const norm = Math.sqrt(sum) || 1;
  const out = new Array<number>(values.length);
  for (let i = 0; i < values.length; i++) out[i] = values[i] / norm;
  return out;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

function quickHash(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${str.length}-${(h >>> 0).toString(16)}`;
}

// ---------------------------------------------------------------------------
// Image embeddings. We embed the whole photo plus a 2x2 grid of tiles, so a
// small sticker or scratch in one corner still changes the comparison.
// ---------------------------------------------------------------------------
export interface ImageEmbeddings {
  full: number[];
  tiles: number[][];
}

const imageCache = new Map<string, ImageEmbeddings>();

async function embedRawImage(raw: any): Promise<number[]> {
  const { processor, model } = await getClipVision();
  const inputs = await processor(raw);
  const { image_embeds } = await model(inputs);
  return normalize(image_embeds.data as Float32Array);
}

function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the image.'));
    img.src = dataUrl;
  });
}

export async function embedImage(dataUrl: string): Promise<ImageEmbeddings> {
  const key = quickHash(dataUrl);
  const cached = imageCache.get(key);
  if (cached) return cached;

  const img = await loadHtmlImage(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const full = await embedRawImage(await RawImage.fromURL(dataUrl));

  const tiles: number[][] = [];
  const tw = Math.floor(w / 2);
  const th = Math.floor(h / 2);
  for (const [tx, ty] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.drawImage(img, tx * tw, ty * th, tw, th, 0, 0, tw, th);
    tiles.push(await embedRawImage(await RawImage.fromURL(canvas.toDataURL('image/jpeg', 0.9))));
  }

  const result = { full, tiles };
  imageCache.set(key, result);
  return result;
}

/** Raw visual similarity between two photos, -1..1 (higher = more alike). */
export function imageSimilarity(a: ImageEmbeddings, b: ImageEmbeddings): number {
  const fullSim = dot(a.full, b.full);
  const n = Math.min(a.tiles.length, b.tiles.length);
  if (n === 0) return fullSim;
  let tileSum = 0;
  for (let i = 0; i < n; i++) tileSum += dot(a.tiles[i], b.tiles[i]);
  return 0.5 * fullSim + 0.5 * (tileSum / n);
}

// ---------------------------------------------------------------------------
// Text embeddings (sentence similarity for descriptions)
// ---------------------------------------------------------------------------
export async function embedSentence(text: string): Promise<number[]> {
  const extractor = await getSentenceModel();
  const out = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data as Float32Array);
}

// ---------------------------------------------------------------------------
// Category guess from the photo (zero-shot CLIP)
// ---------------------------------------------------------------------------
const CATEGORY_PROMPTS: Array<[string, string]> = [
  ['bottle', 'a photo of a water bottle'],
  ['umbrella', 'a photo of an umbrella'],
  ['bag', 'a photo of a backpack or bag'],
  ['charger', 'a photo of a phone charger or cable'],
  ['ID holder', 'a photo of an ID card holder or lanyard'],
  ['other', 'a photo of a personal belonging'],
];

let categoryTextEmbeds: number[][] | null = null;

export async function classifyCategory(image: ImageEmbeddings): Promise<string> {
  if (!categoryTextEmbeds) {
    const { tokenizer, model } = await getClipText();
    const tokens = tokenizer(
      CATEGORY_PROMPTS.map((p) => p[1]),
      { padding: true, truncation: true },
    );
    const { text_embeds } = await model(tokens);
    const dim = text_embeds.dims[1] as number;
    const data = text_embeds.data as Float32Array;
    categoryTextEmbeds = CATEGORY_PROMPTS.map((_, i) =>
      normalize(Array.from(data.slice(i * dim, (i + 1) * dim))),
    );
  }
  let best = 0;
  let bestScore = -Infinity;
  categoryTextEmbeds.forEach((emb, i) => {
    const s = dot(image.full, emb);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return CATEGORY_PROMPTS[best][0];
}

// ---------------------------------------------------------------------------
// Dominant color names (simple, runs on a canvas)
// ---------------------------------------------------------------------------
function colorName(r: number, g: number, b: number): string {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let hue = 0;
  if (d !== 0) {
    if (max === rn) hue = ((gn - bn) / d) % 6;
    else if (max === gn) hue = (bn - rn) / d + 2;
    else hue = (rn - gn) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  if (v < 0.2) return 'black';
  if (s < 0.14) {
    if (v > 0.85) return 'white';
    if (v > 0.55) return 'silver';
    return v < 0.38 ? 'charcoal' : 'gray';
  }
  if (hue < 15 || hue >= 345) return 'red';
  if (hue < 40) return v < 0.55 ? 'brown' : 'orange';
  if (hue < 70) return 'yellow';
  if (hue < 165) return 'green';
  if (hue < 195) return 'teal';
  if (hue < 255) return v < 0.45 ? 'navy' : 'blue';
  if (hue < 290) return 'purple';
  return 'pink';
}

export async function dominantColors(dataUrl: string, maxColors = 2): Promise<string[]> {
  const img = await loadHtmlImage(dataUrl);
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, size, size);
  const lo = Math.floor(size * 0.2);
  const hi = Math.floor(size * 0.8);
  const counts = new Map<string, number>();
  let total = 0;
  const data = ctx.getImageData(lo, lo, hi - lo, hi - lo).data;
  for (let i = 0; i < data.length; i += 4) {
    const name = colorName(data[i], data[i + 1], data[i + 2]);
    counts.set(name, (counts.get(name) || 0) + 1);
    total++;
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, c]) => c / total > 0.12)
    .slice(0, maxColors)
    .map(([n]) => n);
}
