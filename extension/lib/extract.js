/**
 * Self-contained job-description extractor.
 *
 * This whole function is serialized and injected into the active tab via
 * chrome.scripting.executeScript, so it CANNOT reference anything outside its
 * own body (no imports, no closures over extension code). It returns a plain
 * object that structured-clone can carry back across the boundary.
 */
export async function extractJobPosting() {
  const clean = (s) => (s || "").replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  const textOf = (sel) => {
    const el = document.querySelector(sel);
    return el ? clean(el.innerText) : "";
  };
  const firstText = (sels) => {
    for (const sel of sels) {
      const t = textOf(sel);
      if (t) return t;
    }
    return "";
  };

  // ── Expand truncated descriptions ("Show more" / "See more") ──
  // Many boards hide most of the JD behind a toggle, so the full text isn't in
  // the DOM until it's clicked. Click only safe in-place expanders (buttons, not
  // links/apply CTAs) whose label matches, then let the DOM settle.
  const expandTruncatedSections = async () => {
    const KNOWN = [
      ".show-more-less-html__button--more",         // LinkedIn
      ".jobs-description__footer-button",           // LinkedIn (logged-in)
      "button.feedback-card__expand",
      '[data-testid="expand-job-description-button"]',
    ];
    const LABEL = /^(see|show|read|view)\s+(more|full)|^\.{3}\s*more$|^more$/i;
    let clicked = 0;
    const tryClick = (el) => {
      if (!el || el.dataset.__auraExpanded) return;
      const aria = el.getAttribute("aria-expanded");
      if (aria === "true") return;          // already open
      el.dataset.__auraExpanded = "1";
      try { el.click(); clicked++; } catch { /* ignore */ }
    };
    for (const sel of KNOWN) document.querySelectorAll(sel).forEach(tryClick);
    // Generic: only <button>s with a short matching label (avoids nav/apply links).
    document.querySelectorAll("button").forEach((b) => {
      const label = (b.innerText || b.getAttribute("aria-label") || "").trim();
      if (label.length <= 20 && LABEL.test(label)) tryClick(b);
    });
    if (clicked) await new Promise((r) => setTimeout(r, 450)); // let content render
    return clicked;
  };
  await expandTruncatedSections();

  const host = location.hostname;
  let company = "";
  let title = "";
  let text = "";

  // ── Site-specific extractors (most reliable first) ──
  if (host.includes("linkedin.com")) {
    title = firstText([
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
      ".top-card-layout__title",
      "h1",
    ]);
    company = firstText([
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name",
      ".topcard__org-name-link",
      ".topcard__flavor",
    ]);
    text = firstText([
      "#job-details",
      ".jobs-description__content",
      ".jobs-box__html-content",
      ".description__text",
      ".show-more-less-html__markup",
    ]);
  } else if (host.includes("indeed.")) {
    title = firstText([".jobsearch-JobInfoHeader-title", 'h1[data-testid="jobsearch-JobInfoHeader-title"]', "h1"]);
    company = firstText(['[data-testid="inlineHeader-companyName"]', ".jobsearch-CompanyInfoContainer a", ".jobsearch-InlineCompanyRating div"]);
    text = firstText(["#jobDescriptionText", ".jobsearch-jobDescriptionText"]);
  } else if (host.includes("greenhouse.io") || host.includes("boards.greenhouse")) {
    title = firstText([".app-title", ".job__title h1", "h1"]);
    company = firstText([".company-name", ".header .company"]) || document.title.split(" at ").pop();
    text = firstText(["#content", ".job__description", ".content"]);
  } else if (host.includes("lever.co")) {
    title = firstText([".posting-headline h2", "h2", "h1"]);
    company = firstText([".main-header-logo img"]) || document.title.split(" - ")[0];
    text = firstText([".posting-page .section-wrapper", ".content-wrapper", "[data-qa='job-description']"]);
  } else if (host.includes("ashbyhq.com")) {
    title = firstText(["h1", "._title_"]);
    company = document.title.split(" @ ").pop() || document.title.split(" - ").pop();
    text = firstText(["._description_", "[class*='description']", "main"]);
  } else if (host.includes("workday") || host.includes("myworkdayjobs.com")) {
    title = firstText(['[data-automation-id="jobPostingHeader"]', "h1"]);
    text = firstText(['[data-automation-id="jobPostingDescription"]', "main"]);
  }

  // ── Generic fallbacks ──
  if (!title) title = firstText(['h1', '[class*="job-title"]', '[class*="jobTitle"]']);

  // Always consider a JSON-LD JobPosting — it carries the *full* description, so
  // it can beat a site selector that only matched a truncated snippet.
  let ldText = "";
  for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(node.textContent);
      const arr = Array.isArray(data) ? data : [data];
      for (const d of arr) {
        if (d && (d["@type"] === "JobPosting" || (Array.isArray(d["@type"]) && d["@type"].includes("JobPosting")))) {
          title = title || d.title || "";
          company = company || d.hiringOrganization?.name || "";
          if (d.description) {
            const tmp = document.createElement("div");
            tmp.innerHTML = d.description;
            ldText = clean(tmp.innerText);
          }
        }
      }
    } catch { /* ignore malformed JSON-LD */ }
    if (ldText) break;
  }
  // Keep whichever source gave us more content.
  if (ldText.length > text.length) text = ldText;

  // Still thin? Fall back to selected text, then the largest container.
  if (text.length < 200) {
    const sel = window.getSelection?.().toString();
    if (sel && sel.length > 120) text = clean(sel);
    else {
      const container = firstText(["article", "main", '[role="main"]', "#content", "body"]);
      if (container.length > text.length) text = container;
    }
  }

  // Trim absurdly long pages to keep payloads sane (~20k chars is plenty of JD).
  if (text.length > 20000) text = text.slice(0, 20000) + "\n\n[...truncated]";

  return {
    title: clean(title),
    company: clean(company),
    text,
    url: location.href,
    chars: text.length,
  };
}
