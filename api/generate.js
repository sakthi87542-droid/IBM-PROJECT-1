/**
 * /api/generate
 * Serverless proxy — forwards generation requests to Groq (free tier).
 * The API key is kept server-side via env var; only the generated text is returned.
 *
 * POST body (JSON):
 * {
 *   prompt:    string,
 *   maxTokens: number,    // optional, default 1800
 *   apiKey:    string,    // browser fallback if GROQ_API_KEY env var not set
 *   modelId:   string     // optional, default "llama-3.3-70b-versatile"
 * }
 */

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

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
    modelId   = 'llama-3.3-70b-versatile',
    apiKey:   clientApiKey,
  } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  // Prefer server-side env var; fall back to value sent from the browser
  const apiKey = (process.env.GROQ_API_KEY || clientApiKey || '').trim();

  if (!apiKey) {
    return res.status(400).json({ error: 'Groq API key not configured.' });
  }

  try {
    const groqRes = await fetch(GROQ_ENDPOINT, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       modelId,
        max_tokens:  maxTokens,
        temperature: 0.7,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      let errDetail = errText.slice(0, 400);
      try { errDetail = JSON.parse(errText)?.error?.message || errDetail; } catch (_) {}
      return res.status(groqRes.status).json({
        error: `Groq error (${groqRes.status}): ${errDetail}`,
      });
    }

    const groqData      = await groqRes.json();
    const generatedText = groqData.choices?.[0]?.message?.content || '';

    return res.status(200).json({ generated_text: generatedText });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
