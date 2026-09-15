// Real, confirmed failure mode every real submission across this suite can hit: total genuine
// /register and /login volume in one run can exceed the real production rate limit (20 requests
// per 15 minutes per IP, server/src/routes/auth.js's authLimiter) even with playwright.config.js's
// own workers: 1 (one test at a time) -- confirmed directly, a real run hit "Too many attempts.
// Try again in a few minutes." Originally written inline in shopping.spec.js, where it was first
// proven against a real failure; extracted here once other files needed the identical protection,
// rather than duplicating it (the same lesson this suite already learned the hard way from
// getAdminToken being copy-pasted stale across three files at once -- see git history).
//
// Blindly retrying immediately (what a bare Playwright retry or a short setTimeout loop would do)
// makes this WORSE, not better -- each retry is itself another real request counted against the
// same window. The only real, correct response to a genuine rate limit is to actually wait it out.
//
// dialogLocator's submit button is clicked, then races two real outcomes: successLocator reaching
// successState (the real, intended result -- "visible" for a heading/element that should appear,
// "hidden" for a dialog that should close itself), or the rate-limit paragraph appearing. If it's
// the latter, waits 90s (a real, meaningful fraction of the 15-minute window -- long enough that a
// few of these across a run still fit inside it, short enough not to blow up total suite time if
// it only happens once) and submits again, up to maxAttempts times.
export async function submitWithRateLimitBackoff(page, dialogLocator, successLocator, successState = "visible", maxAttempts = 3) {
  // .first() -- confirmed directly in a real failure this guards against: the rate-limit message
  // genuinely renders twice in the DOM at once (the password-mode error slot and a second, shared
  // error area near the Google button both show it), which would otherwise make this a strict-
  // mode violation the moment its visibility is checked, rather than a clean match.
  const rateLimitMessage = dialogLocator.getByText("Too many attempts. Try again in a few minutes.").first();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await dialogLocator.locator('button[type="submit"]').click();
    const outcome = await Promise.race([
      successLocator.waitFor({ state: successState, timeout: 25000 }).then(() => "success"),
      rateLimitMessage.waitFor({ state: "visible", timeout: 25000 }).then(() => "rate-limited"),
    ]).catch(() => "timeout");
    if (outcome === "success") return;
    if (outcome === "rate-limited") {
      if (attempt === maxAttempts) throw new Error(`submitWithRateLimitBackoff: still rate-limited after ${maxAttempts} attempts (waited 90s between each) -- the real production limit genuinely isn't clearing within this test's own patience budget.`);
      await page.waitForTimeout(90000);
      continue;
    }
    // Neither outcome appeared within 25s and it wasn't the rate limit -- a real, different
    // problem (the request genuinely failed some other way, or is unusually slow), not something
    // this backoff logic exists to paper over. Surfaces as a real, normal Playwright timeout
    // rather than silently retrying something that isn't actually the rate limit.
    throw new Error("submitWithRateLimitBackoff: neither success nor the rate-limit message appeared within 25s.");
  }
}
