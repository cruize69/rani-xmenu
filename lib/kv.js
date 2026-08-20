// lib/kv.js
// Single shared Redis client for the whole app — replaces @vercel/kv.
//
// @vercel/kv was deprecated by Vercel in December 2024: every existing KV
// store was migrated to real Upstash Redis, and Vercel's own guidance
// since is to use @upstash/redis directly rather than the old wrapper
// package. This isn't a behavior change — @vercel/kv's own source (read
// directly from node_modules before this migration) shows its `kv` export
// was already nothing but `new Redis({ url: KV_REST_API_URL, token:
// KV_REST_API_TOKEN })` from this exact same @upstash/redis package,
// wrapped in a lazy-init proxy. This file reconstructs that same client
// explicitly, reusing the exact same env vars already configured in
// Vercel — no new environment variables needed.
import { Redis } from "@upstash/redis";

export const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});
