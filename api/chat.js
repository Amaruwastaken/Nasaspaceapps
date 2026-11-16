import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const knowledgePath = path.join(__dirname, '..', 'Backend', 'nasa-knowledge.json');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.5-flash-lite';

function readJson(pathname) {
  return readFile(pathname, 'utf8').then((data) => JSON.parse(data));
}

const normalizeText = (value) => String(value ?? '').trim();

function formatValue(label, value, unit) {
  if (value === null || value === undefined || value === '') return `${label}: sin dato`;
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return `${label}: ${numeric.toFixed(numeric % 1 === 0 ? 0 : 1)}${unit ? ` ${unit}` : ''}`;
  }
  return `${label}: ${value}`;
}

function summarizeTelemetry(rows = []) {
  const latest = rows.find((row) => row?.is_simulated !== true);
  if (!latest) {
    return 'Do not use simulated readings to give personal recommendations.';
  }

  const keys = ['hr', 'spo2', 'temp', 'resp', 'co2', 'gravity', 'latency_s', 'mission_day'];
  const values = keys
    .filter((key) => latest?.[key] !== null && latest?.[key] !== undefined && latest?.[key] !== '')
    .map((key) => formatValue(key, latest[key], key === 'hr' ? 'lpm' : key === 'spo2' ? '%' : key === 'temp' ? 'C' : key === 'resp' ? 'rpm' : key === 'co2' ? 'ppm' : key === 'gravity' ? 'm/s2' : key === 'latency_s' ? 's' : 'dia'));

  return `Latest available reading: ${values.join(' | ') || 'sin valores'}.`;
}
function pickRelevantEvidence(question, entries = []) {
  const normalizedQuestion = question.toLowerCase();
  const concepts = [
    ['sleep', 'sueño', 'dormir', 'descanso'],
    ['circadian', 'circadiano', 'ritmo biológico'],
    ['fatigue', 'fatiga', 'cansancio'],
    ['alertness', 'vigilancia', 'alerta'],
    ['reaction', 'reacción', 'respuesta'],
    ['cognition', 'cognición', 'cognitivo'],
    ['stress', 'estrés'],
    ['heart', 'corazón', 'cardio', 'cardiovascular'],
    ['oxygen', 'oxígeno', 'spo2'],
    ['temperature', 'temperatura'],
    ['co2', 'dióxido de carbono', 'ventilación', 'aire'],
    ['respiration', 'respiración'],
    ['radiation', 'radiación'],
    ['vision', 'visión', 'visual', 'eye', 'ojos'],
    ['hydration', 'hidratación'],
    ['nutrition', 'nutrición', 'alimentación'],
    ['wellness', 'bienestar', 'salud'],
    ['exercise', 'ejercicio'],
    ['recovery', 'recuperación'],
    ['mission', 'misión']
  ];

  return entries
    .map((entry) => {
      const haystack = [entry.title, entry.summary, ...(entry.excerpts || [])].join(' ').toLowerCase();
      let score = 0;
      for (const synonyms of concepts) {
        const askedAboutConcept = synonyms.some((term) => normalizedQuestion.includes(term));
        const evidenceCoversConcept = synonyms.some((term) => haystack.includes(term));
        if (askedAboutConcept && evidenceCoversConcept) score += 2;
      }
      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map(({ entry }) => entry);
}

function buildPrompt(question, telemetrySummary, evidenceEntries = []) {
  const context = evidenceEntries.length
    ? evidenceEntries.map((entry) => `- ${entry.title} (${entry.date}): ${entry.url}\n  ${entry.excerpts?.slice(0, 2).join(' ') || entry.summary}`).join('\n\n')
    : 'There is no relevant NASA reference for this question.';

  return `You are Dr. SIMI, a wellness assistant. Always reply in clear, direct English for people without medical training.

Rules:
- Maximum 350 characters, including spaces. Check the length before responding.
- Do not greet the user, repeat the question, or summarize readings.
- Do not mention simulated data or scientific evidence. If useful, add one brief reference such as (NASA HRP: sleep, 2024).
- Use personal readings only when verified. Do not diagnose or recommend treatment.
- If the question suggests an emergency, recommend contacting the medical team immediately.
- Give a practical, easy-to-understand answer. If you do not know, say so briefly.

Available personal readings (do not list or summarize them):
${telemetrySummary}

NASA reference for context:
${context}

Question:
${question}`;
}

function limitAnswer(text, maxLength = 350) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const shortened = clean.slice(0, maxLength - 3);
  const boundary = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, boundary > 0 ? boundary : shortened.length).trimEnd()}...`;
}
async function getUserTelemetry(client, userId) {
  const { data, error } = await client
    .from('telemetry')
    .select('ts, hr, rr, temp, spo2, resp, co2, gravity, latency_s, mission_day, is_simulated, automatic_data, manual_measurements')
    .eq('user_id', userId)
    .order('ts', { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  return data || [];
}

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      input: prompt,
      store: false,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || `Gemini returned status ${response.status}`;
    throw new Error(message);
  }

  const text = payload?.steps
    ?.filter((step) => step?.type === 'model_output')
    .flatMap((step) => step.content || [])
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini returned no usable content.');
  }

  return text;
}

async function translateQuestionForSearch(question) {
  const prompt = `Translate this question into a short English search query.
Return only the query, with no explanation. Preserve the health topic and symptoms.

Question: ${question}`;

  return callGemini(prompt);
}

export default async function handler(request, response) {
  const method = request.method || 'GET';
  if (method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Supabase environment variables are missing.');
    }

    const authHeader = request.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      response.status(401).json({ error: 'Authorization header missing or invalid.' });
      return;
    }

    const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) {
      response.status(401).json({ error: 'Supabase session invalid.' });
      return;
    }

    const body = request.body || {};
    const question = normalizeText(body.question || body.prompt || '');
    if (!question) {
      response.status(400).json({ error: 'Question is required.' });
      return;
    }

    const telemetryRows = await getUserTelemetry(client, user.id);
    const knowledge = await readJson(knowledgePath);
    const englishQuery = await translateQuestionForSearch(question);
    const evidenceEntries = pickRelevantEvidence(
      `${question} ${englishQuery}`,
      knowledge.entries || [],
    );
    const summary = summarizeTelemetry(telemetryRows);
    const prompt = buildPrompt(question, summary, evidenceEntries);
    const answer = limitAnswer(await callGemini(prompt));

    response.status(200).json({
      answer,
      telemetry: telemetryRows.slice(0, 3),
      evidence: evidenceEntries.map((entry) => ({ title: entry.title, date: entry.date, url: entry.url })),
      userId: user.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not process the request.';
    response.status(500).json({
      error: message,
      answer: 'I could not answer right now. Check the server configuration and try again.',
    });
  }
}
