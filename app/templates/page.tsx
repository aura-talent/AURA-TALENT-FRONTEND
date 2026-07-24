"use client";

import { useEffect, useState, useRef } from "react";
import {
  Search, Star, Sparkles, Download, Copy, Check,
  FileText, Sliders, FileDown, FolderArchive, X, Plus,
  Loader2, ChevronRight
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import JSZip from "jszip";

interface Template {
  id: string;
  category: string;
  purpose: string;
  recommended_case: string;
  tone_options: string[];
  placeholders: string[];
  subject_template: string;
  body_template: string;
  role: string;
}

export default function CandidateTemplatesHub() {
  const { user } = useAuth();

  // Library state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [popularTemplates, setPopularTemplates] = useState<string[]>([]);
  const [showOnlyPopular, setShowOnlyPopular] = useState(false);
  const [loading, setLoading] = useState(true);

  // Editor (modal) state
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [tone, setTone] = useState("Professional");
  const [length, setLength] = useState("Medium");
  const [language, setLanguage] = useState("English");
  const [customPrompt, setCustomPrompt] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [isPopulating, setIsPopulating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"none" | "plain" | "markdown">("none");

  // "Your List" — items queued for batch download, shown via bottom bar + drawer
  const [savedList, setSavedList] = useState<string[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // 1. Load templates, favorites, popularity
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const items = await api.listTemplates("candidate");
        setTemplates(items);

        if (user?.id) {
          const favRes = await api.getFavorites();
          if (favRes.favorites) {
            setFavorites(favRes.favorites);
          } else {
            const localFavs = localStorage.getItem(`aura_favs_${user.id}`);
            if (localFavs) setFavorites(JSON.parse(localFavs));
          }
        }

        const popRes = await api.getPopularTemplates();
        setPopularTemplates(popRes);
      } catch (err) {
        console.error("Failed to load templates metadata:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  // Sync editor fields whenever a template is opened
  useEffect(() => {
    if (selectedTemplate) {
      const initVals: Record<string, string> = {};
      selectedTemplate.placeholders.forEach(p => {
        initVals[p] = "";
      });

      const candidateNamePlaceholder = selectedTemplate.placeholders.find(p =>
        p.toLowerCase().includes("candidate") || p.toLowerCase() === "name"
      );
      if (candidateNamePlaceholder && user) {
        initVals[candidateNamePlaceholder] = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "";
      }

      setPlaceholderValues(initVals);
      setTone(selectedTemplate.tone_options[0] || "Professional");
      setLength("Medium");
      setLanguage("English");
      setCustomPrompt("");
      setSubject(selectedTemplate.subject_template);
      setBody(selectedTemplate.body_template);

      api.trackUsage(selectedTemplate.id).catch(() => { });
    }
  }, [selectedTemplate, user]);

  // Close modal / drawer on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedTemplate) setSelectedTemplate(null);
      else if (isDrawerOpen) setIsDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedTemplate, isDrawerOpen]);

  // `values` is optional — pass it explicitly when calling right after a
  // setState so the function doesn't read stale state from its closure.
  const getLocallyPopulatedDraft = (
    subjTemplate: string,
    bodyTemplate: string,
    values: Record<string, string> = placeholderValues,
  ) => {
    let s = subjTemplate;
    let b = bodyTemplate;
    Object.entries(values).forEach(([placeholder, val]) => {
      const displayVal = val || `[${placeholder}]`;
      s = s.replaceAll(`[${placeholder}]`, displayVal);
      b = b.replaceAll(`[${placeholder}]`, displayVal);
    });
    return { subject: s, body: b };
  };

  const handleToggleFavorite = async (templateId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const isFav = favorites.includes(templateId);
    const updated = isFav ? favorites.filter(id => id !== templateId) : [...favorites, templateId];
    setFavorites(updated);

    if (user?.id) {
      localStorage.setItem(`aura_favs_${user.id}`, JSON.stringify(updated));
      try {
        await api.toggleFavorite(templateId, !isFav);
      } catch (err) {
        console.warn("Could not sync favorite to Supabase:", err);
      }
    }
  };

  const handleAutoPopulate = async () => {
    if (!selectedTemplate || !user) return;
    try {
      setIsPopulating(true);
      const res = await api.populatePlaceholders({
        placeholders: selectedTemplate.placeholders,
        role: "candidate",
        candidate_user_id: user.id
      });

      if (res.populated) {
        const newVals = { ...placeholderValues };
        Object.entries(res.populated).forEach(([p, val]) => {
          const matchedKey = selectedTemplate.placeholders.find(pk =>
            pk === p || `[${pk}]` === p || pk.toLowerCase() === p.toLowerCase()
          );
          if (matchedKey) newVals[matchedKey] = val;
        });
        setPlaceholderValues(newVals);

        const { subject: s, body: b } = getLocallyPopulatedDraft(
          selectedTemplate.subject_template,
          selectedTemplate.body_template
        );
        setSubject(s);
        setBody(b);
      }
    } catch (err) {
      console.error("Auto populate placeholders failed:", err);
      alert("Failed to auto-populate from profile. Please verify your resume is uploaded.");
    } finally {
      setIsPopulating(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!selectedTemplate) return;
    try {
      setIsGenerating(true);
      const payloadPlaceholders: Record<string, string> = { ...placeholderValues };

      const res = await api.generateTemplate({
        prompt: customPrompt || `Generate a draft for ${selectedTemplate.purpose}.`,
        template_id: selectedTemplate.id,
        role: "candidate",
        tone,
        length,
        language,
        placeholders: payloadPlaceholders
      });

      if (res.subject && res.body) {
        setSubject(res.subject);
        setBody(res.body);
      }
    } catch (err) {
      console.error("AI Generation failed:", err);
      alert("AI generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (format: "plain" | "markdown") => {
    const textToCopy = format === "plain"
      ? `Subject: ${subject}\n\n${body}`
      : `### Subject: ${subject}\n\n${body}`;

    navigator.clipboard.writeText(textToCopy);
    setCopyStatus(format);
    setTimeout(() => setCopyStatus("none"), 1500);
  };

  const handleDownloadPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${subject}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 3rem; color: #1e293b; line-height: 1.6; max-width: 800px; margin: 0 auto; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 1.5rem; margin-bottom: 2rem; }
            .label { font-weight: 600; color: #64748b; font-size: 0.875rem; text-transform: uppercase; margin-bottom: 0.25rem; }
            .subject { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-bottom: 1rem; }
            .body { white-space: pre-wrap; font-size: 1rem; color: #334155; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="label">Subject</div>
            <div class="subject">${subject}</div>
          </div>
          <div class="body">${body}</div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadDOCX = () => {
    const formattedSubject = subject.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    const formattedBody = body.replaceAll("\n", "<br/>").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("&lt;br/&gt;", "<br/>");

    const content = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <title>${subject}</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
            </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            body { font-family: 'Calibri', 'Arial', sans-serif; padding: 20px; line-height: 1.5; color: #000; }
            h2 { font-family: 'Calibri Light', sans-serif; color: #1f4e78; border-bottom: 1px solid #d0d0d0; padding-bottom: 6px; }
            p { margin-bottom: 12px; }
          </style>
        </head>
        <body>
          <h2>Subject: ${formattedSubject}</h2>
          <p>${formattedBody}</p>
        </body>
      </html>
    `;
    const blob = new Blob([content], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${subject.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadZIP = async () => {
    if (savedList.length === 0) return;
    try {
      const zip = new JSZip();

      for (const id of savedList) {
        const item = templates.find(t => t.id === id);
        if (!item) continue;

        let itemSubj = item.subject_template;
        let itemBody = item.body_template;

        item.placeholders.forEach(p => {
          const localVal = placeholderValues[p] || (user ? (user.user_metadata?.full_name || user.email?.split("@")[0]) : "") || `[${p}]`;
          itemSubj = itemSubj.replaceAll(`[${p}]`, localVal);
          itemBody = itemBody.replaceAll(`[${p}]`, localVal);
        });

        const fileContent = `Subject: ${itemSubj}\n\n${itemBody}`;
        zip.file(`${item.id}_template.txt`, fileContent);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aura_communication_templates_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("ZIP Generation failed:", err);
      alert("Failed to compile ZIP archive.");
    }
  };

  const categories = ["All", ...Array.from(new Set(templates.map(t => t.category)))];

  const filteredTemplates = templates.filter(t => {
    const matchesSearch =
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject_template.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.body_template.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === "All" || t.category === selectedCategory;
    const matchesFavorite = !showOnlyFavorites || favorites.includes(t.id);
    const matchesPopular = !showOnlyPopular || popularTemplates.includes(t.id);

    return matchesSearch && matchesCategory && matchesFavorite && matchesPopular;
  });

  const handleToggleSaved = (templateId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSavedList(prev =>
      prev.includes(templateId) ? prev.filter(id => id !== templateId) : [...prev, templateId]
    );
  };

  return (
    <div className="container" style={{ padding: "2rem 1rem 6rem", minHeight: "90vh" }}>
      {/* Title Header */}
      <div className="dashboard-head" style={{ marginBottom: "1.5rem" }}>
        <div>
          <p className="eyebrow">AURA ASSISTANT</p>
          <h1 className="gradient-text">Communication Templates Library</h1>
          <p className="text-gray-500">Draft, personalize, and refine professional messages using AI grounding.</p>
        </div>
      </div>

      {/* Horizontal filter bar: search + categories + toggles, all in one row */}
      <div
        className="panel"
        style={{
          padding: "0.75rem 1rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.5rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 220 }}>
          <Search size={17} className="text-gray-500" />
          <input
            type="text"
            placeholder="Search library..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: "transparent", border: "none", color: "var(--ink)", width: "100%", outline: "none", fontSize: "0.88rem" }}
          />
        </div>

        <div style={{ width: 1, alignSelf: "stretch", background: "var(--ink-06)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", flexGrow: 1 }}>
          {categories.map(cat => (
            <button
              key={cat}
              className="btn btn-xs"
              style={{
                fontSize: "0.78rem",
                padding: "0.35rem 0.75rem",
                borderRadius: 999,
                fontWeight: selectedCategory === cat ? 600 : 400,
                color: selectedCategory === cat ? "#fff" : "var(--ink)",
                background: selectedCategory === cat ? "var(--iris)" : "var(--ink-06)",
                border: "none"
              }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginLeft: "auto" }}>
          <button
            className="btn btn-xs"
            style={{
              fontSize: "0.78rem", padding: "0.35rem 0.7rem", borderRadius: 999, gap: "0.3rem",
              display: "flex", alignItems: "center",
              color: showOnlyFavorites ? "#fff" : "var(--ink)",
              background: showOnlyFavorites ? "var(--iris)" : "var(--ink-06)", border: "none"
            }}
            onClick={() => { setShowOnlyFavorites(v => !v); setShowOnlyPopular(false); }}
          >
            <Star size={13} fill={showOnlyFavorites ? "currentColor" : "none"} /> Favorites
          </button>
          <button
            className="btn btn-xs"
            style={{
              fontSize: "0.78rem", padding: "0.35rem 0.7rem", borderRadius: 999, gap: "0.3rem",
              display: "flex", alignItems: "center",
              color: showOnlyPopular ? "#fff" : "var(--ink)",
              background: showOnlyPopular ? "var(--iris)" : "var(--ink-06)", border: "none"
            }}
            onClick={() => { setShowOnlyPopular(v => !v); setShowOnlyFavorites(false); }}
          >
            <Sparkles size={13} /> Trending
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      <section>
        {loading ? (
          <div style={{ display: "grid", placeItems: "center", minHeight: "300px" }}>
            <div className="thinking">
              <div className="thinking-orb" />
              <p className="thinking-status">Loading templates...</p>
            </div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="panel" style={{ textAlign: "center", padding: "4rem 2rem" }}>
            <p className="text-gray-500" style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>No templates found matching your filters.</p>
            <button className="btn btn-ghost btn-xs" onClick={() => { setSearchQuery(""); setSelectedCategory("All"); setShowOnlyFavorites(false); setShowOnlyPopular(false); }}>Reset Filters</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
            {filteredTemplates.map(template => {
              const isFav = favorites.includes(template.id);
              const isSaved = savedList.includes(template.id);

              return (
                <article
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className="panel hover-lift"
                  style={{
                    padding: "1.15rem",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.7rem",
                    height: "100%",
                    border: isSaved ? "1px solid var(--iris)" : "1px solid transparent",
                    transition: "border-color 0.15s ease, transform 0.15s ease"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span className="eyebrow" style={{ fontSize: "0.68rem", color: "var(--iris)" }}>{template.category}</span>
                    <button
                      className="btn btn-ghost btn-xs"
                      style={{ padding: 4 }}
                      onClick={e => handleToggleFavorite(template.id, e)}
                      aria-label={isFav ? "Remove favorite" : "Add favorite"}
                    >
                      <Star size={15} fill={isFav ? "var(--peach)" : "none"} color={isFav ? "var(--peach)" : "currentColor"} />
                    </button>
                  </div>

                  <h3 style={{ fontSize: "0.98rem", fontWeight: 600, margin: 0, lineHeight: 1.3 }}>
                    {template.subject_template.replace(/\[.*?\]/g, "___")}
                  </h3>

                  <p className="text-gray-500" style={{ fontSize: "0.8rem", flexGrow: 1, margin: 0 }}>
                    {template.purpose}
                  </p>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {template.tone_options.map(t => (
                      <span key={t} className="mono" style={{ fontSize: "0.63rem", padding: "2px 6px", background: "var(--ink-06)", borderRadius: 4 }}>
                        {t}
                      </span>
                    ))}
                  </div>

                  <button
                    className={`btn btn-xs ${isSaved ? "btn-primary" : "btn-ghost"}`}
                    style={{ justifyContent: "center", gap: "0.3rem", fontSize: "0.75rem", marginTop: "0.15rem" }}
                    onClick={e => handleToggleSaved(template.id, e)}
                  >
                    {isSaved ? <Check size={13} /> : <Plus size={13} />}
                    {isSaved ? "Added to list" : "Add to list"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Bottom bar — appears once at least one template has been added */}
      {savedList.length > 0 && (
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="btn btn-primary"
          style={{
            position: "fixed",
            bottom: "1.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(560px, calc(100% - 2rem))",
            padding: "0.9rem 1.25rem",
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "var(--shadow-lift)",
            zIndex: 900,
            fontSize: "0.88rem"
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <FolderArchive size={17} />
            {savedList.length} {savedList.length === 1 ? "template" : "templates"} added to your list
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontWeight: 600 }}>
            View & Download <ChevronRight size={16} />
          </span>
        </button>
      )}

      {/* Drawer — slides in from the right to review / remove / export */}
      <div
        style={{
          position: "fixed", inset: 0,
          background: isDrawerOpen ? "rgba(15, 23, 42, 0.5)" : "transparent",
          pointerEvents: isDrawerOpen ? "auto" : "none",
          transition: "background 0.2s ease",
          zIndex: 1100
        }}
        onClick={() => setIsDrawerOpen(false)}
      >
        <div
          className="panel"
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed", top: 0, right: 0, height: "100vh",
            width: "min(380px, 90vw)",
            background: "var(--surface)",
            borderLeft: "1px solid var(--ink-12)",
            boxShadow: "var(--shadow-lift)",
            transform: isDrawerOpen ? "translateX(0)" : "translateX(100%)",
            transition: "transform 0.25s ease",
            display: "flex", flexDirection: "column", gap: "1rem",
            padding: "1.5rem", borderRadius: 0
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <FolderArchive size={17} className="text-iris" />
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>Your List</h3>
            </div>
            <button className="btn btn-ghost btn-xs" onClick={() => setIsDrawerOpen(false)} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {savedList.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--ink-72)" }}>Your list is empty. Add templates from the library to prep several drafts and download them together.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", overflowY: "auto", flexGrow: 1 }}>
              {savedList.map(id => {
                const item = templates.find(t => t.id === id);
                if (!item) return null;
                return (
                  <div
                    key={id}
                    onClick={() => { setSelectedTemplate(item); setIsDrawerOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: "0.5rem", padding: "0.6rem 0.7rem", borderRadius: 8,
                      background: "var(--ink-03)", cursor: "pointer", fontSize: "0.8rem"
                    }}
                  >
                    <div style={{ overflow: "hidden" }}>
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.subject_template.replace(/\[.*?\]/g, "___")}
                      </div>
                      <div style={{ color: "var(--ink-72)", fontSize: "0.7rem" }}>{item.category}</div>
                    </div>
                    <button
                      className="btn btn-ghost btn-xs"
                      style={{ padding: 3, flexShrink: 0 }}
                      onClick={e => { e.stopPropagation(); setSavedList(prev => prev.filter(x => x !== id)); }}
                      aria-label="Remove from list"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {savedList.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", paddingTop: "0.75rem", borderTop: "1px solid var(--ink-06)" }}>
              <button className="btn btn-primary" style={{ gap: "0.4rem", fontSize: "0.85rem" }} onClick={handleDownloadZIP}>
                <Download size={15} /> Download ZIP
              </button>
              <button className="btn btn-ghost btn-xs" onClick={() => setSavedList([])}>Clear list</button>
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {selectedTemplate && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(4px)", display: "grid", placeItems: "center",
            zIndex: 1000, padding: "2rem"
          }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedTemplate(null); }}
        >
          <div
            ref={modalRef}
            className="panel"
            style={{
              width: "min(880px, 100%)", maxHeight: "90vh", overflowY: "auto",
              padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.4rem",
              background: "var(--surface)", border: "1px solid var(--ink-12)",
              boxShadow: "var(--shadow-lift)", borderRadius: 16
            }}
          >
            {/* Header */}
            <div style={{ borderBottom: "1px solid var(--ink-06)", paddingBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span className="eyebrow" style={{ color: "var(--iris)" }}>WORKSPACE</span>
                <h2 style={{ fontSize: "1.25rem", margin: "0.2rem 0" }}>{selectedTemplate.category}</h2>
                <p className="text-gray-500" style={{ fontSize: "0.82rem", margin: 0 }}>{selectedTemplate.purpose}</p>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setSelectedTemplate(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              {/* Left column — inputs */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {selectedTemplate.placeholders.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 style={{ fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>Smart Placeholders</h3>
                      {/* <button
                        className="btn btn-ghost btn-xs text-iris"
                        style={{ fontSize: "0.72rem", gap: "0.25rem" }}
                        onClick={handleAutoPopulate}
                        disabled={isPopulating}
                      >
                        {isPopulating ? (<><Loader2 size={12} className="animate-spin" /> Populating...</>) : (<>✦ Auto-populate</>)}
                      </button> */}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {selectedTemplate.placeholders.map(p => (
                        <label key={p} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                          <span className="mono" style={{ fontSize: "0.72rem", color: "var(--ink-72)" }}>{p}</span>
                          <input
                            type="text"
                            className="input"
                            value={placeholderValues[p] || ""}
                            placeholder={`Enter ${p}`}
                            onChange={e => {
                              const newVals = { ...placeholderValues, [p]: e.target.value };
                              setPlaceholderValues(newVals);
                              // Pass newVals explicitly — setPlaceholderValues is async
                              // so getLocallyPopulatedDraft would read stale state otherwise.
                              const { subject: s, body: b } = getLocallyPopulatedDraft(
                                selectedTemplate.subject_template, selectedTemplate.body_template, newVals
                              );
                              setSubject(s);
                              setBody(b);
                            }}
                            style={{ padding: "0.35rem 0.5rem", fontSize: "0.85rem" }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", background: "var(--ink-03)", padding: "1rem", borderRadius: 10 }}>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem", margin: 0 }}>
                    <Sliders size={14} className="text-iris" /> AI Settings
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <span style={{ fontSize: "0.72rem" }}>Tone</span>
                      <select className="input" value={tone} onChange={e => setTone(e.target.value)} style={{ padding: "0.3rem", fontSize: "0.8rem", background: "var(--surface)" }}>
                        {selectedTemplate.tone_options.map(t => (<option key={t} value={t}>{t}</option>))}
                        <option value="Casual">Casual</option>
                        <option value="Confident">Confident</option>
                      </select>
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <span style={{ fontSize: "0.72rem" }}>Length</span>
                      <select className="input" value={length} onChange={e => setLength(e.target.value)} style={{ padding: "0.3rem", fontSize: "0.8rem", background: "var(--surface)" }}>
                        <option value="Shorter">Shorter</option>
                        <option value="Medium">Medium</option>
                        <option value="Longer">Longer</option>
                      </select>
                    </label>
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    <span style={{ fontSize: "0.72rem" }}>Translate to</span>
                    <select className="input" value={language} onChange={e => setLanguage(e.target.value)} style={{ padding: "0.3rem", fontSize: "0.8rem", background: "var(--surface)" }}>
                      <option value="English">English</option>
                      <option value="Malay">Bahasa Melayu</option>
                      <option value="Mandarin">Mandarin (Simplified)</option>
                      <option value="Tamil">Tamil</option>
                    </select>
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    <span style={{ fontSize: "0.72rem" }}>Custom changes (optional)</span>
                    <textarea
                      className="input" rows={2} value={customPrompt}
                      placeholder="e.g. Ask for a meeting on Tuesday afternoon..."
                      onChange={e => setCustomPrompt(e.target.value)}
                      style={{ padding: "0.4rem", fontSize: "0.8rem", resize: "none" }}
                    />
                  </label>
                  <button
                    className="btn btn-primary"
                    onClick={handleAiGenerate}
                    disabled={isGenerating}
                    style={{ gap: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {isGenerating ? (<><Loader2 size={16} className="animate-spin" /> Generating Draft...</>) : (<><Sparkles size={16} /> Draft with Aura AI</>)}
                  </button>
                </div>
              </div>

              {/* Right column — output */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Subject Line</span>
                  <input type="text" className="input" value={subject} onChange={e => setSubject(e.target.value)} style={{ padding: "0.5rem", fontSize: "0.9rem", fontWeight: 500 }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", flexGrow: 1 }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Message Body</span>
                  <textarea
                    className="input font-mono" rows={14} value={body}
                    onChange={e => setBody(e.target.value)}
                    style={{ padding: "0.75rem", fontSize: "0.85rem", whiteSpace: "pre-wrap", resize: "vertical", lineHeight: 1.5, minHeight: 260 }}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <button className="btn btn-ghost" style={{ fontSize: "0.8rem", gap: "0.3rem" }} onClick={() => handleCopy("plain")}>
                    {copyStatus === "plain" ? <Check size={14} className="text-mint" /> : <Copy size={14} />}
                    {copyStatus === "plain" ? "Copied!" : "Copy Text"}
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: "0.8rem", gap: "0.3rem" }} onClick={() => handleCopy("markdown")}>
                    {copyStatus === "markdown" ? <Check size={14} className="text-mint" /> : <Copy size={14} />}
                    {copyStatus === "markdown" ? "Copied!" : "Copy Markdown"}
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <button className="btn btn-secondary" style={{ fontSize: "0.8rem", gap: "0.3rem" }} onClick={handleDownloadPDF}>
                    <FileDown size={14} /> PDF
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: "0.8rem", gap: "0.3rem" }} onClick={handleDownloadDOCX}>
                    <FileText size={14} /> Word (.doc)
                  </button>
                </div>
                <button
                  className={`btn btn-block ${savedList.includes(selectedTemplate.id) ? "btn-primary" : "btn-ghost"}`}
                  style={{ fontSize: "0.8rem", gap: "0.35rem" }}
                  onClick={e => handleToggleSaved(selectedTemplate.id, e)}
                >
                  {savedList.includes(selectedTemplate.id) ? (<><Check size={14} /> Added to your list</>) : (<><Plus size={14} /> Add to your list</>)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}