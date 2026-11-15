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
  if (!rows.length) {
    return 'No hay lecturas recientes del astronauta disponibles para esta sesión.';
  }

  const latest = rows[0];
  const keys = ['hr', 'spo2', 'temp', 'resp', 'co2', 'gravity', 'latency_s', 'mission_day'];
  const values = keys
    .filter((key) => latest?.[key] !== null && latest?.[key] !== undefined && latest?.[key] !== '')
    .map((key) => formatValue(key, latest[key], key === 'hr' ? 'lpm' : key === 'spo2' ? '%' : key === 'temp' ? '°C' : key === 'resp' ? 'rpm' : key === 'co2' ? 'ppm' : key === 'gravity' ? 'm/s²' : key === 'latency_s' ? 's' : 'día'));

  const simulated = latest?.is_simulated ? ' (datos simulados del prototipo)' : '';
  return `Último registro${simulated}: ${new Date(latest.ts).toLocaleString('es-MX')} · ${values.join(' · ') || 'sin valores críticos disponibles'}.`;
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
    : 'No se adjuntaron evidencias relevantes del programa human research.';

  return `Eres Dr. SIMI, un asistente de bienestar para astronautas en un prototipo de misión. Responde en español, con un tono útil, claro y conservador. Nunca describas los datos como diagnósticos definitivos; solo ofrece orientación general basada en la información disponible.

Reglas:
- Usa solo la información del astronauta actual y las evidencias de NASA que te proporcionan abajo.
- Si los datos son simulados o de prototipo, dilo claramente y no los presentes como mediciones reales del astronauta.
- Si faltan datos o no hay evidencia suficiente, di claramente que no hay suficiente información y qué datos adicionales harían falta.
- No des diagnósticos médicos definitivos ni órdenes clínicas.
- Enfatiza las medidas generales de descanso, recuperación, presión ambiental, reacción y vigilancia.
- Si la pregunta es sobre la salud del astronauta, responde con un marco de monitorización y recomendaciones de seguridad y recuperación.

Datos del astronauta:
${telemetrySummary}

Evidencias NASA:
${context}

Pregunta del usuario:
${question}

Respuesta esperada:
- Responde directamente en español.
- Menciona la evidencia de NASA de forma breve con títulos y años cuando aplique.
- Asegúrate de marcar claramente si los datos son simulados.
- Finaliza con una recomendación práctica de 1 a 3 pasos.`;
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
    throw new Error('GEMINI_API_KEY no está configurada.');
  }

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || `Gemini respondió con estado ${response.status}`;
    throw new Error(message);
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini no devolvió contenido útil.');
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
      throw new Error('Faltan variables de entorno de Supabase.');
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
    const answer = await callGemini(prompt);

    response.status(200).json({
      answer,
      telemetry: telemetryRows.slice(0, 3),
      evidence: evidenceEntries.map((entry) => ({ title: entry.title, date: entry.date, url: entry.url })),
      userId: user.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo procesar la solicitud.';
    response.status(500).json({
      error: message,
      answer: 'No pude responder en este momento. Revisa la configuración del servidor y vuelve a intentarlo.',
    });
  }
}
