// lib/blogGeneration.js
// ── Blog draft generation pipeline ───────────────────────────────────
// Turns a folder of owner-uploaded photos (or a calendar-driven topic hint
// with no photos yet) into a draft MDX post + PR against ranimahal-marketing.
// Colocated with lib/notifications.js / lib/orders.js since it reuses their
// same KV/fetch/graceful-failure conventions. Called from
// api/cron/blog-draft-check.js (photo-driven) and api/cron/cultural-calendar.js
// (calendar-driven, long-lead-time branch).
//
// Required env vars (none of these exist yet in Vercel — see report):
//   GEMINI_API_KEY        — Google AI Studio key, free tier. Used for BOTH
//                            the vision/captioning call (gemini-2.5-flash,
//                            multimodal) and the text draft-generation call
//                            (same model — no need for two model names).
//                            Free tier is intentional: this pipeline fires
//                            at most ~once every 1-2 weeks, far under the
//                            free-tier RPD/RPM caps, so there is no paid-tier
//                            design here (no billing fallback, no cost caps).
//   GITHUB_TOKEN           — classic or fine-grained PAT scoped to `contents`
//                            + `pull_requests` write on ranimahal-marketing.
//                            Used for raw REST calls (branch/commit/PR), not
//                            octokit, to avoid a new dependency for ~26
//                            requests/year of traffic.
//   BLOB_READ_WRITE_TOKEN  — already provisioned (used elsewhere in this
//                            repo); confirm it's scoped to read the
//                            `blog-inbox/` prefix the marketing-site agent's
//                            upload page writes to. No new token needed if
//                            the existing one covers the whole store, which
//                            is the default Vercel Blob behavior.
//
// Judgment call — restaurant facts grounding: the architecture doc suggests
// fetching src/content/restaurant.ts / menu.ts from the marketing repo at
// runtime. That repo isn't deployed with a stable API for raw source files,
// and cross-repo file fetching at cron-time is an extra network dependency
// for data that changes maybe once a year (address, hours, founding year).
// So RESTAURANT_FACTS below is a small hardcoded mirror of the real values
// (copied from ranimahal-marketing/src/content/restaurant.ts as of this
// writing) instead. Menu data is NOT duplicated — lib/menu.js already is
// this repo's own canonical source, imported directly. Flag for review: if
// restaurant.ts facts drift, this object needs a manual update too.

import { kv } from "@vercel/kv";
import { MENU_ITEMS, SECTIONS } from "./menu.js";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const GITHUB_API = "https://api.github.com";
const GITHUB_OWNER = "cruize69";
const GITHUB_REPO = "ranimahal"; // repo name on GitHub — the local folder is named ranimahal-marketing, the remote is not
const GITHUB_BASE_BRANCH = "main";

// Mirror of ranimahal-marketing/src/content/restaurant.ts — see judgment-call
// note above. Keep in sync manually; this changes rarely.
export const RESTAURANT_FACTS = {
  name: "Rani Mahal",
  tagline: "Fine Indian Cuisine",
  openedYear: 2006,
  description: "Rani Mahal serves refined Indian cuisine in Mamaroneck, NY — traditional recipes, tandoor-fired classics, and a warm dining room inspired by Mughal architecture.",
  phone: "(914) 835-9066",
  address: "327 Mamaroneck Ave, Mamaroneck, NY 10543",
  cuisine: ["Indian", "North Indian", "Tandoori"],
  priceRange: "$$",
  siteUrl: "https://ranimahal.cc",
};

const TOPIC_TAXONOMY = ["dish-spotlight", "cultural-holiday", "local-seo", "behind-the-scenes"];

// "Best of [town]" posts (the local-seo pillar) are structurally similar to
// each other by design — publishing a burst of them in a short window is
// exactly the thin/mail-merge content pattern Google's Helpful Content
// guidance flags, independent of how fast the rest of the pipeline runs.
// This throttle is deliberately separate from overall cadence: dish-spotlight
// posts can fire daily without issue since each covers a genuinely different
// menu item, but local-seo is capped to roughly 2/month regardless.
const LOCAL_SEO_THROTTLE_DAYS = 14;

const BRAND_VOICE_PROMPT = `You are writing on behalf of Rani Mahal, a family-run Indian restaurant in Mamaroneck, NY, open since 2006. Voice: warm, specific, confident without being salesy — like a knowledgeable regular explaining a dish to a friend, not marketing copy. Never invent facts (dish names, prices, hours, ingredients, certifications) beyond what's given in the grounding data below. Prefer concrete, checkable details (a real price, a real spice level, a real address) over generic adjectives.`;

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

async function geminiGenerate({ parts, responseSchema }) {
  const { GEMINI_API_KEY } = process.env;
  if (!GEMINI_API_KEY) { console.warn("GEMINI_API_KEY not set, skipping Gemini call"); return null; }

  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: responseSchema
      ? { responseMimeType: "application/json", responseSchema }
      : undefined,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("Gemini API error:", res.status, await res.text());
      return null;
    }
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) { console.error("Gemini returned no text content:", JSON.stringify(json).slice(0, 500)); return null; }
    if (responseSchema) {
      try { return JSON.parse(text); } catch (e) { console.error("Gemini JSON parse failed:", e, text.slice(0, 300)); return null; }
    }
    return text;
  } catch (e) {
    console.error("Gemini call failed:", e?.message || e);
    return null;
  }
}

// Step 1 — vision/captioning call. Given N photo URLs, asks Gemini to
// relate them to real menu items and produce structured captions + alt
// text. Grounded in RESTAURANT_FACTS + MENU_ITEMS so it can't invent a dish
// name that isn't actually on the menu.
export async function captionPhotos(photoUrls) {
  if (!photoUrls?.length) return null;

  const menuNames = MENU_ITEMS.map(i => i.name).join(", ");
  const promptText = `${BRAND_VOICE_PROMPT}

You are given ${photoUrls.length} photo(s) from Rani Mahal, taken by the owner for a blog post. Real menu item names you may match a photo to (do not invent a dish not in this list — say "unclear" if genuinely uncertain): ${menuNames}.

For each photo, return: dishGuess (a name from the list above, or "unclear"), visualDescription (2-3 sentences, plain factual description of what's visible), altTextCandidate (concise, under 125 chars, for accessibility/SEO).`;

  const imageParts = [];
  for (const url of photoUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) { console.error(`Failed to fetch photo ${url}:`, res.status); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const mimeType = res.headers.get("content-type") || "image/jpeg";
      imageParts.push({ inlineData: { mimeType, data: buf.toString("base64") } });
    } catch (e) {
      console.error(`Failed to download photo ${url}:`, e?.message || e);
    }
  }
  if (!imageParts.length) { console.error("No photos could be downloaded for captioning"); return null; }

  const schema = {
    type: "object",
    properties: {
      photos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dishGuess: { type: "string" },
            visualDescription: { type: "string" },
            altTextCandidate: { type: "string" },
          },
          required: ["dishGuess", "visualDescription", "altTextCandidate"],
        },
      },
    },
    required: ["photos"],
  };

  return await geminiGenerate({ parts: [{ text: promptText }, ...imageParts], responseSchema: schema });
}

// Menu-driven dynamic topic supply. The hand-curated 34-topic research bank
// (research-content-strategy.md) exhausts in about a month at daily cadence
// — the menu itself (100+ real items) is a much deeper, self-refilling well
// and is what this pipeline should lean on once the curated bank runs low.
// Tracks which items have already been covered via a KV set so repeated
// runs progress through the menu instead of reusing the same dish; a full
// pass resets rather than stalling, since a second post about a dish months
// later (a different angle) is fine, but an empty topic supply is not.
async function pickUncoveredMenuItem() {
  try {
    const covered = (await kv.smembers("blog:covered-menu-items")) || [];
    const coveredSet = new Set(covered);
    const next = MENU_ITEMS.find(item => !coveredSet.has(item.name));
    if (next) return next;
    await kv.del("blog:covered-menu-items");
    return MENU_ITEMS[0] || null;
  } catch (e) {
    console.error("pickUncoveredMenuItem failed:", e?.message || e);
    return MENU_ITEMS[0] || null;
  }
}

async function markMenuItemCovered(name) {
  if (!name) return;
  try { await kv.sadd("blog:covered-menu-items", name); } catch (e) { console.error("markMenuItemCovered failed:", e?.message || e); }
}

// Step 2 — topic resolution. Calendar-driven runs already know their topic
// (blogTopic from cultural-calendar.js's EVENTS table) and skip the LLM
// call entirely. Photo-driven runs with a caption get classified into the
// fixed taxonomy; a local-seo classification is throttled (see
// LOCAL_SEO_THROTTLE_DAYS) so "best of town" posts can't burst-publish even
// at high overall pipeline velocity. Anything that falls through (no photos,
// LLM classification unavailable, or a throttled local-seo pick) lands on
// the menu-driven dish-spotlight fallback — the actual supply mechanism
// that scales past the curated topic bank.
export async function resolveTopic({ calendarHint, captionResult }) {
  if (calendarHint) return { pillar: "cultural-holiday", topicSlug: calendarHint };

  let resolved = null;
  if (captionResult?.photos?.length) {
    const summary = captionResult.photos.map(p => `${p.dishGuess}: ${p.visualDescription}`).join("\n");
    const promptText = `Given these photo captions from a restaurant blog post shoot:\n${summary}\n\nClassify the best-fit content angle from exactly this list: ${TOPIC_TAXONOMY.join(", ")}. Return the single best match and a short (3-6 word) topic slug describing the specific angle (e.g. "biryani-spice-guide", "tandoor-behind-scenes").`;
    const schema = {
      type: "object",
      properties: {
        pillar: { type: "string", enum: TOPIC_TAXONOMY },
        topicSlug: { type: "string" },
      },
      required: ["pillar", "topicSlug"],
    };
    resolved = await geminiGenerate({ parts: [{ text: promptText }], responseSchema: schema });
  }

  if (resolved?.pillar === "local-seo") {
    const lastLocalSeo = await kv.get("blog:last-local-seo-published");
    const daysSince = lastLocalSeo ? (Date.now() - Number(lastLocalSeo)) / (24 * 60 * 60 * 1000) : Infinity;
    if (daysSince < LOCAL_SEO_THROTTLE_DAYS) {
      resolved = null; // too soon — fall through to the menu-driven default below
    } else {
      await kv.set("blog:last-local-seo-published", String(Date.now()));
    }
  }

  if (resolved) return resolved;

  const item = await pickUncoveredMenuItem();
  return {
    pillar: "dish-spotlight",
    topicSlug: item ? slugify(item.name) : "general",
    menuItemName: item?.name || null,
  };
}

// Step 3 — draft generation call. Grounded in this repo's own lib/menu.js
// (real item names/prices/spice profiles) plus RESTAURANT_FACTS, the
// resolved topic, and any calendar blurb text. Output is MDX body +
// frontmatter fields as one structured response.
export async function generateDraft({ topic, captionResult, calendarBlurb }) {
  const menuContext = MENU_ITEMS.map(i =>
    `- ${i.name} ($${i.price}${i.veg ? ", veg" : ""}, spice: ${i.spiceProfile})`
  ).join("\n");
  const sectionContext = SECTIONS.map(s => s.title).join(", ");

  const photoContext = captionResult?.photos?.length
    ? captionResult.photos.map((p, i) => `Photo ${i + 1}: ${p.dishGuess} — ${p.visualDescription}`).join("\n")
    : "No photos available for this draft — write for a post that will use existing gallery photography, do not describe a specific photo.";

  const promptText = `${BRAND_VOICE_PROMPT}

Restaurant facts (ground truth — do not contradict): ${JSON.stringify(RESTAURANT_FACTS)}
Menu sections: ${sectionContext}
Real menu items (only reference dishes from this list, with correct prices/spice info):
${menuContext}

Topic angle: ${topic.pillar} — ${topic.topicSlug}${topic.menuItemName ? ` (write specifically about "${topic.menuItemName}" from the menu list above)` : ""}
${calendarBlurb ? `Calendar context: ${calendarBlurb}` : ""}
Photo captions:
${photoContext}

Write one blog post as MDX body content (markdown with occasional JSX-safe formatting, no imports/components) plus frontmatter fields. Return: title (SEO-friendly, under 60 chars), description (meta description, under 155 chars), slug (kebab-case, no dates), tags (array of 3-6 lowercase strings), body (the full MDX post body, 500-900 words, do not repeat the title as an H1 inside the body).`;

  const schema = {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      slug: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      body: { type: "string" },
    },
    required: ["title", "description", "slug", "tags", "body"],
  };

  return await geminiGenerate({ parts: [{ text: promptText }], responseSchema: schema });
}

// Step 4 — deterministic frontmatter + MDX assembly. No LLM call — plain
// templating, avoiding the "LLM invented a fact in the schema" risk per the
// architecture doc. altText comes straight from the captioning step.
export function assembleMdx({ draft, captionResult, heroImageUrl }) {
  const slug = slugify(draft.slug || draft.title);
  const dateIso = new Date().toISOString().slice(0, 10);
  const heroImage = heroImageUrl || null;
  const altText = captionResult?.photos?.[0]?.altTextCandidate || draft.title;

  const frontmatter = [
    "---",
    `title: ${JSON.stringify(draft.title)}`,
    `description: ${JSON.stringify(draft.description)}`,
    `date: ${JSON.stringify(dateIso)}`,
    heroImage ? `heroImage: ${JSON.stringify(heroImage)}` : null,
    heroImage ? `heroImageAlt: ${JSON.stringify(altText)}` : null,
    `tags: [${(draft.tags || []).map(t => JSON.stringify(t)).join(", ")}]`,
    "---",
  ].filter(Boolean).join("\n");

  const mdx = `${frontmatter}\n\n${draft.body}\n`;
  return { slug, mdx, dateIso };
}

// ── GitHub PR creation ────────────────────────────────────────────────
// Raw REST calls rather than octokit — this fires at most a couple times a
// month, not worth a new dependency for the "create a commit + branch + PR"
// flow, which is five calls: get base ref -> get base tree/commit -> create
// blob -> create commit -> create/update ref -> open PR. Every step is
// wrapped so a mid-flow failure logs and returns null rather than throwing,
// matching lib/push.js's fail-soft convention — this must never crash the
// cron run that called it.
async function ghRequest(path, options = {}) {
  const { GITHUB_TOKEN } = process.env;
  if (!GITHUB_TOKEN) { console.warn("GITHUB_TOKEN not set, skipping GitHub PR creation"); return null; }
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    console.error(`GitHub API ${path} failed:`, res.status, await res.text());
    return null;
  }
  return await res.json();
}

export async function openBlogDraftPr({ slug, mdx, title, summary }) {
  try {
    const { GITHUB_TOKEN } = process.env;
    if (!GITHUB_TOKEN) return null;

    const branch = `blog-draft/${slug}-${Date.now()}`;
    const filePath = `src/content/blog/drafts/${slug}.mdx`;

    const baseRef = await ghRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${GITHUB_BASE_BRANCH}`);
    if (!baseRef) return null;
    const baseSha = baseRef.object.sha;

    const createdRef = await ghRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
    });
    if (!createdRef) return null;

    const putFile = await ghRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `blog: draft — ${title}`,
        content: Buffer.from(mdx, "utf-8").toString("base64"),
        branch,
      }),
    });
    if (!putFile) return null;

    const prBody = `## Auto-generated blog draft\n\n${summary}\n\n**File:** \`${filePath}\`\n\n---\nGenerated by the ranimahal-backend blog pipeline (Gemini ${GEMINI_MODEL}). Please review for factual accuracy (dish names, spice levels, prices) against the live menu before merging — see the reviewer checklist in the architecture doc. Vercel will build a preview deployment for this PR automatically.`;

    const pr = await ghRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: `blog: draft — ${title}`,
        head: branch,
        base: GITHUB_BASE_BRANCH,
        body: prBody,
      }),
    });
    if (!pr) return null;

    return { url: pr.html_url, number: pr.number, branch };
  } catch (e) {
    console.error("openBlogDraftPr failed:", e?.message || e);
    return null;
  }
}

// ── Top-level pipeline entry point ────────────────────────────────────
// photoUrls: array of Blob URLs (may be empty for a calendar-driven,
// photo-less run — falls back to no hero image, matching the architecture
// doc's "falls back to existing gallery photos" note; actually attaching a
// gallery photo would require reading ranimahal-marketing's gallery.ts,
// which this pipeline doesn't have access to, so a photo-less draft simply
// omits heroImage and leaves a TODO in the PR body for the reviewer).
export async function runBlogGenerationPipeline({ photoUrls = [], calendarHint = null, calendarBlurb = null, sourceLabel = "unknown" }) {
  try {
    const captionResult = photoUrls.length ? await captionPhotos(photoUrls) : null;
    const topic = await resolveTopic({ calendarHint, captionResult });
    const draft = await generateDraft({ topic, captionResult, calendarBlurb });
    if (!draft) { console.error(`Blog pipeline (${sourceLabel}): draft generation returned nothing, aborting`); return null; }

    if (topic.pillar === "dish-spotlight" && topic.menuItemName) {
      await markMenuItemCovered(topic.menuItemName);
    }

    const { slug, mdx } = assembleMdx({ draft, captionResult, heroImageUrl: photoUrls[0] || null });

    const summary = photoUrls.length
      ? `Photo-driven draft from ${photoUrls.length} photo(s). Topic: ${topic.pillar} / ${topic.topicSlug}. Verify the dish name(s) match what's actually in the photos before merging.`
      : `Calendar-driven draft (no photos yet — needs a hero image before merge, either from a fresh shoot or existing gallery photography). Topic: ${topic.pillar} / ${topic.topicSlug}.`;

    const pr = await openBlogDraftPr({ slug, mdx, title: draft.title, summary });
    if (!pr) { console.error(`Blog pipeline (${sourceLabel}): PR creation failed or skipped (GITHUB_TOKEN missing?)`); return null; }

    return { slug, title: draft.title, prUrl: pr.url, prNumber: pr.number };
  } catch (e) {
    console.error(`Blog generation pipeline failed (${sourceLabel}):`, e?.message || e);
    return null;
  }
}
