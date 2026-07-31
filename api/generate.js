/**
 * /api/generate
 * Serverless proxy — forwards generation requests to Google Gemini (free tier).
 * The API key is kept server-side via env var; only the generated text is returned.
 *
 * POST body (JSON):
 * {
 *   prompt:    string,
 *   maxTokens: number,       // optional, default 1800
 *   apiKey:    string,       // browser fallback if GEMINI_API_KEY env var not set
 *   modelId:   string        // optional, e.g. "gemini-1.5-flash"
 * }
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const {
    prompt,
    maxTokens = 1800,
    modelId   = 'gemini-1.5-flash',
    apiKey:   clientApiKey,
  } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  // Prefer server-side env var; fall back to value sent from the browser
  const apiKey = process.env.GEMINI_API_KEY || clientApiKey;

  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API key not configured.' });
  }

  const endpoint = `${GEMINI_BASE}/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const geminiRes = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature:     0.7,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(geminiRes.status).json({
        error:   `Gemini error (${geminiRes.status})`,
        details: errText.slice(0, 400),
      });
    }

    const geminiData   = await geminiRes.json();
    const generatedText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.status(200).json({ generated_text: generatedText });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
