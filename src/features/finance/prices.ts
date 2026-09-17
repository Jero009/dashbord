// Live market-price fetching for investment holdings.
//   - Crypto  → CoinGecko (free, no key): price in the user's currency + 24h change.
//   - Stocks/funds → Yahoo Finance chart endpoint: regular-market price + day change.
// Uses CapacitorHttp so native requests bypass WebView CORS. On web (dev only)
// it falls back to the same call, which may CORS-fail — acceptable since the app
// is native-first. All functions degrade gracefully (missing quote = skipped).

import { CapacitorHttp } from '@capacitor/core';
import { getCurrency, getCoinGeckoApiKey } from '@/shared/utils/userSettings';

export interface PriceQuote {
  price: number; // per-unit price in `currency`
  changePct: number | null; // 24h % change
  currency: string;
  /** True when the price was FX-converted into the user's currency. */
  fxConverted?: boolean;
  /** True when FX conversion was needed but failed (price is in `currency`, not the user's). */
  fxFailed?: boolean;
}

export interface PriceableHolding {
  id: number;
  type: string; // 'crypto' | 'stock' | 'fund' | 'other'
  symbol: string;
}

// Common ticker → CoinGecko coin id. Unknown tickers fall through to the raw
// lowercased symbol (lets users type a full id like "cardano" directly).
const CRYPTO_IDS: Record<string, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  usdt: 'tether',
  bnb: 'binancecoin',
  sol: 'solana',
  usdc: 'usd-coin',
  xrp: 'ripple',
  ada: 'cardano',
  doge: 'dogecoin',
  trx: 'tron',
  ton: 'the-open-network',
  dot: 'polkadot',
  matic: 'matic-network',
  link: 'chainlink',
  ltc: 'litecoin',
  bch: 'bitcoin-cash',
  avax: 'avalanche-2',
  shib: 'shiba-inu',
  xmr: 'monero',
  atom: 'cosmos',
  uni: 'uniswap',
  near: 'near',
  apt: 'aptos',
  arb: 'arbitrum',
  op: 'optimism',
  algo: 'algorand',
  xlm: 'stellar',
};

const resolveCoinId = (symbol: string): string => {
  const key = symbol.trim().toLowerCase();
  return CRYPTO_IDS[key] ?? key;
};

const getJson = async (url: string, headers: Record<string, string> = {}): Promise<any> => {
  const res = await CapacitorHttp.get({ url, headers: { Accept: 'application/json', ...headers } });
  if (res.status < 200 || res.status >= 300) return null;
  if (typeof res.data === 'string') {
    try {
      return JSON.parse(res.data);
    } catch {
      return null;
    }
  }
  return res.data ?? null;
};

const fetchCrypto = async (items: PriceableHolding[], out: Map<number, PriceQuote>): Promise<void> => {
  if (!items.length) return;
  const vs = getCurrency().toLowerCase();
  const ids = Array.from(new Set(items.map((i) => resolveCoinId(i.symbol))));
  const url =
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(','))}` +
    `&vs_currencies=${encodeURIComponent(vs)}&include_24hr_change=true`;
  // Optional demo key raises the rate limit (100 calls/min); empty = keyless.
  const key = getCoinGeckoApiKey().trim();
  const data = await getJson(url, key ? { 'x-cg-demo-api-key': key } : {}).catch(() => null);
  if (!data) return;
  for (const item of items) {
    const row = data[resolveCoinId(item.symbol)];
    const price = row?.[vs];
    if (typeof price !== 'number') continue;
    const change = row?.[`${vs}_24h_change`];
    out.set(item.id, {
      price,
      changePct: typeof change === 'number' ? change : null,
      currency: vs.toUpperCase(),
    });
  }
};

// ── FX conversion ────────────────────────────────────────────────────────────
// Yahoo quotes arrive in the instrument's native currency; the app stores one
// value per holding in the user's currency. Convert at fetch time via the
// free frankfurter.app FX endpoint (ECB reference rates, no key), with a tiny
// in-memory cache so N holdings sharing a quote currency = 1 request.

const fxCache = new Map<string, number>(); // "EUR->USD" → rate
const FX_TTL_MS = 60 * 60 * 1000;
let fxCacheAt = 0;

export async function fxRate(from: string, to: string): Promise<number | null> {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return 1;
  const key = `${f}->${t}`;
  if (fxCache.has(key) && Date.now() - fxCacheAt < FX_TTL_MS) return fxCache.get(key)!;
  try {
    const data = await getJson(`https://api.frankfurter.app/latest?from=${f}&to=${t}`);
    const rate = typeof data?.rates?.[t] === 'number' ? data.rates[t] : null;
    if (rate != null) {
      fxCache.set(key, rate);
      fxCacheAt = Date.now();
    }
    return rate;
  } catch {
    return null;
  }
}

const fetchOneStock = async (item: PriceableHolding, out: Map<number, PriceQuote>): Promise<void> => {
  const sym = item.symbol.trim().toUpperCase();
  if (!sym) return;
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}` +
    `?interval=1d&range=2d`;
  const data = await getJson(url).catch(() => null);
  const meta = data?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== 'number') return;
  const prev = meta?.chartPreviousClose ?? meta?.previousClose;
  const changePct = typeof prev === 'number' && prev !== 0 ? ((price - prev) / prev) * 100 : null;
  const quoteCurrency = typeof meta?.currency === 'string' ? meta.currency : 'USD';
  const userCurrency = getCurrency();
  // Convert to the user's currency at fetch time so stored values are directly
  // comparable across the portfolio. A failed FX fetch keeps the raw price and
  // flags the quote's true currency — the caller surfaces it, never silently skips.
  let priceInUser = price;
  let fxFailed = false;
  const rate = await fxRate(quoteCurrency, userCurrency);
  if (rate != null) {
    priceInUser = price * rate;
  } else if (quoteCurrency.toUpperCase() !== userCurrency) {
    fxFailed = true;
  }
  out.set(item.id, {
    price: priceInUser,
    changePct,
    currency: quoteCurrency.toUpperCase() === userCurrency ? userCurrency : quoteCurrency.toUpperCase(),
    fxConverted: rate != null,
    fxFailed,
  });
};

// Fetch live quotes for every holding that has a symbol. Crypto is batched into
// one CoinGecko call; stocks are fetched per-symbol (Yahoo is single-symbol).
export async function fetchInvestmentPrices(
  holdings: PriceableHolding[]
): Promise<Map<number, PriceQuote>> {
  const out = new Map<number, PriceQuote>();
  const withSymbol = holdings.filter((h) => h.symbol && h.symbol.trim());
  const crypto = withSymbol.filter((h) => h.type === 'crypto');
  const stocks = withSymbol.filter((h) => h.type !== 'crypto');
  await Promise.all([
    fetchCrypto(crypto, out),
    ...stocks.map((s) => fetchOneStock(s, out).catch(() => undefined)),
  ]);
  return out;
}
