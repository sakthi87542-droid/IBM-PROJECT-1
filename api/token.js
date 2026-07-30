/**
 * /api/token
 * Serverless proxy — exchanges IBM Cloud API key for an IAM Bearer token.
 * The API key is stored in Vercel Environment Variables, never exposed to the browser.
 *
 * POST body (JSON): { apiKey: "..." }   ← sent from the browser
 *   OR uses process.env.IBM_API_KEY if set (recommended for production)
 */
export default async function handler(req, res) {
  // Handle CORS preflight
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

  // Use server-side env var if set, otherwise fall back to key sent from client
  const apiKey = process.env.IBM_API_KEY || (req.body && req.body.apiKey);

  if (!apiKey) {
    return res.status(400).json({ error: 'IBM_API_KEY not configured.' });
  }

  try {
    const response = await fetch('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`,
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.errorMessage || 'IAM auth failed', details: data });
    }

    return res.status(200).json({
      access_token: data.access_token,
      expires_in:   data.expires_in,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
