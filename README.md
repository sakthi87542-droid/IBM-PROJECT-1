# 🎬 AI Cinematic Story & Visual Director

Transform a simple story idea into a **professional cinematic production plan** powered by **IBM watsonx.ai Granite**.

---

## ✨ Features

| Module | Output |
|--------|--------|
| 👤 **Character Development** | 3 detailed profiles — personality, arc, conflict |
| 🎬 **Scene Design** | 5 cinematic scenes — location, emotion, purpose |
| 🎥 **Camera Direction** | Shot types with cinematic reasoning |
| 🎨 **Visual Style** | Lighting, color mood, composition per scene |
| 💬 **Dialogue** | Character-driven natural lines with acting notes |
| 📋 **Final Plan** | Printable production blueprint |

---

## 🚀 Deploy to Vercel

### 1. Prerequisites

- A [Vercel](https://vercel.com) account (free tier works)
- An [IBM Cloud](https://cloud.ibm.com) account with **watsonx.ai** enabled
- Your IBM Cloud **API Key** and **watsonx.ai Project ID**

### 2. Get IBM Credentials

1. Go to [cloud.ibm.com](https://cloud.ibm.com) → **Manage → Access (IAM) → API Keys** → **Create**
2. Go to [dataplatform.cloud.ibm.com](https://dataplatform.cloud.ibm.com) → **Projects** → open your project → **Manage → General** → copy the **Project ID**

### 3. Deploy

#### Option A — Vercel Dashboard (easiest)

1. Push this repo to **GitHub / GitLab / Bitbucket**
2. Go to [vercel.com/new](https://vercel.com/new) → Import the repository
3. Leave **Framework Preset** as `Other`
4. Set **Environment Variables** (see below)
5. Click **Deploy**

#### Option B — Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

### 4. Set Environment Variables in Vercel

In **Vercel Dashboard → Your Project → Settings → Environment Variables**, add:

| Variable | Value | Required |
|----------|-------|----------|
| `IBM_API_KEY` | Your IBM Cloud API Key | ✅ Yes |
| `IBM_PROJECT_ID` | Your watsonx.ai Project ID | ✅ Yes |

> **Security note:** When these are set as Vercel env vars, they never reach the browser. The serverless functions in `/api/` handle all IBM calls server-side.

### 5. Optional — User-supplied credentials

If `IBM_API_KEY` / `IBM_PROJECT_ID` are **not** set as env vars, users can enter their own credentials via the **⚙ IBM AI Config** button in the app. Credentials are stored only in the user's own `localStorage`.

---

## 🗂 Project Structure

```
.
├── index.html          # App entry point
├── style.css           # Film-studio dark theme
├── app.js              # Application logic + AI pipeline
├── vercel.json         # Vercel routing config
├── api/
│   ├── generate.js     # Serverless proxy → watsonx.ai inference
│   └── token.js        # Serverless proxy → IBM IAM token exchange
└── README.md
```

---

## 🔧 Local Development

```bash
# Install Vercel CLI globally
npm i -g vercel

# Run locally with serverless functions
vercel dev
```

Then open `http://localhost:3000`.

> **Note:** Plain `open index.html` works for the UI but the `/api/` routes require `vercel dev`.

---

## 🤖 Model

- **IBM watsonx.ai** — `ibm/granite-3-3-8b-instruct`
- Regions supported: `us-south` · `eu-gb` · `eu-de` · `jp-tok` · `au-syd`

---

## 📄 License

MIT — built with ❤️ using IBM watsonx.ai Granite.
