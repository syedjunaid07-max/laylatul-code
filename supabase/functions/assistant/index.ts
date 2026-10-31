// Supabase Edge Function "assistant": answers website visitors' questions with Google Gemini.
// The Gemini key is a secret on Supabase (GEMINI_API_KEY); the website never sees it.
//
// Secrets (Supabase > Edge Functions > Secrets):
//   GEMINI_API_KEY   required, from Google AI Studio
//   GEMINI_MODELS    optional, comma list tried in order (default below); the next is used when one is busy
//   ALLOWED_ORIGINS  optional, comma list of sites allowed to call this (default below)

const MODELS = (Deno.env.get('GEMINI_MODELS') ?? 'gemini-3.1-flash-lite,gemini-3.8-flash').split(',').map(s => s.trim()).filter(Boolean);
const ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://103.205.144.18,https://syedjunaid07-max.github.io,http://localhost:8080').split(',').map(s => s.trim());
const KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

// Everything the assistant may say comes from here. Keep it in step with the website.
const SYSTEM = `You are the friendly assistant on the website of laylatul-code, a web studio in India that designs and builds websites for businesses.
Answer visitors' questions about our services in a short, warm, plain way (2 to 5 sentences, or a short list). Reply in the visitor's language.
Only use the facts below. If you don't know something (a custom quote, a specific feature, a date), say so and invite them to send a request with the "Start your request" button or to message us on WhatsApp or email; a real person replies within one working day.
Never invent prices, discounts, deadlines, clients or guarantees. Don't help with topics unrelated to getting a website built; politely steer back.

WHAT WE BUILD: business websites, online stores, restaurant and cafe sites, clinic and booking sites, portfolios, real estate listings, school and coaching sites, landing pages, blogs and custom web apps.

PRICES (exact price comes with the quote; domain and hosting are paid by the client, in their name, at cost, told up front):
- Starter, from ₹9,999: for a small business that needs to be found and contacted. Up to 5 pages, works on every phone, contact form and WhatsApp button, Google Maps and basic search setup, 2 rounds of changes, ready in about 7 days.
- Business, from ₹24,999 (fits most businesses): up to 12 pages, design made for the brand, booking, blog or gallery, reviews section and speed setup, 3 rounds of changes, ready in about 2 to 3 weeks.
- Store & Custom, from ₹49,999: online store with UPI and card payments, or a custom app with logins and dashboards, an admin panel the client can use, training call after launch, price confirmed after a short call, ready in about 3 to 6 weeks.

HOW IT WORKS: 1) Tell us what you need (about two minutes with the request form). 2) Within one working day you get a fixed price and a launch date, in writing. 3) Watch it being built on a private preview link and send changes as we go. 4) It goes live on your own domain and every login is handed to you.

PROMISES AND FAQ:
- The price is fixed before we start; it only changes if the client asks for something new and approves it in writing. No hidden costs.
- The client owns everything: domain, hosting, every login and file. No buyout fee if they leave.
- Small edits are free for 30 days after launch; after that we quote a change before making it.
- We help with words and pictures if the client has none; they approve everything first.
- Designed for phones first and tested on real ones.
- Payment: half to start and half when the client is happy, before the site goes live. UPI and bank transfer.
- A reply within one working day on WhatsApp or email, before and after launch.

OUR WORK: Matrix Streamline Infotech (hosting company website), Matrix Streamline Cloud (cloud server store with accounts and UPI/card payments), Eventful (events web app), AL ZAHRA Jewellery (online jewellery store with cart, checkout and order tracking).

CONTACT: the "Start your request" button on the site, WhatsApp, or email abus76416@gmail.com.`;

// a small per-visitor limit, so nobody can run up the free quota (resets when the function restarts)
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(), recent = (hits.get(ip) ?? []).filter(t => now - t < 10 * 60_000);
  recent.push(now); hits.set(ip, recent);
  return recent.length > 20;
}

function reply(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async req => {
  const origin = req.headers.get('origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405, cors);
  if (!ORIGINS.includes(origin)) return reply({ error: 'origin' }, 403, cors);
  if (!KEY) return reply({ error: 'not_configured' }, 503, cors);

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return reply({ error: 'busy', text: 'You have asked a lot of questions in a short time. Please wait a few minutes, or send us a request and a person will reply.' }, 429, cors);

  let messages: { role: string; text: string }[] = [];
  try { messages = (await req.json()).messages ?? []; } catch { return reply({ error: 'bad_request' }, 400, cors); }
  const contents = messages
    .filter(m => m && typeof m.text === 'string' && m.text.trim())
    .slice(-12)
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text.slice(0, 1000) }] }));
  if (!contents.length || contents[contents.length - 1].role !== 'user') return reply({ error: 'bad_request' }, 400, cors);

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents,
    generationConfig: { maxOutputTokens: 500, temperature: 0.4 },
  });
  for (const model of MODELS) {   // try each model in turn; free-tier models are sometimes busy
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body: payload,
    }).catch(() => null);
    if (!r) continue;
    if (r.status === 429 || r.status >= 500) continue;
    if (!r.ok) { console.error('gemini', model, r.status, await r.text()); continue; }
    const data = await r.json();
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
    if (text) return reply({ text }, 200, cors);
  }
  return reply({ error: 'busy', text: 'The assistant is busy right now. Please try again in a minute, or send us a request and a person will reply within one working day.' }, 503, cors);
});
