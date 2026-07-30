/**
 * /api/db
 * Serverless CRUD proxy for Supabase.
 * All database access happens server-side — the Supabase service-role key
 * is never exposed to the browser.
 *
 * Actions (POST body JSON):
 *   { action: 'save',   project: { idea, characters, scenes, camera, visual, dialogue } }
 *   { action: 'list' }
 *   { action: 'load',   projectId: "<uuid>" }
 *   { action: 'delete', projectId: "<uuid>" }
 */

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;   // service-role, server only
const SUPABASE_ANON    = process.env.SUPABASE_ANON_KEY;           // fallback anon key

function sbHeaders() {
  const key = SUPABASE_KEY || SUPABASE_ANON;
  return {
    'Content-Type':  'application/json',
    'apikey':        key,
    'Authorization': `Bearer ${key}`,
    'Prefer':        'return=representation',
  };
}

async function sbFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: sbHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// ── SAVE ─────────────────────────────────────────────────
async function saveProject({ idea, characters, scenes, camera, visual, dialogue }) {
  // 1. Insert project row
  const [project] = await sbFetch('/projects', 'POST', { idea });
  const pid = project.id;

  // 2. Insert child rows in parallel
  await Promise.all([
    characters?.length && sbFetch('/characters', 'POST',
      characters.map((c, i) => ({
        project_id: pid, sort_order: i,
        name: c.Name, age: c.Age, role: c.Role,
        personality: c.Personality, background: c.Background,
        goal: c.Goal, strengths: c.Strengths, weaknesses: c.Weaknesses,
        motivation: c.Motivation, conflict: c.Conflict, arc: c.Arc,
      }))
    ),
    scenes?.length && sbFetch('/scenes', 'POST',
      scenes.map((s, i) => ({
        project_id: pid, sort_order: i,
        number: s.Number, title: s.Title, location: s.Location,
        time: s.Time, atmosphere: s.Atmosphere, characters: s.Characters,
        action: s.Action, emotion: s.Emotion, visual: s.Visual, purpose: s.Purpose,
      }))
    ),
    camera?.length && sbFetch('/camera_shots', 'POST',
      camera.map((c, i) => ({
        project_id: pid, sort_order: i,
        scene: c.Scene, type: c.Type, description: c.Description, reason: c.Reason,
      }))
    ),
    visual?.length && sbFetch('/visual_styles', 'POST',
      visual.map((v, i) => ({
        project_id: pid, sort_order: i,
        scene: v.Scene, lighting: v.Lighting, composition: v.Composition,
        camera_movement: v.CameraMovement, depth_of_field: v.DepthOfField,
        background: v.Background, color_mood: v.ColorMood,
        contrast: v.Contrast, mood: v.Mood,
      }))
    ),
    dialogue?.length && sbFetch('/dialogues', 'POST',
      dialogue.map((d, i) => ({
        project_id: pid, sort_order: i,
        scene: d.scene, lines: d.lines,
      }))
    ),
  ]);

  return { id: pid };
}

// ── LIST ─────────────────────────────────────────────────
async function listProjects() {
  return sbFetch('/projects?select=id,idea,created_at&order=created_at.desc&limit=50');
}

// ── LOAD ─────────────────────────────────────────────────
async function loadProject(projectId) {
  const id = encodeURIComponent(projectId);

  const [projectArr, characters, scenes, camera, visual, dialogue] = await Promise.all([
    sbFetch(`/projects?id=eq.${id}&select=*`),
    sbFetch(`/characters?project_id=eq.${id}&order=sort_order.asc`),
    sbFetch(`/scenes?project_id=eq.${id}&order=sort_order.asc`),
    sbFetch(`/camera_shots?project_id=eq.${id}&order=sort_order.asc`),
    sbFetch(`/visual_styles?project_id=eq.${id}&order=sort_order.asc`),
    sbFetch(`/dialogues?project_id=eq.${id}&order=sort_order.asc`),
  ]);

  if (!projectArr?.length) throw new Error('Project not found');

  // Re-map snake_case columns back to the app's camelCase/PascalCase format
  return {
    id:         projectArr[0].id,
    idea:       projectArr[0].idea,
    created_at: projectArr[0].created_at,
    characters: characters.map(c => ({
      Name: c.name, Age: c.age, Role: c.role,
      Personality: c.personality, Background: c.background,
      Goal: c.goal, Strengths: c.strengths, Weaknesses: c.weaknesses,
      Motivation: c.motivation, Conflict: c.conflict, Arc: c.arc,
    })),
    scenes: scenes.map(s => ({
      Number: s.number, Title: s.title, Location: s.location,
      Time: s.time, Atmosphere: s.atmosphere, Characters: s.characters,
      Action: s.action, Emotion: s.emotion, Visual: s.visual, Purpose: s.purpose,
    })),
    camera: camera.map(c => ({
      Scene: c.scene, Type: c.type, Description: c.description, Reason: c.reason,
    })),
    visual: visual.map(v => ({
      Scene: v.scene, Lighting: v.lighting, Composition: v.composition,
      CameraMovement: v.camera_movement, DepthOfField: v.depth_of_field,
      Background: v.background, ColorMood: v.color_mood,
      Contrast: v.contrast, Mood: v.mood,
    })),
    dialogue: dialogue.map(d => ({ scene: d.scene, lines: d.lines })),
  };
}

// ── DELETE ────────────────────────────────────────────────
async function deleteProject(projectId) {
  await sbFetch(`/projects?id=eq.${encodeURIComponent(projectId)}`, 'DELETE');
  return { ok: true };
}

// ── HANDLER ───────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !(SUPABASE_KEY || SUPABASE_ANON)) {
    return res.status(500).json({ error: 'Supabase env vars not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).' });
  }

  const { action, project, projectId } = req.body || {};

  try {
    switch (action) {
      case 'save':   return res.status(200).json(await saveProject(project));
      case 'list':   return res.status(200).json(await listProjects());
      case 'load':   return res.status(200).json(await loadProject(projectId));
      case 'delete': return res.status(200).json(await deleteProject(projectId));
      default:       return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
