/**
 * Cloudflare Worker API proxy for Finnhub.
 * Add FINNHUB_API_KEY as a Worker secret; never put it in index.html.
 * Routes: GET /quotes?symbols=AAPL,MSFT,SPY
 *         GET /history?symbols=AAPL,MSFT,SPY&days=30
 */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store"
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
}
function parseSymbols(raw, max = 10) {
  const symbols = [...new Set((raw || "").split(",").map(s => s.trim().toUpperCase()).filter(Boolean))];
  if (!symbols.length || symbols.length > max || symbols.some(s => !/^[A-Z0-9.\-]{1,12}$/.test(s))) return null;
  return symbols;
}
async function providerFetch(url, cacheSeconds = 60) {
  return fetch(url, { cf: { cacheTtl: cacheSeconds, cacheEverything: true } });
}
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return json({ error: "Only GET requests are supported." }, 405);
    if (!env.FINNHUB_API_KEY) return json({ error: "Missing FINNHUB_API_KEY Worker secret. Add it in Cloudflare Worker settings." }, 503);
    const url = new URL(request.url);
    const symbols = parseSymbols(url.searchParams.get("symbols"), 10);
    if (!symbols) return json({ error: "Provide 1–10 valid ticker symbols in the symbols query parameter." }, 400);
    try {
      if (url.pathname === "/quotes") {
        const quotes = await Promise.all(symbols.map(async symbol => {
          const api = new URL("https://finnhub.io/api/v1/quote");
          api.searchParams.set("symbol", symbol);
          api.searchParams.set("token", env.FINNHUB_API_KEY);
          const r = await providerFetch(api.toString(), 60);
          if (!r.ok) return { symbol, error: `Provider returned HTTP ${r.status}` };
          const q = await r.json();
          if (!Number.isFinite(Number(q.c)) || Number(q.c) <= 0) return { symbol, error: "No quote returned for this symbol." };
          return { symbol, price: Number(q.c), change: Number(q.d), percentChange: Number(q.dp), previousClose: Number(q.pc), timestamp: Number(q.t) || Math.floor(Date.now() / 1000) };
        }));
        return json({ provider: "Finnhub", fetchedAt: new Date().toISOString(), quotes });
      }
      if (url.pathname === "/history") {
        const daysRaw = Number(url.searchParams.get("days") || 30);
        const days = [30, 90, 180, 365].includes(daysRaw) ? daysRaw : 30;
        const to = Math.floor(Date.now() / 1000);
        const from = to - days * 24 * 60 * 60;
        const series = await Promise.all(symbols.map(async symbol => {
          const api = new URL("https://finnhub.io/api/v1/stock/candle");
          api.searchParams.set("symbol", symbol); api.searchParams.set("resolution", "D");
          api.searchParams.set("from", String(from)); api.searchParams.set("to", String(to));
          api.searchParams.set("token", env.FINNHUB_API_KEY);
          const r = await providerFetch(api.toString(), 3600);
          if (!r.ok) return { symbol, error: `Provider returned HTTP ${r.status}`, candles: [] };
          const d = await r.json();
          if (d.s !== "ok" || !Array.isArray(d.t) || !Array.isArray(d.c)) return { symbol, error: "Historical candles unavailable for this symbol or plan.", candles: [] };
          return { symbol, candles: d.t.map((ts, i) => ({ date: new Date(ts * 1000).toISOString().slice(0, 10), close: Number(d.c[i]) })).filter(x => Number.isFinite(x.close)) };
        }));
        return json({ provider: "Finnhub", fetchedAt: new Date().toISOString(), days, series });
      }
      return json({ error: "Unknown route. Use /quotes or /history." }, 404);
    } catch (e) {
      return json({ error: "Market data provider request failed.", detail: String(e?.message || e) }, 502);
    }
  }
};
