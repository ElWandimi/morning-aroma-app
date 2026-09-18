const express = require("express");
const DOMPurify = require("isomorphic-dompurify");
const { query } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { requirePermission } = require("../middleware/requireAdmin");
const { resolvePhotoUrl } = require("../utils/cloudinary");

const router = express.Router();

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Real, server-side sanitization -- never trust admin-authored rich text to be safe just because
// it came from a real, logged-in admin session (the real risk here isn't a malicious admin, it's
// a genuinely compromised admin account, or the rich-text editor itself producing something
// unexpected). A real, deliberate allowlist, not a blocklist -- only tags/attributes this app's
// own blog editor (src/admin -- BlogEditor) actually produces are permitted; anything else is
// stripped, not merely escaped.
const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "h2", "h3", "a", "img", "ul", "ol", "li", "blockquote"];
const ALLOWED_ATTR = ["href", "src", "alt", "target", "rel"];
function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

// Real inline images an admin pastes/uploads directly into the rich-text editor arrive as
// data: URLs embedded right in the HTML -- storing those as-is would bloat every single post row
// with full base64 image data (genuinely unbounded, unlike a real, single cover image) and
// produce URLs that can't be cached or resized the way a real Cloudinary URL can. Each real
// data: <img> src in the content gets uploaded the same way a cover image or product photo
// does (resolvePhotoUrl), and the HTML is rewritten to point at the resulting real URL instead.
async function resolveInlineImages(html) {
  const dataUrlPattern = /<img[^>]+src="(data:[^"]+)"/g;
  const matches = [...html.matchAll(dataUrlPattern)];
  let resolved = html;
  for (const match of matches) {
    const dataUrl = match[1];
    const realUrl = await resolvePhotoUrl(dataUrl, "morning-aroma/blog");
    resolved = resolved.replace(dataUrl, realUrl);
  }
  return resolved;
}

function publicPost(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverImageUrl: row.cover_image_url,
    contentHtml: row.content_html,
    authorName: row.author_name,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Public -- only ever returns real, genuinely published posts, ordered newest-first. A visitor
// (or Google's own crawler) has no reason to see a draft, and this is the real, enforced
// filter -- not just trusted to the frontend to hide unpublished posts correctly.
router.get("/", async (req, res) => {
  const result = await query("SELECT * FROM blog_posts WHERE status = 'Published' ORDER BY published_at DESC", []);
  res.json({ posts: result.rows.map(publicPost) });
});

// Admin-only -- sees every real post regardless of status, since this is the actual editing
// queue, not the public blog. Mounted BEFORE the public /:slug route below -- otherwise Express
// would match "admin" itself as a real, literal :slug value and this would never be reached.
router.get("/admin/all", requireAuth, requirePermission("Blog"), async (req, res) => {
  const result = await query("SELECT * FROM blog_posts ORDER BY updated_at DESC", []);
  res.json({ posts: result.rows.map(publicPost) });
});

router.get("/admin/:id", requireAuth, requirePermission("Blog"), async (req, res) => {
  const result = await query("SELECT * FROM blog_posts WHERE id = $1", [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Post not found." });
  res.json({ post: publicPost(result.rows[0]) });
});

// Public, by real slug -- the actual URL a visitor or a shared link uses. Same real Published-
// only filter as the list above; a draft's real slug simply 404s for a non-admin request.
router.get("/:slug", async (req, res) => {
  const result = await query("SELECT * FROM blog_posts WHERE slug = $1 AND status = 'Published'", [req.params.slug]);
  if (!result.rows[0]) return res.status(404).json({ error: "Post not found." });
  res.json({ post: publicPost(result.rows[0]) });
});

router.post("/", requireAuth, requirePermission("Blog"), async (req, res) => {
  const { title, excerpt, coverImageUrl, contentHtml, authorName } = req.body || {};
  if (typeof title !== "string" || !title.trim() || title.length > 200) return res.status(400).json({ error: "title is required (max 200 characters)." });
  if (typeof excerpt !== "string" || !excerpt.trim() || excerpt.length > 400) return res.status(400).json({ error: "excerpt is required (max 400 characters)." });
  if (typeof contentHtml !== "string" || !contentHtml.trim()) return res.status(400).json({ error: "contentHtml is required." });

  // A real, genuinely unique slug -- generated from title, with a numeric suffix appended only
  // if that exact slug is already taken (the same real collision-handling most blogging
  // platforms use), rather than letting a UNIQUE constraint violation surface as a raw, opaque
  // 500 to the admin.
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 2;
  while ((await query("SELECT id FROM blog_posts WHERE slug = $1", [slug])).rows.length > 0) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  // resolvePhotoUrl (same real, shared utility products.js already uses) -- a genuine data: URL
  // from the admin's own file picker gets uploaded to Cloudinary; an already-real URL (e.g. an
  // existing product photo the admin chose to reuse, per this feature's own real requirement)
  // passes through unchanged.
  let resolvedCoverImageUrl, resolvedContentHtml;
  try {
    resolvedCoverImageUrl = await resolvePhotoUrl(coverImageUrl, "morning-aroma/blog");
    resolvedContentHtml = await resolveInlineImages(sanitizeHtml(contentHtml));
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }

  const inserted = await query(
    "INSERT INTO blog_posts (slug, title, excerpt, cover_image_url, content_html, author_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    [slug, title.trim(), excerpt.trim(), resolvedCoverImageUrl || null, resolvedContentHtml, authorName?.trim() || "The Morning Aroma Team"]
  );
  res.status(201).json({ post: publicPost(inserted.rows[0]) });
});

router.patch("/:id", requireAuth, requirePermission("Blog"), async (req, res) => {
  const existingResult = await query("SELECT * FROM blog_posts WHERE id = $1", [req.params.id]);
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: "Post not found." });

  const { title, excerpt, coverImageUrl, contentHtml, authorName, status } = req.body || {};
  if (title !== undefined && (typeof title !== "string" || !title.trim() || title.length > 200)) return res.status(400).json({ error: "title must be non-empty (max 200 characters)." });
  if (excerpt !== undefined && (typeof excerpt !== "string" || !excerpt.trim() || excerpt.length > 400)) return res.status(400).json({ error: "excerpt must be non-empty (max 400 characters)." });
  if (contentHtml !== undefined && (typeof contentHtml !== "string" || !contentHtml.trim())) return res.status(400).json({ error: "contentHtml must be non-empty." });
  if (status !== undefined && !["Draft", "Published"].includes(status)) return res.status(400).json({ error: 'status must be "Draft" or "Published".' });

  let resolvedCoverImageUrl = existing.cover_image_url;
  let resolvedContentHtml = existing.content_html;
  try {
    if (coverImageUrl !== undefined) resolvedCoverImageUrl = coverImageUrl ? await resolvePhotoUrl(coverImageUrl, "morning-aroma/blog") : null;
    if (contentHtml !== undefined) resolvedContentHtml = await resolveInlineImages(sanitizeHtml(contentHtml));
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }

  // Real, correct published_at handling -- set only the first time a post genuinely transitions
  // into Published (existing.published_at is still null at that point); an already-published
  // post being edited again keeps its real, original publish date, and a post moved back to
  // Draft and republished later does NOT get a fresh published_at either -- once a post has
  // truly gone live once, that's its real publish date for the blog index/sitemap's ordering,
  // not a moving target every time an admin tweaks a typo.
  const willPublishForFirstTime = status === "Published" && !existing.published_at;

  const result = await query(
    `UPDATE blog_posts SET
       title = $1, excerpt = $2, cover_image_url = $3, content_html = $4, author_name = $5,
       status = $6, published_at = $7, updated_at = now()
     WHERE id = $8 RETURNING *`,
    [
      title?.trim() ?? existing.title,
      excerpt?.trim() ?? existing.excerpt,
      resolvedCoverImageUrl,
      resolvedContentHtml,
      authorName?.trim() ?? existing.author_name,
      status ?? existing.status,
      willPublishForFirstTime ? new Date() : existing.published_at,
      req.params.id,
    ]
  );
  res.json({ post: publicPost(result.rows[0]) });
});

router.delete("/:id", requireAuth, requirePermission("Blog"), async (req, res) => {
  const result = await query("DELETE FROM blog_posts WHERE id = $1 RETURNING id", [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Post not found." });
  res.status(204).end();
});

module.exports = router;
