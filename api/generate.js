/**
 * /api/generate
 * Serverless proxy — forwards generation requests to IBM watsonx.ai.
 * Keeps the IAM Bearer token server-side; only the generated text is returned.
 *
 * POST body (JSON):
 * {
 *   prompt:    string,
 *   maxTokens: number,       // optional, default 1800
 *   projectId: string,       // can be overridden by env var IBM_PROJECT_ID
 *   region:    string,       // e.g. "us-south"
 *   modelId:   string        // e.g. "ibm/granite-3-3-8b-instruct"
 * }
 */

const REGIONS = {
  'us-south': 'https://us-south.ml.cloud.ibm.com',
  'eu-gb':    'https://eu-gb.ml.cloud.ibm.com',
  'eu-de':    'https://eu-de.ml.cloud.ibm.com',
  'jp-tok':   'https://jp-tok.ml.cloud.ibm.com',
  'au-syd':   'https://au-syd.ml.cloud.ibm.com',
};

// Simple in-memory token cache (lives for the duration of the serverless instance)
let cachedToken   = '';
let tokenExpiry   = 0;

async function getToken(apiKey) {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`IAM auth failed (${res.status}): ${t.slice(0, 200)}`);
  }

  const data    = await res.json();
  cachedToken   = data.access_token;
  tokenExpiry   = Date.now() + (data.expires_in - 120) * 1000;
  return cachedToken;
}

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
    projectId: clientProjectId,
    region    = 'us-south',
    modelId   = 'ibm/granite-3-3-8b-instruct',
    apiKey:   clientApiKey,
  } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  // Prefer server-side env vars; fall back to values sent from the browser
  const apiKey    = process.env.IBM_API_KEY    || clientApiKey;
  const projectId = process.env.IBM_PROJECT_ID || clientProjectId;

  if (!apiKey)    return res.status(400).json({ error: 'IBM_API_KEY not configured.' });
  if (!projectId) return res.status(400).json({ error: 'IBM_PROJECT_ID not configured.' });

  try {
    const token    = await getToken(apiKey);
    const baseUrl  = REGIONS[region] || REGIONS['us-south'];
    const endpoint = `${baseUrl}/ml/v1/text/generation?version=2023-05-29`;

    const wxRes = await fetch(endpoint, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        model_id:   modelId,
        project_id: projectId,
        input:      prompt,
        parameters: {
          decoding_method:    'greedy',
          max_new_tokens:     maxTokens,
          stop_sequences:     ['---END---'],
          repetition_penalty: 1.1,
        },
      }),
    });

    if (!wxRes.ok) {
      const errText = await wxRes.text();
      return res.status(wxRes.status).json({ error: `watsonx.ai error (${wxRes.status})`, details: errText.slice(0, 400) });
    }

    const wxData      = await wxRes.json();
    const generatedText = wxData.results?.[0]?.generated_text || '';

    return res.status(200).json({ generated_text: generatedText });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
