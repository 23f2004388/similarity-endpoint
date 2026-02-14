export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const { docs, query } = req.body || {};
  if (!Array.isArray(docs) || docs.length === 0)
    return res.status(400).json({ error: "Missing docs" });
  if (typeof query !== "string" || !query.trim())
    return res.status(400).json({ error: "Missing query" });

  // 1) Get embeddings for [query, ...docs]
  const input = [query, ...docs];

  const resp = await fetch("https://aipipe.org/openai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.AI_PIPE_TOKEN}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    return res.status(500).json({ error: `Embedding failed: ${resp.status} ${txt}` });
  }

  const data = await resp.json();
  const vectors = data.data.map((x) => x.embedding);

  const qVec = vectors[0];
  const docVecs = vectors.slice(1);

  // 2) Cosine similarity helpers
  const dot = (a, b) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  };
  const norm = (a) => Math.sqrt(dot(a, a));
  const qNorm = norm(qVec) || 1;

  // 3) Score, sort, take top 3
  const scored = docVecs.map((v, i) => {
    const score = dot(qVec, v) / (qNorm * (norm(v) || 1));
    return { i, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const top3 = scored.slice(0, 3).map((x) => docs[x.i]);

  // 4) Return EXACT format
  return res.status(200).json({ matches: top3 });
}
