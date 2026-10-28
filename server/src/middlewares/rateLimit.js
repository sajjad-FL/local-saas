// In-memory per-IP limiter (one server process). With failuresOnly, only responses with an
// error status count, so a busy gym on one Wi-Fi isn't blocked by members checking in.
export function rateLimit({ max, windowMs, message, failuresOnly = false }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    hits.set(req.ip, recent);
    if (hits.size > 10000) for (const [ip, list] of hits) if (!list.length) hits.delete(ip); // forget idle IPs
    if (recent.length >= max) return res.status(429).json({ error: message });
    if (failuresOnly) {
      res.on('finish', () => { if (res.statusCode >= 400) hits.get(req.ip)?.push(Date.now()); });
    } else {
      recent.push(now);
    }
    next();
  };
}
