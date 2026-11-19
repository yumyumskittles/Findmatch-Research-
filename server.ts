import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const VISION_MODEL = 'gemini-4-hydrogen';
const EMBEDDING_MODEL = 'gemini-embedding-2';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: number }).status)
          : 0;
      const isRetryable = status === 429 || status >= 500 || status === 0;
      if (!isRetryable || attempt === maxAttempts) {
        throw err;
      }
      const delayMs = 400 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function getErrorPayload(err: unknown): { status: number; message: string } {
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: number }).status) || 500
      : 500;
  let message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Gemini API request failed.';

  // Unwrap nested JSON error string returned by @google/genai when applicable
  if (message.startsWith('{')) {
    try {
      const parsed = JSON.parse(message) as {
        error?: { message?: string; status?: string };
        message?: string;
      };
      if (parsed.error?.message) {
        message = parsed.error.message;
      } else if (parsed.message) {
        message = parsed.message;
      }
    } catch {
      // keep original message
    }
  }

  return { status: status >= 400 && status < 600 ? status : 500, message };
}

function stripDataUrlPrefix(base64OrDataUrl: string): string {
  const commaIdx = base64OrDataUrl.indexOf(',');
  return commaIdx >= 0 ? base64OrDataUrl.slice(commaIdx + 1) : base64OrDataUrl;
}

interface ExtractProfileBody {
  imageBase64?: string;
  mimeType?: string;
  description?: string;
}

interface CompareCandidateInput {
  item_id: string;
  imageBase64: string;
  mimeType?: string;
  description?: string;
  profile?: {
    category?: string;
    main_colors?: string[];
    brand_or_logo?: string | null;
    shape_material?: string;
    distinctive_marks?: Array<{
      type: string;
      description: string;
      location_on_item: string;
    }>;
    caption?: string;
  };
}

interface CompareBody {
  queryImageBase64?: string;
  queryMimeType?: string;
  queryDescription?: string;
  queryProfile?: CompareCandidateInput['profile'];
  candidates?: CompareCandidateInput[];
}

interface EmbedBody {
  text?: string;
}

interface MatchMarksBody {
  queryDescription?: string;
  queryMarks?: Array<{
    type: string;
    description: string;
    location_on_item: string;
  }>;
  candidates?: Array<{
    item_id: string;
    description?: string;
    marks?: Array<{
      type: string;
      description: string;
      location_on_item: string;
    }>;
  }>;
}

async function createServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/gemini/extract-profile', async (req: Request, res: Response) => {
    try {
      const body = req.body as ExtractProfileBody;
      if (!body.imageBase64) {
        res.status(400).json({ error: 'imageBase64 is required.' });
        return;
      }

      const ai = getAiClient();
      const cleanBase64 = stripDataUrlPrefix(body.imageBase64);
      const mimeType = body.mimeType || 'image/jpeg';
      const userHint = body.description?.trim()
        ? `User note (optional context, verify visually): "${body.description.trim()}".`
        : 'No user description provided.';

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: VISION_MODEL,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: `Analyze ONLY the physical lost-and-found object in this photograph. Completely ignore the background surface, table, lighting, shadows, and any hands.
Identify the object's category (prefer one of: bottle, umbrella, bag, charger, ID holder, other), main colors, brand or logo (or null if none visible), shape and material, and every small distinctive mark (stickers, scratches, dents, logos, labels, patterns, handwriting, wear spots) with its exact location on the item. Write one detailed, objective caption sentence describing the object and its marks. ${userHint}`,
              },
            ],
          },
          config: {
            systemInstruction:
              'You are a meticulous lost-and-found forensic visual cataloger. Focus strictly on the object itself and its physical identifying marks.',
            seed: 42,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                category: {
                  type: Type.STRING,
                  description:
                    'Category of item: bottle, umbrella, bag, charger, ID holder, or other.',
                },
                main_colors: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Primary colors of the object.',
                },
                brand_or_logo: {
                  type: Type.STRING,
                  nullable: true,
                  description: 'Visible brand name or logo text, or null if absent.',
                },
                shape_material: {
                  type: Type.STRING,
                  description: 'Concise description of shape, build, and material.',
                },
                distinctive_marks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: {
                        type: Type.STRING,
                        description:
                          'One of: sticker, scratch, dent, logo, label, pattern, writing, wear, other',
                      },
                      description: {
                        type: Type.STRING,
                        description: 'Specific visual description of the mark.',
                      },
                      location_on_item: {
                        type: Type.STRING,
                        description: 'Where on the object this mark appears.',
                      },
                    },
                    required: ['type', 'description', 'location_on_item'],
                  },
                },
                caption: {
                  type: Type.STRING,
                  description: 'One detailed sentence describing the item and its marks.',
                },
              },
              required: [
                'category',
                'main_colors',
                'brand_or_logo',
                'shape_material',
                'distinctive_marks',
                'caption',
              ],
            },
          },
        }),
      );

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      res.json({ profile: parsed });
    } catch (err: unknown) {
      const { status, message } = getErrorPayload(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/gemini/embed', async (req: Request, res: Response) => {
    try {
      const body = req.body as EmbedBody;
      const text = body.text?.trim();
      if (!text) {
        res.status(400).json({ error: 'text is required for embedding.' });
        return;
      }

      const ai = getAiClient();
      const result = await withRetry(() =>
        ai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: text,
        }),
      );

      const values = result.embeddings?.[0]?.values;
      if (!values || !Array.isArray(values)) {
        throw new Error('Embedding model returned an empty vector.');
      }

      res.json({ embedding: values });
    } catch (err: unknown) {
      const { status, message } = getErrorPayload(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/gemini/compare', async (req: Request, res: Response) => {
    try {
      const body = req.body as CompareBody;
      if (!body.queryImageBase64 || !body.candidates || body.candidates.length === 0) {
        res.status(400).json({ error: 'queryImageBase64 and non-empty candidates are required.' });
        return;
      }
      if (body.candidates.length > 5) {
        res.status(400).json({ error: 'At most 5 candidates may be compared per batch.' });
        return;
      }

      const ai = getAiClient();
      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      const queryDesc = body.queryDescription?.trim()
        ? `User query description: "${body.queryDescription.trim()}".`
        : 'User query description: (none provided).';
      const queryProfileSummary = body.queryProfile
        ? `Query extracted profile: ${JSON.stringify(body.queryProfile)}`
        : '';

      parts.push({
        text: `Compare the QUERY ITEM below against each CANDIDATE ITEM (up to 5 candidates).
Focus ONLY on the objects themselves; ignore backgrounds, tables, lighting, and hands.

CRITICAL RULES:
1. Two items of the same model and color are NOT the same physical item unless their distinctive marks (stickers, scratches, dents, logos, labels, writing, wear) match.
2. A distinctive mark present on one item but clearly absent on a visible matching area of the other item is a CONFLICT.
3. Score every candidate strictly using this rubric:
   - 0.90–1.00: Same physical item: same model AND at least one distinctive mark (sticker, scratch, logo, label, writing) clearly matches, no conflicts.
   - 0.70–0.89: Same model and color, marks partly visible or consistent, no conflicts.
   - 0.40–0.69: Same category and similar look, but no distinctive mark can be confirmed, OR a minor conflict.
   - 0.15–0.39: Same category but a clear conflict (a different sticker, a scratch in a different spot, a different logo, a different color shade).
   - 0.00–0.14: Different category or clearly a different object.

QUERY ITEM:
${queryDesc}
${queryProfileSummary}`,
      });

      parts.push({
        inlineData: {
          mimeType: body.queryMimeType || 'image/jpeg',
          data: stripDataUrlPrefix(body.queryImageBase64),
        },
      });

      for (const candidate of body.candidates) {
        parts.push({
          text: `\nCANDIDATE ITEM ${candidate.item_id}:
Staff description: "${candidate.description || ''}"
Pre-indexed profile: ${JSON.stringify(candidate.profile || {})}`,
        });
        parts.push({
          inlineData: {
            mimeType: candidate.mimeType || 'image/jpeg',
            data: stripDataUrlPrefix(candidate.imageBase64),
          },
        });
      }

      parts.push({
        text: `\nReturn a JSON object with a "comparisons" array containing exactly one entry for each candidate item_id: ${body.candidates
          .map((c) => c.item_id)
          .join(', ')}. Never use the words "confirmed", "match found", or "this is your item" in any text field.`,
      });

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: VISION_MODEL,
          contents: { parts },
          config: {
            systemInstruction:
              'You are a strict lost-and-found visual verification analyst. Judge physical identity solely on visual evidence and distinctive marks using the exact rubric provided. Never claim certainty or ownership.',
            seed: 42,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                comparisons: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      item_id: { type: Type.STRING },
                      visual_score: {
                        type: Type.NUMBER,
                        description: 'Normalized similarity score from 0.0 to 1.0.',
                      },
                      matching_features: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      conflicting_features: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      reason: {
                        type: Type.STRING,
                        description: 'Short objective explanation of the score.',
                      },
                    },
                    required: [
                      'item_id',
                      'visual_score',
                      'matching_features',
                      'conflicting_features',
                      'reason',
                    ],
                  },
                },
              },
              required: ['comparisons'],
            },
          },
        }),
      );

      const rawText = (response.text ?? '{"comparisons":[]}').trim();
      const parsed = JSON.parse(rawText) as {
        comparisons?: Array<{
          item_id: string;
          visual_score: number;
          matching_features: string[];
          conflicting_features: string[];
          reason: string;
        }>;
      };

      res.json({ results: parsed.comparisons ?? [] });
    } catch (err: unknown) {
      const { status, message } = getErrorPayload(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/gemini/match-marks', async (req: Request, res: Response) => {
    try {
      const body = req.body as MatchMarksBody;
      const queryDesc = body.queryDescription?.trim() || '';
      const candidates = body.candidates || [];

      if (!queryDesc || candidates.length === 0) {
        res.json({ matches: [] });
        return;
      }

      const ai = getAiClient();
      const prompt = `Given a lost-item query description and its detected marks, count how many DISTINCTIVE marks mentioned in the query description match a distinctive mark in each candidate's profile (including exact keyword matches and clear synonyms like "star sticker" <-> "star-shaped decal" or "scuff on handle" <-> "diagonal scratch on rubber handle"). Do NOT count generic item category/color words like "black bottle" or "gray umbrella" as distinctive mark matches; only count specific marks such as stickers, scratches, dents, logos, labels, pins, writing, or patterns.

Query description: "${queryDesc}"
Query visual marks: ${JSON.stringify(body.queryMarks || [])}

Candidates:
${candidates
  .map(
    (c) =>
      `- ${c.item_id}: description="${c.description || ''}", marks=${JSON.stringify(c.marks || [])}`,
  )
  .join('\n')}`;

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: VISION_MODEL,
          contents: prompt,
          config: {
            systemInstruction:
              'You match distinctive identifying marks between a lost-item description and found-item profiles accurately and conservatively.',
            seed: 42,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                matches: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      item_id: { type: Type.STRING },
                      matched_count: {
                        type: Type.INTEGER,
                        description: 'Number of distinct query marks matched on this item.',
                      },
                      matched_terms: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                    required: ['item_id', 'matched_count', 'matched_terms'],
                  },
                },
              },
              required: ['matches'],
            },
          },
        }),
      );

      const rawText = (response.text ?? '{"matches":[]}').trim();
      const parsed = JSON.parse(rawText) as {
        matches?: Array<{
          item_id: string;
          matched_count: number;
          matched_terms: string[];
        }>;
      };

      res.json({ matches: parsed.matches ?? [] });
    } catch (err: unknown) {
      const { status, message } = getErrorPayload(err);
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('/{*splat}', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FindMatch server listening on http://localhost:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start FindMatch server:', err);
  process.exit(1);
});
