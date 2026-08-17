// api/cron/blog-draft-check.js
// Vercel Cron target — runs once daily. Checks Vercel Blob for new
// `blog-inbox/<date>/` folders the owner has dragged photos into (via the
// upload page the marketing-site agent is building), and for any folder not
// yet processed (KV dedup `blog:inbox-processed:<folder>`), runs the
// generation pipeline in lib/blogGeneration.js and opens a draft PR.
//
// One folder = one post's asset set, matching the architecture doc. Uses
// Blob's list() with a prefix, not a maintained index — this only needs to
// run once daily over what's realistically a handful of folders a month.

import { list } from "@vercel/blob";
import { kv } from "@vercel/kv";
import { runBlogGenerationPipeline } from "../../lib/blogGeneration.js";
import { recordCronRun } from "../../lib/cronStatus.js";
import { isCronSecretValid } from "../../lib/auth.js";

const INBOX_PREFIX = "blog-inbox/";
// Safety-net TTL on the dedup flag — long enough that a folder is never
// reprocessed in practice, short enough not to grow the KV keyspace forever.
const DEDUP_TTL_SEC = 2 * 365 * 24 * 60 * 60;

// Groups flat blob pathnames (blog-inbox/<folder>/<file>.jpg) into
// { folder: [urls] }, skipping anything not at least two segments deep.
function groupByFolder(blobs) {
  const folders = new Map();
  for (const blob of blobs) {
    const rest = blob.pathname.slice(INBOX_PREFIX.length);
    const slashIdx = rest.indexOf("/");
    if (slashIdx <= 0) continue;
    const folder = rest.slice(0, slashIdx);
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder).push(blob.url);
  }
  return folders;
}

export default async function handler(req, res) {
  if (!isCronSecretValid(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { BLOB_READ_WRITE_TOKEN } = process.env;
    if (!BLOB_READ_WRITE_TOKEN) {
      console.warn("BLOB_READ_WRITE_TOKEN not set, skipping blog-draft-check");
      await recordCronRun("blog-draft-check", { skipped: true, reason: "no blob token" });
      return res.status(200).json({ ok: true, skipped: true });
    }

    const { blobs } = await list({ prefix: INBOX_PREFIX, token: BLOB_READ_WRITE_TOKEN });
    const folders = groupByFolder(blobs);

    let processed = 0, skipped = 0, failed = 0;
    const results = [];

    for (const [folder, photoUrls] of folders) {
      try {
        const dedupKey = `blog:inbox-processed:${folder}`;
        if (await kv.get(dedupKey)) { skipped++; continue; }
        if (!photoUrls.length) { skipped++; continue; }

        const outcome = await runBlogGenerationPipeline({
          photoUrls,
          sourceLabel: `blog-inbox/${folder}`,
        });

        // Mark processed regardless of outcome — a permanently-broken folder
        // (e.g. an LLM call that keeps failing) shouldn't retry every day
        // forever and keep burning free-tier quota. Owner can clear the
        // dedup key manually to force a retry if it was transient.
        await kv.set(dedupKey, JSON.stringify({ processedAt: new Date().toISOString(), outcome }), { ex: DEDUP_TTL_SEC });

        if (outcome) { processed++; results.push({ folder, ...outcome }); }
        else { failed++; results.push({ folder, failed: true }); }
      } catch (e) {
        console.error(`blog-draft-check failed for folder ${folder}:`, e);
        failed++;
      }
    }

    const result = { foldersFound: folders.size, processed, skipped, failed, results };
    await recordCronRun("blog-draft-check", result);
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("blog-draft-check cron failed:", e);
    return res.status(500).json({ error: "Cron failed" });
  }
}
