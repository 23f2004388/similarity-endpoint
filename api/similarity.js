export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const { docs, query } = req.body || {};
  if (!Array.isArray(docs) || typeof query !== "string") {
    return res.status(400).json({ error: "Body must be { docs: string[], query: string }" });
  }

  // Simple similarity proxy: overlap score (stable, no external API needed)
  const q = query.toLowerCase();
  const scored = docs.map((d) => {
    const text = String(d || "");
    const t = text.toLowerCase();
    let score = 0;
    for (const w of q.split(/\s+/).filter(Boolean)) {
      if (t.includes(w)) score += 1;
    }
    return { text, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // return top 3 docs (or fewer if <3 provided)
  const matches = scored.slice(0, 3).map(x => x.text);

  return res.status(200).json({ matches });
}
