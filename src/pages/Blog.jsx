import React from "react";
import { ImgWithSkeleton, ShareButtons } from "../components";
import { useAdmin, useRoute, pathFor } from "../context";
import { useStructuredData } from "../hooks";

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function BlogIndexPage() {
  const { go } = useRoute();
  const { blogPosts, blogPostsLoading } = useAdmin();

  useStructuredData({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${window.location.origin}/` },
      { "@type": "ListItem", position: 2, name: "Journal", item: `${window.location.origin}${pathFor("blog")}` },
    ],
  });

  return (
    <div className="shop-page">
      <div className="shop-head">
        <p className="eyebrow">the journal</p>
        <h1>Stories from the roastery</h1>
        <p className="shop-sub">Real, ongoing notes on sourcing, brewing, and the people behind every bag.</p>
      </div>

      {blogPostsLoading ? (
        <p className="hint">Loading…</p>
      ) : blogPosts.length === 0 ? (
        <p className="hint">Nothing published yet — check back soon.</p>
      ) : (
        <div className="grid4">
          {blogPosts.map((post) => (
            <div
              key={post.id}
              className="everyday-card"
              onClick={() => go("blogpost", { id: post.slug })}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go("blogpost", { id: post.slug }); } }}
              style={{ cursor: "pointer" }}
            >
              {post.coverImageUrl && (
                <ImgWithSkeleton src={post.coverImageUrl} alt={post.title} wrapClassName="blog-card-photo-wrap" className="blog-card-photo" loading="lazy" />
              )}
              <p className="eyebrow" style={{ marginTop: post.coverImageUrl ? 12 : 0 }}>{fmtDate(post.publishedAt)}</p>
              <h3>{post.title}</h3>
              <p>{post.excerpt}</p>
              <span className="moment-cta">Read more →</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BlogPostPage({ id }) {
  const { go } = useRoute();
  const { blogPosts, blogPostsLoading } = useAdmin();
  const post = blogPosts.find((p) => p.slug === id);

  useStructuredData(
    post
      ? {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.excerpt,
          image: post.coverImageUrl || undefined,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          author: { "@type": "Organization", name: post.authorName },
          publisher: { "@type": "Organization", name: "Morning Aroma" },
          mainEntityOfPage: `${window.location.origin}${pathFor("blogpost", { id: post.slug })}`,
        }
      : null
  );

  if (blogPostsLoading) return <div className="shop-page"><p className="hint">Loading…</p></div>;

  if (!post) {
    return (
      <div className="shop-page">
        <div className="shop-head">
          <h1>Post not found</h1>
          <p className="shop-sub">This story may have been moved or unpublished.</p>
        </div>
        <button className="btn-outline" onClick={() => go("blog")}>← Back to the journal</button>
      </div>
    );
  }

  return (
    <div className="shop-page blog-post-page">
      <button className="link-btn" style={{ marginLeft: 0, marginBottom: 20 }} onClick={() => go("blog")}>← Back to the journal</button>
      <div className="shop-head" style={{ textAlign: "left" }}>
        <p className="eyebrow">{fmtDate(post.publishedAt)} · {post.authorName}</p>
        <h1>{post.title}</h1>
      </div>
      {post.coverImageUrl && (
        <ImgWithSkeleton src={post.coverImageUrl} alt={post.title} wrapClassName="blog-post-cover-wrap" className="blog-post-cover" />
      )}
      <div className="blog-post-body" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--gold)" }}>
        <ShareButtons path={pathFor("blogpost", { id: post.slug })} text={post.title} label="Share this story" />
      </div>
    </div>
  );
}
