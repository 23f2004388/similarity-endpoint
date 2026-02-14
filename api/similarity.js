export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const { docs, query } = req.body || {};
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({ error: "Missing docs" });
  }
  if (typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "Missing query" });
  }

  // ✅ Use AI Pipe token (set this in Vercel env vars)
  const AI_PIPE_TOKEN = process.env.AI_PIPE_TOKEN;
  if (!AI_PIPE_TOKEN) {
    return res.status(500).json({ error: "Missing AI_PIPE_TOKEN env var" });
  }

  const input = [query, ...docs];

  const resp = await fetch("https://aipipe.org/openai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_PIPE_TOKEN}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    return res.status(resp.status).json({ error: "Embedding failed", details: data });
  }

  const vectors = data.data.map((x) => x.embedding);
  const qVec = vectors[0];
  const docVecs = vectors.slice(1);

  const dot = (a, b) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  };
  const norm = (a) => Math.sqrt(dot(a, a)) || 1;

  const qNorm = norm(qVec);

  const scored = docVecs.map((v, i) => {
    const score = dot(qVec, v) / (qNorm * norm(v));
    return { i, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const matches = scored.slice(0, 3).map((x) => docs[x.i]);

  return res.status(200).json({ matches });
}
