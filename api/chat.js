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
  if (value === null || value === undefined || value === '') return `${label}: unavailable`;
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return `${label}: ${numeric.toFixed(numeric % 1 === 0 ? 0 : 1)}${unit ? ` ${unit}` : ''}`;
  }
  return `${label}: ${value}`;
}

function summarizeTelemetry(rows = []) {
  const realRows = rows.filter((row) => row?.is_simulated !== true).slice(0, 5);
  if (!realRows.length) return 'No verified non-simulated telemetry is available. Do not infer personal readings.';
  const labels = { hr: ['heart rate', 'bpm'], rr: ['respiratory rate', 'breaths/min'], spo2: ['oxygen saturation', '%'], temp: ['temperature', 'C'], resp: ['respiration', 'breaths/min'], co2: ['cabin CO2', 'ppm'], gravity: ['gravity', 'm/s2'], latency_s: ['reaction latency', 's'], mission_day: ['mission day', ''] };
  return realRows.map((row, index) => {
    const values = Object.entries(labels).filter(([key]) => row[key] !== null && row[key] !== undefined && row[key] !== '')
      .map(([key, [label, unit]]) => formatValue(label, row[key], unit));
    return `${index === 0 ? 'Latest' : `Previous ${index}`}${row.ts ? ` (${row.ts})` : ''}: ${values.join(' | ') || 'no values'}`;
  }).join('\n');
}

function summarizeRecords(rows = []) {
  if (!rows.length) return 'No astronaut daily records are available.';
  return rows.slice(0, 7).map((row) => {
    const values = [
      row.sleep != null && `sleep ${row.sleep} h`,
      row.tlx != null && `NASA-TLX workload ${row.tlx}`,
      row.pvt != null && `PVT reaction time ${row.pvt}`,
      row.pvt_max != null && `PVT maximum reaction time ${row.pvt_max}`,
      row.fs != null && `PVT false starts ${row.fs}`,
      row.env != null && `environment ${row.env}`,
    ].filter(Boolean);
    return `${row.date || 'Date unavailable'}: ${values.join('; ') || 'no recorded values'}`;
  }).join('\n');
}

function buildNasaQuery(question) {
  const normalized = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const terms = [
    [/sleep|sueno|dormir|descanso|fatiga|cansancio/i, 'spaceflight sleep circadian fatigue astronaut'],
    [/reaction|reaccion|vigilancia|alerta|pvt|cogniti/i, 'astronaut vigilance reaction time cognitive performance spaceflight'],
    [/stress|estres|workload|carga|tlx/i, 'spaceflight behavioral health workload stress crew'],
    [/heart|corazon|cardio|oxygen|oxigeno|spo2|respir|co2|air|aire/i, 'spaceflight human health physiology spacecraft cabin environment'],
    [/radiation|radiacion/i, 'astronaut space radiation health risk'],
    [/vision|eye|ojos/i, 'spaceflight astronaut vision ocular health'],
  ];
  const related = terms.filter(([pattern]) => pattern.test(normalized)).map(([, query]) => query).join(' ');
  return `${question} ${related || 'astronaut human health spaceflight'}`.slice(0, 240);
}

async function searchNasa(question) {
  const params = new URLSearchParams({ q: buildNasaQuery(question), distribution: 'PUBLIC', page: '1', 'page.size': '5' });
  const response = await fetch(`https://ntrs.nasa.gov/api/citations/search?${params}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`NASA NTRS returned status ${response.status}`);
  const payload = await response.json();
  return (payload?.results || []).slice(0, 5).map((item) => ({
    title: normalizeText(item.title) || 'NASA technical report',
    date: normalizeText(item.publicationDate || item.created || item.published),
    url: `https://ntrs.nasa.gov/citations/${encodeURIComponent(String(item.id))}`,
    summary: normalizeText(item.abstract),
    excerpts: [],
  })).filter((item) => /^https:\/\/ntrs\.nasa\.gov\/citations\/\d+$/.test(item.url) && item.summary);
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

function buildPrompt(question, telemetrySummary, recordsSummary, evidenceEntries = []) {
  const context = evidenceEntries.length
    ? evidenceEntries.map((entry) => `- ${entry.title} (${entry.date}): ${entry.url}\n  ${entry.excerpts?.slice(0, 2).join(' ') || entry.summary}`).join('\n\n')
    : 'There is no relevant NASA reference for this question.';

  return `You are Dr. SIMI, the crew wellness assistant aboard a spacecraft on a mission far from Earth. Always reply in clear, direct English for a crew member.

Rules:
- Maximum 450 characters, including spaces.
- Do not greet the user, repeat the question, or summarize readings.
- Treat the astronaut as living and working in microgravity inside a spacecraft, with limited onboard resources and delayed Earth support. Tailor advice to safe actions feasible onboard and mission protocols.
- Use the supplied telemetry and daily astronaut records when relevant. Compare recent records for trends (sleep, NASA-TLX workload, PVT reaction time/false starts); briefly explain what they suggest, without presenting raw tables. Never invent readings or trends.
- Telemetry marked simulated is excluded. Do not claim readings are normal or abnormal without an appropriate reference range. Do not diagnose or prescribe.
- If symptoms or readings could indicate urgent danger, tell the astronaut to alert the onboard medical officer/mission control immediately and follow the emergency protocol.
- Answer the actual question with a short description or one specific, practical recommendation. If the data or NASA references do not support a conclusion, say so briefly. When using a reference, name the NASA report and include its URL.

Recent verified telemetry:
${telemetrySummary}

Astronaut daily records (newest first):
${recordsSummary}

NASA reference for context:
${context}

Question:
${question}`;
}

function limitAnswer(text, maxLength = 450) {
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

async function getUserRecords(client, userId) {
  const { data, error } = await client.from('records').select('date, env, sleep, tlx, pvt, pvt_max, fs')
    .eq('user_id', userId).order('date', { ascending: false }).limit(7);
  if (error) throw error;
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

    const [telemetryRows, recordRows] = await Promise.all([
      getUserTelemetry(client, user.id),
      getUserRecords(client, user.id),
    ]);
    const knowledge = await readJson(knowledgePath);
    const nasaEvidence = await searchNasa(question).catch(() => []);
    const localEvidence = pickRelevantEvidence(question, knowledge.entries || []);
    const evidenceEntries = nasaEvidence.length ? nasaEvidence.slice(0, 3) : localEvidence;
    const summary = summarizeTelemetry(telemetryRows);
    const recordsSummary = summarizeRecords(recordRows);
    const prompt = buildPrompt(question, summary, recordsSummary, evidenceEntries);
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
