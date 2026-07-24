"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Search, Radar, ClipboardCheck, ArrowLeftRight } from "lucide-react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { api, type Application } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { scoreColor } from "@/components/ScoreDial";
import { useAuth } from "@/components/AuthProvider";
import EmployerPipelineTimeline from "@/components/tracker/EmployerPipelineTimeline";


const TRACKER_STATUSES = [
  "Evaluated",
  "Saved",
  "Applied",
  "Phone Screen",
  "Technical Test",
  "First Round",
  "Second Round",
  "Final Round",
  "Offer",
  "Rejected",
  "Withdrawn"
];

/** Four phase groups for the grouped Kanban view. */
const KANBAN_GROUPS: { label: string; icon: string; color: string; statuses: readonly string[] }[] = [
  { label: "PREP",       icon: "📋", color: "rgba(100,116,139,0.75)", statuses: ["Evaluated", "Saved"] },
  { label: "ACTIVE",     icon: "🎯", color: "rgba(59,130,246,0.85)",  statuses: ["Applied", "Phone Screen", "Technical Test"] },
  { label: "INTERVIEWS", icon: "💬", color: "rgba(139,92,246,0.85)",  statuses: ["First Round", "Second Round", "Final Round"] },
  { label: "CLOSED",     icon: "✓",    color: "rgba(16,185,129,0.85)",  statuses: ["Offer", "Rejected", "Withdrawn"] },
];

/** Legacy status aliases kept for backward compat with old tracker entries. */
const statusMatchesLane = (appStatus: string, laneStatus: string): boolean => {
  if (laneStatus === "Phone Screen" && (appStatus === "Interview" || appStatus === "Responded")) return true;
  if (laneStatus === "Withdrawn"    && (appStatus === "Discarded" || appStatus === "SKIP"))      return true;
  return appStatus === laneStatus;
};

/** Sub-status dot colour for cards within a group. */
const laneColor = (status: string): string => {
  if (status === "Applied")                               return "rgba(59,130,246,0.8)";
  if (["Phone Screen","First Round","Second Round","Final Round","Technical Test"].includes(status)) return "var(--iris)";
  if (status === "Offer")                                return "rgba(16,185,129,0.8)";
  if (status === "Rejected")                             return "rgba(239,68,68,0.8)";
  return "var(--ink-30)";
};

const PRIORITIES = ["low", "medium", "high"];
type ToastTone = "success" | "error" | "info";
type ToastMessage = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

export default function JobTracker() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const { user, loading: authLoading } = useAuth();

  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  // Job comparison selection (keyed by evaluation_id — only evaluated jobs can be compared)
  const [compareSelected, setCompareSelected] = useState<Set<number>>(new Set());

  const toggleCompareSelect = useCallback((evaluationId: number | undefined) => {
    if (evaluationId === undefined || evaluationId === null) return;
    setCompareSelected((prev) => {
      const next = new Set(prev);
      if (next.has(evaluationId)) next.delete(evaluationId);
      else next.add(evaluationId);
      return next;
    });
  }, []);

  const clearCompareSelection = useCallback(() => setCompareSelected(new Set()), []);

  const goToCompare = useCallback(() => {
    router.push(`/compare?ids=${[...compareSelected].join(",")}`);
  }, [compareSelected, router]);
  
  // Search & filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  
  // Modals & Drawers
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [pendingDeleteApp, setPendingDeleteApp] = useState<Application | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Manual form state
  const [manualCompany, setManualCompany] = useState("");
  const [manualRole, setManualRole] = useState("");
  const [manualStatus, setManualStatus] = useState("Applied");
  const [manualPriority, setManualPriority] = useState<Application["priority"]>("medium");
  const [manualTagsInput, setManualTagsInput] = useState("");

  // Drawer detail edit states
  const [autoSaveStatus, setAutoSaveStatus] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachmentCategory, setAttachmentCategory] = useState("Resume");
  
  // New link state
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkCategory, setNewLinkCategory] = useState("Other");
  
  // Scheduler state
  const [newInterviewName, setNewInterviewName] = useState("");
  const [newInterviewType, setNewInterviewType] = useState<"virtual" | "physical" | "phone">("virtual");
  const [newInterviewDate, setNewInterviewDate] = useState("");
  const [newInterviewInterviewer, setNewInterviewInterviewer] = useState("");
  
  // Checklist item inside interview scheduler
  const [activeInterviewId, setActiveInterviewId] = useState<string | null>(null);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  // Custom Timeline Milestone state
  const [customMilestoneTitle, setCustomMilestoneTitle] = useState("");
  const [customMilestoneDesc, setCustomMilestoneDesc] = useState("");

  // Drag & drop lane highlighting
  const [draggedOverLane, setDraggedOverLane] = useState<string | null>(null);
  // Use a ref (not state) for the dragged app ID — state causes stale closure in handleDrop
  const draggedAppIdRef = useRef<string | null>(null);

  // Helper formatting for Notion-style editor
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Always-fresh reference to selectedApp — fixes stale closure in onBlur handlers
  const selectedAppRef = useRef<Application | null>(null);
  useEffect(() => {
    selectedAppRef.current = selectedApp;
  }, [selectedApp]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const showToast = useCallback((message: Omit<ToastMessage, "id">) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ ...message, id: Date.now() });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4200);
  }, []);

  const refreshApplications = useCallback(() => {
    if (authLoading || !user) return;
    api
      .listApplications()
      .then((data) => {
        console.log("Tracker page loaded applications:", data);
        setApps(data);
      })
      .catch((err) => {
        console.error("Failed to load applications:", err);
        setError("Could not load job applications tracker.");
      });
  }, [authLoading, user]);

  useEffect(() => {
    refreshApplications();
  }, [user, authLoading, refreshApplications]);

  // Entrance animations
  useEffect(() => {
    const mm = gsap.matchMedia(rootRef);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(rootRef);
      const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.6 } });
      tl.from(q(".page-head > *"), { y: 20, autoAlpha: 0, stagger: 0.08 })
        .from(q(".tracker-toolbar"), { y: 15, autoAlpha: 0, duration: 0.4 }, "-=0.2")
        .from(q(".tracker-content-area"), { y: 25, autoAlpha: 0, duration: 0.5 }, "-=0.3");
    });
    return () => mm.revert();
  }, []);

  // Get all unique tags across all apps for filter dropdown
  const allTags = Array.from(
    new Set((apps || []).flatMap((app) => app.tags || []))
  );

  // Filtered applications
  const filteredApps = (apps || []).filter((app) => {
    const matchesSearch =
      app.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority =
      filterPriority === "all" || app.priority === filterPriority;
    const matchesTag =
      filterTag === "all" || (app.tags && app.tags.includes(filterTag));
    return matchesSearch && matchesPriority && matchesTag;
  });

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, appId: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", appId);
    draggedAppIdRef.current = appId; // use ref — always fresh, no stale closure
  };

  const handleDragOver = (e: React.DragEvent, laneId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDraggedOverLane(laneId);
  };

  const handleDragLeave = () => {
    setDraggedOverLane(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDraggedOverLane(null);
    const appId = e.dataTransfer.getData("text/plain") || draggedAppIdRef.current;
    draggedAppIdRef.current = null;
    if (!appId || !apps) return;

    const matchedApp = apps.find((a) => a.id === appId);
    if (!matchedApp || matchedApp.status === targetStatus) return;

    const today = new Date().toISOString().split("T")[0];
    const updatedTimeline = [
      ...(matchedApp.timeline || []),
      {
        date: today,
        title: `Moved to ${targetStatus}`,
        description: `Status changed from '${matchedApp.status}' to '${targetStatus}'.`,
        custom: false,
      },
    ];

    const updatedApp = { 
      ...matchedApp, 
      status: targetStatus,
      timeline: updatedTimeline
    };
    
    setApps((prev) => (prev ? prev.map((a) => (a.id === appId ? updatedApp : a)) : null));

    try {
      await api.updateStatus(appId, targetStatus);
      await api.updateApplicationDetails(appId, {
        status: targetStatus,
        interview_type: matchedApp.interview_type,
        mock_interview_done: matchedApp.mock_interview_done,
        notes: matchedApp.notes || "",
        attachments: matchedApp.attachments || [],
        priority: matchedApp.priority || "medium",
        tags: matchedApp.tags || [],
        interviews: matchedApp.interviews || [],
        timeline: updatedTimeline,
      }).catch((detailsErr) => {
        console.warn("Status updated, but timeline/details sync failed:", detailsErr);
      });
      if (selectedApp && selectedApp.id === appId) {
        setSelectedApp(updatedApp);
      }
    } catch (err) {
      console.error("Failed to update status on drop:", err);
      // Revert
      setApps((prev) => (prev ? prev.map((a) => (a.id === appId ? matchedApp : a)) : null));
    }
  };

  const saveApplicationDetails = async (updatedApp: Application) => {
    // Guard: bail out early if id is missing (prevents "undefined" in URL)
    if (!updatedApp?.id) {
      console.warn("saveApplicationDetails called with no id — skipping");
      return;
    }
    setAutoSaveStatus("Saving changes...");
    try {
      await api.updateApplicationDetails(updatedApp.id, {
        status: updatedApp.status,
        interview_type: updatedApp.interview_type,
        mock_interview_done: updatedApp.mock_interview_done,
        notes: updatedApp.notes || "",
        attachments: updatedApp.attachments || [],
        priority: updatedApp.priority || "medium",
        tags: updatedApp.tags || [],
        interviews: updatedApp.interviews || [],
        timeline: updatedApp.timeline || [],
      });
      setAutoSaveStatus("Changes saved");
      setApps((prev) => (prev ? prev.map((a) => (a.id === updatedApp.id ? updatedApp : a)) : null));
      setTimeout(() => setAutoSaveStatus(""), 2000);
    } catch (err) {
      console.error("Save error:", err);
      setAutoSaveStatus("Error saving changes");
    }
  };

  const handleCreateManualApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCompany.trim() || !manualRole.trim()) return;

    try {
      const parsedTags = manualTagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const created = await api.createManualApplication(
        manualCompany.trim(),
        manualRole.trim(),
        manualStatus
      );

      // Now set priority and tags which aren't in default create api
      const finalApp: Application = {
        ...created,
        priority: manualPriority,
        tags: parsedTags,
      };

      await api.updateApplicationDetails(created.id, {
        status: finalApp.status,
        interview_type: finalApp.interview_type,
        mock_interview_done: finalApp.mock_interview_done,
        notes: finalApp.notes || "",
        attachments: finalApp.attachments || [],
        priority: finalApp.priority,
        tags: finalApp.tags,
        interviews: finalApp.interviews || [],
        timeline: finalApp.timeline || [],
      });

      setApps((prev) => (prev ? [finalApp, ...prev] : [finalApp]));
      setIsManualModalOpen(false);
      setManualCompany("");
      setManualRole("");
      setManualStatus("Applied");
      setManualPriority("medium");
      setManualTagsInput("");

      // Open detail drawer
      setSelectedApp(finalApp);
      setDrawerOpen(true);
      showToast({
        tone: "success",
        title: "Tracker entry created",
        description: `${finalApp.company} was added to your board.`,
      });
    } catch (err) {
      console.error("Failed to create application:", err);
      showToast({
        tone: "error",
        title: "Could not create tracker entry",
        description: "Please check that the backend is running with the latest application routes.",
      });
    }
  };

  const handleDeleteApplication = async (appId: string) => {
    try {
      await api.deleteApplication(appId);
      setApps((prev) => (prev ? prev.filter((a) => a.id !== appId) : null));
      if (selectedApp && selectedApp.id === appId) {
        setDrawerOpen(false);
        setSelectedApp(null);
      }
      setPendingDeleteApp(null);
      showToast({
        tone: "success",
        title: "Tracker entry deleted",
        description: "The application was removed from your board.",
      });
    } catch (err) {
      console.error("Failed to delete application:", err);
      showToast({
        tone: "error",
        title: "Could not delete tracker entry",
        description: "The application is still on your board. Try again in a moment.",
      });
    }
  };

  // Attachments handlers
  const handleUploadFile = async (file: File) => {
    if (!user || !selectedApp) return;
    setUploadingFile(true);
    try {
      const bucketName = "attachments";
      const fileName = `${selectedApp.id}/${Date.now()}_${file.name}`;

      const { error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      const newAttachment = {
        name: file.name,
        url: publicUrl,
        type: "file" as const,
        category: attachmentCategory,
      };

      const updatedAttachments = [...(selectedApp.attachments || []), newAttachment];
      
      const today = new Date().toISOString().split("T")[0];
      const updatedTimeline = [
        ...(selectedApp.timeline || []),
        {
          date: today,
          title: "Attachment Added",
          description: `Uploaded file '${file.name}' under category '${attachmentCategory}'.`,
          custom: false,
        }
      ];

      const updatedApp = { 
        ...selectedApp, 
        attachments: updatedAttachments,
        timeline: updatedTimeline 
      };

      setSelectedApp(updatedApp);
      await saveApplicationDetails(updatedApp);
    } catch (err) {
      console.error("Upload error:", err);
      showToast({
        tone: "error",
        title: "Upload failed",
        description: "Verify that the Supabase attachments bucket exists and allows public access.",
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAddLink = async () => {
    if (!selectedApp || !newLinkUrl.trim()) return;
    const name = newLinkName.trim() || new URL(newLinkUrl).hostname || "Link";
    
    const newAttachment = {
      name,
      url: newLinkUrl.trim(),
      type: "link" as const,
      category: newLinkCategory,
    };
    
    const updatedAttachments = [...(selectedApp.attachments || []), newAttachment];
    
    const today = new Date().toISOString().split("T")[0];
    const updatedTimeline = [
      ...(selectedApp.timeline || []),
      {
        date: today,
        title: "Link Added",
        description: `Linked to '${name}' under category '${newLinkCategory}'.`,
        custom: false,
      }
    ];

    const updatedApp = { 
      ...selectedApp, 
      attachments: updatedAttachments,
      timeline: updatedTimeline
    };

    setSelectedApp(updatedApp);
    setNewLinkName("");
    setNewLinkUrl("");
    setNewLinkCategory("Other");

    await saveApplicationDetails(updatedApp);
  };

  const handleRemoveAttachment = async (idx: number) => {
    if (!selectedApp) return;
    const removed = selectedApp.attachments[idx];
    const updatedAttachments = selectedApp.attachments.filter((_, i) => i !== idx);
    
    const today = new Date().toISOString().split("T")[0];
    const updatedTimeline = [
      ...(selectedApp.timeline || []),
      {
        date: today,
        title: "Attachment Removed",
        description: `Removed attachment '${removed.name}'.`,
        custom: false,
      }
    ];

    const updatedApp = { 
      ...selectedApp, 
      attachments: updatedAttachments,
      timeline: updatedTimeline 
    };

    setSelectedApp(updatedApp);
    await saveApplicationDetails(updatedApp);
  };

  // Interview Scheduler handlers
  const handleAddInterview = async () => {
    if (!selectedApp || !newInterviewName.trim() || !newInterviewDate) return;

    const newInterview = {
      id: crypto.randomUUID(),
      name: newInterviewName.trim(),
      type: newInterviewType,
      date: newInterviewDate,
      interviewer: newInterviewInterviewer.trim() || undefined,
      checklist: [],
      feedback: "",
    };

    const updatedInterviews = [...(selectedApp.interviews || []), newInterview];
    
    // Auto-log to timeline
    const today = new Date().toISOString().split("T")[0];
    const updatedTimeline = [
      ...(selectedApp.timeline || []),
      {
        date: today,
        title: "Interview Scheduled",
        description: `${newInterview.name} (${newInterview.type}) scheduled on ${newInterview.date}.`,
        custom: false,
      }
    ];

    const updatedApp: Application = { 
      ...selectedApp, 
      interviews: updatedInterviews,
      interview_type: (newInterviewType === "phone" ? "none" : newInterviewType) as "none" | "virtual" | "physical", // sync fallback
      timeline: updatedTimeline
    };

    setSelectedApp(updatedApp);
    setNewInterviewName("");
    setNewInterviewType("virtual");
    setNewInterviewDate("");
    setNewInterviewInterviewer("");

    await saveApplicationDetails(updatedApp);
  };

  const handleRemoveInterview = async (interviewId: string) => {
    if (!selectedApp) return;
    const matched = selectedApp.interviews.find((i) => i.id === interviewId);
    const updatedInterviews = selectedApp.interviews.filter((i) => i.id !== interviewId);

    const today = new Date().toISOString().split("T")[0];
    const updatedTimeline = [
      ...(selectedApp.timeline || []),
      {
        date: today,
        title: "Interview Cancelled",
        description: `Cancelled scheduled round '${matched?.name}'.`,
        custom: false,
      }
    ];

    const updatedApp = { 
      ...selectedApp, 
      interviews: updatedInterviews,
      timeline: updatedTimeline 
    };

    setSelectedApp(updatedApp);
    await saveApplicationDetails(updatedApp);
  };

  const handleToggleChecklist = async (interviewId: string, itemIdx: number) => {
    if (!selectedApp) return;
    const updatedInterviews = selectedApp.interviews.map((int) => {
      if (int.id === interviewId && int.checklist) {
        const updatedChecklist = int.checklist.map((item, idx) => 
          idx === itemIdx ? { ...item, done: !item.done } : item
        );
        return { ...int, checklist: updatedChecklist };
      }
      return int;
    });

    const updatedApp = { ...selectedApp, interviews: updatedInterviews };
    setSelectedApp(updatedApp);
    await saveApplicationDetails(updatedApp);
  };

  const handleAddChecklistItem = async (interviewId: string) => {
    if (!selectedApp || !newChecklistItem.trim()) return;

    const updatedInterviews = selectedApp.interviews.map((int) => {
      if (int.id === interviewId) {
        const list = int.checklist || [];
        return {
          ...int,
          checklist: [...list, { text: newChecklistItem.trim(), done: false }],
        };
      }
      return int;
    });

    const updatedApp = { ...selectedApp, interviews: updatedInterviews };
    setSelectedApp(updatedApp);
    setNewChecklistItem("");
    await saveApplicationDetails(updatedApp);
  };

  const handleUpdateFeedback = async (interviewId: string, text: string) => {
    if (!selectedApp) return;
    const updatedInterviews = selectedApp.interviews.map((int) => {
      if (int.id === interviewId) {
        return { ...int, feedback: text };
      }
      return int;
    });

    const updatedApp = { ...selectedApp, interviews: updatedInterviews };
    setSelectedApp(updatedApp);
    // Don't auto-save immediately on keystroke; let blur trigger it, or just do it
  };

  // Custom Timeline Milestone handler
  const handleAddCustomMilestone = async () => {
    if (!selectedApp || !customMilestoneTitle.trim()) return;

    const today = new Date().toISOString().split("T")[0];
    const newMilestone = {
      date: today,
      title: customMilestoneTitle.trim(),
      description: customMilestoneDesc.trim(),
      custom: true,
    };

    const updatedTimeline = [...(selectedApp.timeline || []), newMilestone];
    const updatedApp = { ...selectedApp, timeline: updatedTimeline };

    setSelectedApp(updatedApp);
    setCustomMilestoneTitle("");
    setCustomMilestoneDesc("");

    await saveApplicationDetails(updatedApp);
  };

  const handleRemoveMilestone = async (idx: number) => {
    if (!selectedApp) return;
    const updatedTimeline = selectedApp.timeline.filter((_, i) => i !== idx);
    const updatedApp = { ...selectedApp, timeline: updatedTimeline };
    setSelectedApp(updatedApp);
    await saveApplicationDetails(updatedApp);
  };

  // Notion notes formatting helpers
  const insertFormatting = (prefix: string, suffix = "") => {
    const textarea = notesTextareaRef.current;
    if (!textarea || !selectedApp) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    
    const replacement = prefix + (selected || "text") + suffix;
    const nextValue = text.substring(0, start) + replacement + text.substring(end);

    const updated = { ...selectedApp, notes: nextValue };
    setSelectedApp(updated);
    
    // Focus back & reset selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected || "text").length);
    }, 50);
  };

  return (
    <div className="tracker-page app-sheet" ref={rootRef}>
      <div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "6rem" }}>

        <div className="page-kicker mb-4">(02) // CAREER_PLANNING</div>

        {/* Job Hub — quick-action tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { href: "/jobs", label: "Find Jobs", Icon: Search, desc: "Browse open roles for you" },
            { href: "/scan", label: "Scan Jobs", Icon: Radar, desc: "Pull postings from job boards" },
            { href: "/evaluate", label: "Evaluate Job", Icon: ClipboardCheck, desc: "Score a job against your resume" },
            { href: "/compare", label: "Compare Jobs", Icon: ArrowLeftRight, desc: "Rank your evaluated offers" },
          ].map(({ href, label, Icon, desc }) => (
            <Link
              key={href}
              href={href}
              className="group relative flex flex-col justify-between gap-8 bg-[var(--surface)] border border-[color:var(--ink-30)] px-4 py-4 no-underline transition-[border-color,background-color] duration-200 hover:border-[color:var(--iris)] hover:bg-[var(--iris-08)]"
            >
              <span className="flex items-center justify-between">
                <Icon size={18} className="text-[color:var(--iris)]" aria-hidden="true" />
                <span className="font-[family-name:var(--font-space)] text-sm text-[color:var(--ink-30)] transition-colors group-hover:text-[color:var(--iris)]">→</span>
              </span>
              <span className="font-[family-name:var(--font-space)] uppercase tracking-[0.06em] text-[0.8rem] font-bold text-[color:var(--ink)]">
                {label}
              </span>
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-20 -translate-x-1/2 translate-y-1 scale-95 whitespace-nowrap border border-[color:var(--iris)] bg-[var(--ink)] px-3 py-1.5 font-[family-name:var(--font-space)] text-[0.7rem] tracking-[0.02em] text-[var(--porcelain)] opacity-0 shadow-[var(--shadow-card)] transition-[translate,scale,opacity] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100"
              >
                {desc}
              </span>
            </Link>
          ))}
        </div>

        {/* Page Header */}
        <div className="page-head" style={{ paddingTop: 0 }}>
          <h1>Job Board Tracker</h1>
          <p>
            Track your corporate targets. Drag applications across milestones, scheduled evaluations, Notion-style workspaces, and timelines.
          </p>
        </div>

        {error && <div className="notice notice-error">{error}</div>}

        {/* Tracker Toolbar / Filter Panel */}
        <div className="tracker-toolbar panel" data-tour="tracker-toolbar" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between", padding: "1rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", flex: 1, minWidth: "280px" }}>
            {/* Search Input */}
            <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
              <input 
                type="text" 
                className="input" 
                style={{ paddingLeft: "2rem", height: "36px", fontSize: "0.85rem" }}
                placeholder="Search company or role..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", opacity: 0.4, fontSize: "0.85rem" }}>🔍</span>
            </div>

            {/* Filter Priority */}
            <select 
              className="input" 
              style={{ width: "auto", minWidth: "135px", height: "36px", fontSize: "0.85rem", padding: "0 1.75rem 0 0.75rem" }}
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="all">All Priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Filter Tag */}
            <select 
              className="input" 
              style={{ width: "auto", minWidth: "135px", height: "36px", fontSize: "0.85rem", padding: "0 1.75rem 0 0.75rem" }}
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
            >
              <option value="all">All Tags</option>
              {allTags.map((tag, tagIdx) => (
                <option key={`tag-opt-${tagIdx}`} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            {/* View Mode Toggle */}
            <div style={{ display: "flex", gap: "0.2rem", background: "rgba(26,29,41,0.04)", padding: "0.2rem", borderRadius: "var(--r-s)" }}>
              <button 
                className="btn btn-ghost" 
                style={{ 
                  padding: "0.35rem 0.75rem", 
                  fontSize: "0.75rem", 
                  borderRadius: "calc(var(--r-s) - 0.2rem)",
                  background: viewMode === "kanban" ? "var(--surface)" : "transparent",
                  color: viewMode === "kanban" ? "var(--ink)" : "var(--ink-55)",
                  boxShadow: viewMode === "kanban" ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
                }}
                onClick={() => setViewMode("kanban")}
              >
                Kanban View
              </button>
              <button 
                className="btn btn-ghost" 
                style={{ 
                  padding: "0.35rem 0.75rem", 
                  fontSize: "0.75rem", 
                  borderRadius: "calc(var(--r-s) - 0.2rem)",
                  background: viewMode === "list" ? "var(--surface)" : "transparent",
                  color: viewMode === "list" ? "var(--ink)" : "var(--ink-55)",
                  boxShadow: viewMode === "list" ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
                }}
                onClick={() => setViewMode("list")}
              >
                List View
              </button>
            </div>

            {/* Add Custom Button */}
            <button 
              className="btn btn-primary text-white" 
              style={{ height: "36px", padding: "0 1rem", fontSize: "0.8rem" }}
              onClick={() => setIsManualModalOpen(true)}
            >
              + Create Tracker Entry
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="tracker-content-area">
          {apps && apps.length === 0 && (
            <div className="panel" style={{ textAlign: "center", padding: "4rem 2rem" }}>
              <h3 style={{ marginBottom: "0.5rem" }}>No applications yet</h3>
              <p style={{ color: "var(--ink-55)", marginBottom: "1.5rem" }}>
                Add your first tracked role using the dashboard evaluator or manual creation button.
              </p>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                <Link href="/evaluate" className="btn btn-primary text-white">
                  Evaluate a job fit
                </Link>
                <button className="btn btn-ghost" onClick={() => setIsManualModalOpen(true)}>
                  Create manual entry
                </button>
              </div>
            </div>
          )}

          {apps && apps.length > 0 && filteredApps.length === 0 && (
            <div className="panel" style={{ textAlign: "center", padding: "3rem" }}>
              <p style={{ color: "var(--ink-55)" }}>No results matching your filters.</p>
              <button className="btn btn-ghost" style={{ marginTop: "0.5rem", fontSize: "0.75rem" }} onClick={() => { setSearchQuery(""); setFilterPriority("all"); setFilterTag("all"); }}>
                Clear Filters
              </button>
            </div>
          )}

          {/* ─── KANBAN BOARD — 4 Phase Groups ─────────────────────────────── */}
          {apps && apps.length > 0 && filteredApps.length > 0 && viewMode === "kanban" && (
            <div
              data-tour="tracker-board"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "0.75rem",
                alignItems: "start",
              }}
            >
              {KANBAN_GROUPS.map((group) => {
                const groupApps = filteredApps.filter((a) =>
                  group.statuses.some((s) => statusMatchesLane(a.status, s))
                );

                return (
                  <div
                    key={group.label}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.4rem",
                      background: "rgba(26,29,41,0.012)",
                      border: "1.5px solid var(--ink-08)",
                      borderRadius: "var(--r-s)",
                      padding: "0.65rem",
                      minHeight: "200px",
                    }}
                  >
                    {/* ── Group phase header ── */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingBottom: "0.55rem",
                        marginBottom: "0.2rem",
                        borderBottom: `2px solid ${group.color}`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.09em",
                          color: group.color,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        {group.icon} {group.label}
                      </span>
                      <span
                        style={{
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          background: "rgba(26,29,41,0.07)",
                          padding: "0.05rem 0.4rem",
                          borderRadius: "10px",
                        }}
                      >
                        {groupApps.length}
                      </span>
                    </div>

                    {/* ── Sub-status lanes inside this group ── */}
                    {group.statuses.map((status) => {
                      const laneApps = filteredApps.filter((a) => statusMatchesLane(a.status, status));
                      const isOver = draggedOverLane === status;

                      return (
                        <div
                          key={status}
                          onDragOver={(e) => handleDragOver(e, status)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, status)}
                          style={{
                            borderRadius: "6px",
                            border: isOver
                              ? "1.5px dashed var(--iris)"
                              : "1px dashed var(--ink-10)",
                            background: isOver ? "rgba(78,63,216,0.04)" : "transparent",
                            transition: "all 0.15s ease",
                            overflow: "hidden",
                          }}
                        >
                          {/* Sub-lane header */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "0.28rem 0.5rem",
                              background: "rgba(26,29,41,0.025)",
                              borderBottom:
                                laneApps.length > 0 ? "1px solid var(--ink-06)" : "none",
                            }}
                          >
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.3rem",
                                fontSize: "0.6rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                color: "var(--ink-45)",
                              }}
                            >
                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: "50%",
                                  background: laneColor(status),
                                  display: "inline-block",
                                  flexShrink: 0,
                                }}
                              />
                              {status}
                            </span>
                            {laneApps.length > 0 && (
                              <span
                                style={{
                                  fontSize: "0.58rem",
                                  fontWeight: 700,
                                  color: "var(--ink-55)",
                                }}
                              >
                                {laneApps.length}
                              </span>
                            )}
                          </div>

                          {/* Empty drop hint */}
                          {laneApps.length === 0 && (
                            <div
                              style={{
                                padding: "0.45rem",
                                textAlign: "center",
                                fontSize: "0.58rem",
                                color: isOver ? "var(--iris)" : "var(--ink-20)",
                                fontStyle: "italic",
                                transition: "color 0.15s ease",
                              }}
                            >
                              {isOver ? "Drop here" : "empty"}
                            </div>
                          )}

                          {/* Cards */}
                          {laneApps.length > 0 && (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.35rem",
                                padding: "0.4rem",
                              }}
                            >
                              {laneApps.map((app, cardIdx) => {
                                const isCompareChecked = app.evaluation_id
                                  ? compareSelected.has(app.evaluation_id)
                                  : false;
                                return (
                                <div
                                  key={app.id || `${app.company}-${app.role}-${cardIdx}`}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, app.id)}
                                  onClick={() => { setSelectedApp(app); setDrawerOpen(true); }}
                                  className="kanban-card-new panel"
                                  style={{
                                    padding: "0.7rem",
                                    borderRadius: "calc(var(--r-s) - 2px)",
                                    cursor: "grab",
                                    transition: "all 0.18s ease",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                                    userSelect: "none",
                                    WebkitUserSelect: "none",
                                    position: "relative",
                                    outline: isCompareChecked ? "2px solid var(--iris)" : "none",
                                  }}
                                >
                                  {/* Card top row */}
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "flex-start",
                                      marginBottom: "0.2rem",
                                      gap: "0.3rem",
                                    }}
                                  >
                                    <span
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.3rem",
                                        minWidth: 0,
                                        maxWidth: "75%",
                                      }}
                                    >
                                      {app.evaluation_id && (
                                        <input
                                          type="checkbox"
                                          aria-label={`Select ${app.company} ${app.role} for comparison`}
                                          checked={isCompareChecked}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={() => toggleCompareSelect(app.evaluation_id)}
                                          style={{ width: 13, height: 13, accentColor: "var(--iris)", flexShrink: 0, cursor: "pointer" }}
                                        />
                                      )}
                                      <span
                                        style={{
                                          fontSize: "0.6rem",
                                          textTransform: "uppercase",
                                          fontWeight: 700,
                                          color: "var(--ink-40)",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {app.company}
                                      </span>
                                    </span>
                                    {app.priority === "high" && (
                                      <span
                                        style={{
                                          fontSize: "0.52rem",
                                          background: "rgba(239,68,68,0.1)",
                                          color: "#ef4444",
                                          fontWeight: 700,
                                          padding: "0.05rem 0.22rem",
                                          borderRadius: "3px",
                                          textTransform: "uppercase",
                                          flexShrink: 0,
                                        }}
                                      >
                                        High
                                      </span>
                                    )}
                                  </div>

                                  <h4
                                    style={{
                                      fontSize: "0.82rem",
                                      fontWeight: 600,
                                      margin: "0 0 0.35rem 0",
                                      color: "var(--ink)",
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    {app.role}
                                  </h4>

                                  {/* Tags — max 2 shown */}
                                  {app.tags && app.tags.length > 0 && (
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "0.18rem",
                                        flexWrap: "wrap",
                                        marginBottom: "0.4rem",
                                      }}
                                    >
                                      {app.tags.slice(0, 2).map((tag, tIdx) => (
                                        <span
                                          key={`${tag}-${tIdx}`}
                                          style={{
                                            fontSize: "0.57rem",
                                            background: "var(--ink-06)",
                                            color: "var(--ink-65)",
                                            padding: "0.03rem 0.22rem",
                                            borderRadius: "3px",
                                          }}
                                        >
                                          #{tag}
                                        </span>
                                      ))}
                                      {app.tags.length > 2 && (
                                        <span style={{ fontSize: "0.57rem", color: "var(--ink-35)" }}>
                                          +{app.tags.length - 2}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Footer badges */}
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "0.28rem",
                                      flexWrap: "wrap",
                                      alignItems: "center",
                                      borderTop: "1px solid var(--ink-06)",
                                      paddingTop: "0.35rem",
                                    }}
                                  >
                                    {app.evaluation_id ? (
                                      <span
                                        style={{
                                          fontSize: "0.6rem",
                                          background: scoreColor(app.score),
                                          color: "#fff",
                                          fontWeight: 700,
                                          padding: "0.05rem 0.28rem",
                                          borderRadius: "3px",
                                        }}
                                      >
                                        {app.score.toFixed(1)}
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          fontSize: "0.58rem",
                                          color: "var(--ink-35)",
                                          fontStyle: "italic",
                                        }}
                                      >
                                        Manual
                                      </span>
                                    )}
                                    {app.interviews && app.interviews.length > 0 && (
                                      <span style={{ fontSize: "0.58rem", color: "var(--iris)", fontWeight: 600 }}>
                                        🗓 {app.interviews.length}
                                      </span>
                                    )}
                                    {app.attachments && app.attachments.length > 0 && (
                                      <span style={{ fontSize: "0.58rem", color: "var(--ink-50)" }}>
                                        📎{app.attachments.length}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );})}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* LIST VIEW */}
          {apps && apps.length > 0 && filteredApps.length > 0 && viewMode === "list" && (
            <div className="panel" style={{ padding: "0.5rem", overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: "2rem" }}></th>
                    <th>Date Added</th>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Priority</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map((a, rowIdx) => (
                    <tr 
                      key={a.id || `${a.company}-${a.role}-${rowIdx}`} 
                      onClick={() => { setSelectedApp(a); setDrawerOpen(true); }}
                      style={{ cursor: "pointer" }}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        {a.evaluation_id && (
                          <input
                            type="checkbox"
                            aria-label={`Select ${a.company} ${a.role} for comparison`}
                            checked={compareSelected.has(a.evaluation_id)}
                            onChange={() => toggleCompareSelect(a.evaluation_id)}
                            style={{ width: 14, height: 14, accentColor: "var(--iris)", cursor: "pointer" }}
                          />
                        )}
                      </td>
                      <td className="mono" style={{ fontSize: "0.8rem" }}>{a.date}</td>
                      <td style={{ fontWeight: 600 }}>{a.company}</td>
                      <td>{a.role}</td>
                      <td style={{ textTransform: "capitalize" }}>
                        <span style={{
                          color: a.priority === "high" ? "#ef4444" : a.priority === "medium" ? "var(--ink-72)" : "var(--ink-40)",
                          fontWeight: a.priority === "high" ? 700 : 500
                        }}>
                          {a.priority || "medium"}
                        </span>
                      </td>
                      <td>
                        {a.evaluation_id ? (
                          <span className="score-pill" style={{ background: scoreColor(a.score) }}>
                            {a.score.toFixed(1)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--ink-30)", fontSize: "0.75rem" }}>Manual</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.15rem 0.45rem", borderRadius: "4px", background: "var(--ink-06)", color: "var(--ink)" }}>
                          {a.status}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.75rem", color: "var(--ink-55)" }}>
                          {a.tags && a.tags.length > 0 ? a.tags.join(", ") : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Notion Drawer Overlay */}
      <div 
        className={`drawer-overlay ${drawerOpen ? "active" : ""}`} 
        onClick={() => setDrawerOpen(false)}
      />

      {/* Notion Side Drawer Panel */}
      <div className={`drawer-panel ${drawerOpen ? "open" : ""}`} style={{ width: "550px" }}>
        {selectedApp && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            
            {/* Drawer Header */}
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ minWidth: 0, flex: 1, marginRight: "1rem" }}>
                <span className="mono" style={{ fontSize: "0.65rem", color: "var(--ink-55)", letterSpacing: "0.1em", display: "block" }}>
                  TRACKER // {selectedApp.evaluation_id ? `EVAL_${selectedApp.evaluation_id}` : "MANUAL_ENTRY"}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", marginTop: "0.4rem" }}>
                  <input 
                    type="text" 
                    className="input-inline" 
                    style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--ink)", width: "100%" }}
                    value={selectedApp.company}
                    onChange={(e) => setSelectedApp({ ...selectedApp, company: e.target.value })}
                    onBlur={() => { if (selectedAppRef.current) saveApplicationDetails(selectedAppRef.current); }}
                    placeholder="Company Name"
                  />
                  <input 
                    type="text" 
                    className="input-inline" 
                    style={{ fontSize: "0.95rem", color: "var(--ink-72)", width: "100%" }}
                    value={selectedApp.role}
                    onChange={(e) => setSelectedApp({ ...selectedApp, role: e.target.value })}
                    onBlur={() => { if (selectedAppRef.current) saveApplicationDetails(selectedAppRef.current); }}
                    placeholder="Role Title"
                  />
                </div>
              </div>
              <button className="btn btn-ghost" style={{ padding: "0.4rem 0.6rem", fontSize: "0.75rem" }} onClick={() => setDrawerOpen(false)}>
                ✕ Close
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
              
              {/* Properties Matrix */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", background: "rgba(26,29,41,0.015)", padding: "1rem", borderRadius: "var(--r-s)", border: "1px solid var(--border)" }}>
                <div>
                  <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", display: "block", marginBottom: "0.25rem" }}>STATUS</label>
                  <select 
                    className="input" 
                    style={{ height: "30px", fontSize: "0.8rem", padding: "0.2rem" }}
                    value={selectedApp.status}
                    onChange={async (e) => {
                      const updated = { ...selectedApp, status: e.target.value };
                      setSelectedApp(updated);
                      await saveApplicationDetails(updated);
                    }}
                  >
                    {TRACKER_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", display: "block", marginBottom: "0.25rem" }}>PRIORITY</label>
                  <select 
                    className="input" 
                    style={{ height: "30px", fontSize: "0.8rem", padding: "0.2rem" }}
                    value={selectedApp.priority || "medium"}
                    onChange={async (e) => {
                      const updated = { ...selectedApp, priority: e.target.value as Application["priority"] };
                      setSelectedApp(updated);
                      await saveApplicationDetails(updated);
                    }}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", display: "block", marginBottom: "0.25rem" }}>MATCH SCORE</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {selectedApp.evaluation_id ? (
                      <>
                        <span className="score-pill" style={{ background: scoreColor(selectedApp.score), fontSize: "0.75rem", fontWeight: 700 }}>
                          {selectedApp.score.toFixed(1)}
                        </span>
                        <Link href={`/report/${selectedApp.evaluation_id}`} className="auth-legal-link" style={{ fontSize: "0.75rem" }}>
                          Full Analysis Report
                        </Link>
                      </>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-40)" }}>Manual Target</span>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", display: "block", marginBottom: "0.25rem" }}>DATE CREATED</label>
                  <span className="mono" style={{ fontSize: "0.8rem", fontWeight: 600 }}>{selectedApp.date}</span>
                </div>
              </div>

              {/* Tags Editor */}
              <div>
                <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--ink-55)", display: "block", marginBottom: "0.35rem", fontFamily: "var(--font-space), monospace" }}>TAGS_KEYWORDS</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.5rem" }}>
                  {selectedApp.tags && selectedApp.tags.map((tag, tagIdx) => (
                    <span 
                      key={`${tag}-${tagIdx}`} 
                      style={{ fontSize: "0.68rem", background: "var(--ink-06)", color: "var(--ink-72)", padding: "0.1rem 0.4rem", borderRadius: "4px", display: "flex", alignItems: "center", gap: "0.25rem" }}
                    >
                      #{tag}
                      <button 
                        style={{ border: "none", background: "none", color: "red", cursor: "pointer", fontSize: "0.68rem" }}
                        onClick={async () => {
                          const updatedTags = selectedApp.tags.filter((t) => t !== tag);
                          const updated = { ...selectedApp, tags: updatedTags };
                          setSelectedApp(updated);
                          await saveApplicationDetails(updated);
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input 
                  type="text" 
                  className="input" 
                  style={{ height: "30px", fontSize: "0.78rem" }}
                  placeholder="Add tag (press comma to split)..." 
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      const val = e.currentTarget.value.trim().replace(",", "");
                      if (val && !(selectedApp.tags || []).includes(val)) {
                        const updatedTags = [...(selectedApp.tags || []), val];
                        const updated = { ...selectedApp, tags: updatedTags };
                        setSelectedApp(updated);
                        e.currentTarget.value = "";
                        await saveApplicationDetails(updated);
                      }
                    }
                  }}
                />
              </div>

              {/* Mock Interview & AI practice portal */}
              <div style={{ border: "1.5px dashed var(--iris-12)", background: "rgba(78, 63, 216, 0.02)", padding: "1rem", borderRadius: "var(--r-s)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <h4 style={{ fontSize: "0.8rem", fontWeight: 700, margin: 0, fontFamily: "var(--font-space), monospace" }}>AURA_MOCK_PRACTICE</h4>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <input 
                      id="drawer_mock_check"
                      type="checkbox"
                      checked={selectedApp.mock_interview_done}
                      onChange={async (e) => {
                        const updated = { ...selectedApp, mock_interview_done: e.target.checked };
                        setSelectedApp(updated);
                        await saveApplicationDetails(updated);
                      }}
                    />
                    <label htmlFor="drawer_mock_check" style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-72)", cursor: "pointer" }}>
                      Done
                    </label>
                  </div>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--ink-55)", margin: "0 0 0.75rem 0", lineHeight: 1.4 }}>
                  Simulate voice responses and keywords alignment for {selectedApp.role}.
                </p>
                <button 
                  className="btn btn-primary"
                  style={{ width: "100%", justifyContent: "center", fontSize: "0.75rem", padding: "0.45rem", color: "#fff" }}
                  onClick={() => {
                    router.push(`/mock-interview?role=${encodeURIComponent(selectedApp.role)}`);
                  }}
                >
                  Start Aura Practice Session
                </button>
              </div>

              {/* Multiple Rounds Interview Scheduler */}
              <div>
                <h4 style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.5rem", fontFamily: "var(--font-space), monospace" }}>INTERVIEW_ROUNDS_SCHEDULER</h4>
                
                {/* List Interview Rounds */}
                {selectedApp.interviews && selectedApp.interviews.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
                    {selectedApp.interviews.map((round, roundIdx) => (
                      <div key={round.id || `round-${roundIdx}`} style={{ background: "rgba(26,29,41,0.015)", border: "1px solid var(--border)", padding: "0.85rem", borderRadius: "var(--r-s)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem" }}>
                          <div>
                            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)" }}>{round.name}</span>
                            <span style={{ fontSize: "0.68rem", textTransform: "capitalize", background: "var(--iris-08)", color: "var(--iris-deep)", padding: "0.05rem 0.3rem", borderRadius: "3px", marginLeft: "0.5rem" }}>
                              {round.type}
                            </span>
                          </div>
                          <button 
                            style={{ border: "none", background: "none", color: "#ef4444", fontSize: "0.75rem", cursor: "pointer" }}
                            onClick={() => handleRemoveInterview(round.id)}
                          >
                            Remove
                          </button>
                        </div>
                        
                        <div style={{ fontSize: "0.75rem", color: "var(--ink-55)", display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "0.6rem" }}>
                          <span>📅 Date: <strong className="mono">{round.date}</strong></span>
                          {round.interviewer && <span>👤 Interviewer: <strong>{round.interviewer}</strong></span>}
                        </div>

                        {/* Interview checklist */}
                        <div style={{ marginBottom: "0.6rem" }}>
                          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-40)", display: "block", marginBottom: "0.25rem" }}>PREPARATION CHECKLIST</span>
                          {(round.checklist || []).map((item, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.2rem" }}>
                              <input 
                                type="checkbox" 
                                checked={item.done} 
                                onChange={() => handleToggleChecklist(round.id, idx)}
                              />
                              <span style={{ fontSize: "0.75rem", textDecoration: item.done ? "line-through" : "none", color: item.done ? "var(--ink-40)" : "var(--ink-72)" }}>
                                {item.text}
                              </span>
                            </div>
                          ))}
                          <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.35rem" }}>
                            <input 
                              type="text" 
                              className="input" 
                              style={{ height: "26px", fontSize: "0.72rem", padding: "0.2rem" }}
                              placeholder="Add task (e.g. read JD gaps)..." 
                              value={activeInterviewId === round.id ? newChecklistItem : ""}
                              onChange={(e) => {
                                setActiveInterviewId(round.id);
                                setNewChecklistItem(e.target.value);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddChecklistItem(round.id);
                                }
                              }}
                            />
                            <button 
                              className="btn btn-ghost" 
                              style={{ height: "26px", padding: "0 0.4rem", fontSize: "0.7rem", borderRadius: "3px" }}
                              onClick={() => handleAddChecklistItem(round.id)}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Interview feedback */}
                        <div>
                          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-40)", display: "block", marginBottom: "0.25rem" }}>FEEDBACK & QUESTIONS</span>
                          <textarea 
                            className="input" 
                            style={{ height: "55px", fontSize: "0.75rem", padding: "0.3rem", resize: "vertical" }}
                            placeholder="Write post-interview questions asked, notes, alignment..."
                            value={round.feedback || ""}
                            onChange={(e) => handleUpdateFeedback(round.id, e.target.value)}
                            onBlur={() => saveApplicationDetails(selectedApp)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: "0.75rem", color: "var(--ink-40)", margin: "0 0 1rem 0" }}>No interview rounds scheduled yet.</p>
                )}

                {/* Add Interview Round Panel */}
                <div style={{ background: "rgba(26,29,41,0.01)", border: "1px dashed var(--ink-30)", padding: "0.75rem", borderRadius: "var(--r-s)" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--ink-72)", display: "block", marginBottom: "0.4rem" }}>Schedule a New Round</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input 
                      type="text" 
                      className="input" 
                      style={{ height: "28px", fontSize: "0.75rem" }}
                      placeholder="Round Name (e.g. Technical)"
                      value={newInterviewName}
                      onChange={(e) => setNewInterviewName(e.target.value)}
                    />
                    <select 
                      className="input" 
                      style={{ height: "28px", fontSize: "0.75rem", padding: "0.2rem" }}
                      value={newInterviewType}
                      onChange={(e) => setNewInterviewType(e.target.value as Application["interviews"][number]["type"])}
                    >
                      <option value="virtual">💻 Virtual</option>
                      <option value="physical">🏢 On-site</option>
                      <option value="phone">📞 Phone</option>
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input 
                      type="date" 
                      className="input" 
                      style={{ height: "28px", fontSize: "0.75rem" }}
                      value={newInterviewDate}
                      onChange={(e) => setNewInterviewDate(e.target.value)}
                    />
                    <input 
                      type="text" 
                      className="input" 
                      style={{ height: "28px", fontSize: "0.75rem" }}
                      placeholder="Interviewer (Optional)"
                      value={newInterviewInterviewer}
                      onChange={(e) => setNewInterviewInterviewer(e.target.value)}
                    />
                  </div>
                  <button 
                    className="btn btn-ghost" 
                    style={{ width: "100%", height: "28px", fontSize: "0.75rem", justifyContent: "center" }}
                    onClick={handleAddInterview}
                    disabled={!newInterviewName || !newInterviewDate}
                  >
                    Add Interview Round
                  </button>
                </div>
              </div>

              {/* Drag and Drop Attachment files / links */}
              <div>
                <h4 style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.5rem", fontFamily: "var(--font-space), monospace" }}>ATTACHMENTS_FILES</h4>
                
                {/* List Attachments */}
                {selectedApp.attachments && selectedApp.attachments.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.75rem" }}>
                    {selectedApp.attachments.map((file, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.45rem 0.65rem", background: "rgba(26,29,41,0.015)", border: "1px solid var(--border)", borderRadius: "calc(var(--r-s) - 2px)", fontSize: "0.75rem" }}>
                        <a href={file.url} target="_blank" rel="noreferrer" className="auth-legal-link" style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                          {file.type === "file" ? "📄" : "🔗"} {file.name}
                          <span style={{ fontSize: "0.62rem", opacity: 0.6, background: "var(--ink-12)", padding: "0.02rem 0.25rem", borderRadius: "3px", marginLeft: "0.4rem" }}>
                            {file.category || "Other"}
                          </span>
                        </a>
                        <button 
                          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.72rem" }}
                          onClick={() => handleRemoveAttachment(idx)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Link Section */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", background: "rgba(26,29,41,0.01)", border: "1px dashed var(--border)", padding: "0.75rem", borderRadius: "var(--r-s)", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--ink-72)" }}>Add Link Resource</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr", gap: "0.4rem" }}>
                    <input 
                      className="input" 
                      placeholder="Title (e.g. Job JD)" 
                      style={{ height: "28px", fontSize: "0.75rem" }}
                      value={newLinkName}
                      onChange={(e) => setNewLinkName(e.target.value)}
                    />
                    <input 
                      className="input" 
                      placeholder="https://..." 
                      style={{ height: "28px", fontSize: "0.75rem" }}
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    <select 
                      className="input"
                      style={{ height: "28px", fontSize: "0.75rem", padding: "0.2rem", flex: 1 }}
                      value={newLinkCategory}
                      onChange={(e) => setNewLinkCategory(e.target.value)}
                    >
                      <option value="Resume">Resume</option>
                      <option value="Cover Letter">Cover Letter</option>
                      <option value="Offer Letter">Offer Letter</option>
                      <option value="Job Description">Job Description</option>
                      <option value="Other">Other</option>
                    </select>
                    <button 
                      className="btn btn-ghost" 
                      style={{ height: "28px", fontSize: "0.75rem", padding: "0 0.75rem" }}
                      disabled={!newLinkUrl.trim()}
                      onClick={handleAddLink}
                    >
                      Add URL
                    </button>
                  </div>
                </div>

                {/* File Upload Zone */}
                <div style={{ background: "rgba(26,29,41,0.015)", border: "1px solid var(--border)", padding: "0.75rem", borderRadius: "var(--r-s)" }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--ink-72)" }}>Category:</span>
                    <select 
                      className="input" 
                      style={{ height: "26px", fontSize: "0.72rem", padding: "0.1rem", width: "120px" }}
                      value={attachmentCategory}
                      onChange={(e) => setAttachmentCategory(e.target.value)}
                    >
                      <option value="Resume">Resume</option>
                      <option value="Cover Letter">Cover Letter</option>
                      <option value="Offer Letter">Offer Letter</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  
                  <div 
                    className={`dropzone ${uploadingFile ? "uploading" : ""}`}
                    style={{
                      border: "1.5px dashed var(--ink-30)",
                      borderRadius: "calc(var(--r-s) - 2px)",
                      padding: "1.25rem",
                      textAlign: "center",
                      cursor: "pointer",
                      background: "rgba(26,29,41,0.005)"
                    }}
                    onClick={() => document.getElementById("tracker_file_input")?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        await handleUploadFile(e.dataTransfer.files[0]);
                      }
                    }}
                  >
                    <input 
                      id="tracker_file_input"
                      type="file"
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          await handleUploadFile(e.target.files[0]);
                        }
                      }}
                    />
                    <span style={{ fontSize: "0.72rem", color: "var(--ink-55)" }}>
                      {uploadingFile ? "Uploading attachment..." : "Drag files here or click to upload PDF/DOCX/Images"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notion Style Markdown Notes Editor */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                  <h4 style={{ fontSize: "0.8rem", fontWeight: 700, margin: 0, fontFamily: "var(--font-space), monospace" }}>NOTION_WORKBOARD</h4>
                  {autoSaveStatus && (
                    <span style={{ fontSize: "0.65rem", color: "var(--ink-55)", fontStyle: "italic" }}>
                      {autoSaveStatus}
                    </span>
                  )}
                </div>

                {/* Text editor helper buttons */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", background: "rgba(26,29,41,0.04)", padding: "0.25rem", borderTopLeftRadius: "var(--r-s)", borderTopRightRadius: "var(--r-s)", borderBottom: "1px solid var(--border)" }}>
                  <button className="btn btn-ghost" style={{ padding: "0.2rem 0.4rem", fontSize: "0.68rem", height: "24px" }} onClick={() => insertFormatting("# ", "\n")}>H1</button>
                  <button className="btn btn-ghost" style={{ padding: "0.2rem 0.4rem", fontSize: "0.68rem", height: "24px" }} onClick={() => insertFormatting("## ", "\n")}>H2</button>
                  <button className="btn btn-ghost" style={{ padding: "0.2rem 0.4rem", fontSize: "0.68rem", height: "24px" }} onClick={() => insertFormatting("**", "**")}>Bold</button>
                  <button className="btn btn-ghost" style={{ padding: "0.2rem 0.4rem", fontSize: "0.68rem", height: "24px" }} onClick={() => insertFormatting("* ", "\n")}>Bullet</button>
                  <button className="btn btn-ghost" style={{ padding: "0.2rem 0.4rem", fontSize: "0.68rem", height: "24px" }} onClick={() => insertFormatting("- [ ] ", "\n")}>Checklist</button>
                  <button className="btn btn-ghost" style={{ padding: "0.2rem 0.4rem", fontSize: "0.68rem", height: "24px" }} onClick={() => insertFormatting("```\n", "\n```")}>Code Block</button>
                </div>
                
                <textarea 
                  ref={notesTextareaRef}
                  className="notion-textarea"
                  style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, height: "180px" }}
                  placeholder="Draft preparation notes, answers, compensation alignment strategies..."
                  value={selectedApp.notes || ""}
                  onChange={(e) => {
                    setSelectedApp({ ...selectedApp, notes: e.target.value });
                    setAutoSaveStatus("Unsaved changes...");
                  }}
                  onBlur={() => {
                    // Use ref to get the freshest selectedApp (avoids stale closure)
                    if (selectedAppRef.current) saveApplicationDetails(selectedAppRef.current);
                  }}
                />
              </div>

              {/* Employer-Driven Pipeline Timeline */}
              <EmployerPipelineTimeline applicationId={selectedApp.id} />

              {/* Visual Audit Trail Timeline */}
              <div>
                <h4 style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.75rem", fontFamily: "var(--font-space), monospace" }}>MILESTONES_TIMELINE</h4>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderLeft: "2px solid var(--ink-12)", paddingLeft: "1rem", marginLeft: "0.5rem", marginBottom: "1rem" }}>
                  {(selectedApp.timeline || []).map((milestone, idx) => (
                    <div key={idx} style={{ position: "relative" }}>
                      {/* Bullet node */}
                      <span style={{ 
                        position: "absolute", 
                        left: "-1.35rem", 
                        top: "0.25rem", 
                        width: "8px", 
                        height: "8px", 
                        borderRadius: "50%", 
                        background: milestone.custom ? "var(--iris)" : "var(--ink-55)",
                        border: "2px solid var(--surface)"
                      }} />
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink)" }}>
                          {milestone.title}
                        </span>
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                          <span className="mono" style={{ fontSize: "0.65rem", color: "var(--ink-40)" }}>
                            {milestone.date}
                          </span>
                          {milestone.custom && (
                            <button 
                              style={{ border: "none", background: "none", color: "red", fontSize: "0.68rem", cursor: "pointer" }}
                              onClick={() => handleRemoveMilestone(idx)}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {milestone.description && (
                        <p style={{ fontSize: "0.72rem", color: "var(--ink-55)", margin: "0.1rem 0 0 0", lineHeight: 1.35 }}>
                          {milestone.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Custom Timeline Event */}
                <div style={{ background: "rgba(26,29,41,0.01)", border: "1px dashed var(--ink-30)", padding: "0.75rem", borderRadius: "var(--r-s)" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--ink-72)", display: "block", marginBottom: "0.4rem" }}>Log Custom Milestone Event</span>
                  <input 
                    type="text" 
                    className="input" 
                    style={{ height: "28px", fontSize: "0.75rem", marginBottom: "0.35rem" }}
                    placeholder="Event Title (e.g. Phone Screen Passed)"
                    value={customMilestoneTitle}
                    onChange={(e) => setCustomMilestoneTitle(e.target.value)}
                  />
                  <input 
                    type="text" 
                    className="input" 
                    style={{ height: "28px", fontSize: "0.75rem", marginBottom: "0.4rem" }}
                    placeholder="Description (Optional details)"
                    value={customMilestoneDesc}
                    onChange={(e) => setCustomMilestoneDesc(e.target.value)}
                  />
                  <button 
                    className="btn btn-ghost" 
                    style={{ width: "100%", height: "28px", fontSize: "0.75rem", justifyContent: "center" }}
                    onClick={handleAddCustomMilestone}
                    disabled={!customMilestoneTitle.trim()}
                  >
                    Log Event to Timeline
                  </button>
                </div>
              </div>

            </div>

            {/* Drawer Footer */}
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(26,29,41,0.015)" }}>
              <button 
                className="btn btn-ghost" 
                style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.2)", fontSize: "0.75rem", padding: "0.35rem 0.75rem", borderRadius: "4px" }}
                onClick={() => setPendingDeleteApp(selectedApp)}
              >
                Delete Tracker Entry
              </button>
              <button 
                className="btn btn-primary" 
                style={{ fontSize: "0.75rem", padding: "0.35rem 1rem", color: "#fff", borderRadius: "4px" }}
                onClick={() => setDrawerOpen(false)}
              >
                Done
              </button>
            </div>

          </div>
        )}
      </div>

      {/* Create Manual Modal */}
      {isManualModalOpen && (
        <div className="modal-overlay" onClick={() => setIsManualModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ borderRadius: "var(--r-s)", maxWidth: "460px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.4rem", fontFamily: "var(--font-space), monospace" }}>
              CREATE_NEW_APPLICATION
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--ink-55)", marginBottom: "1.25rem" }}>
              Add a manual target job to organize your scheduling and files.
            </p>
            <form onSubmit={handleCreateManualApplication} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="field">
                <label htmlFor="manual-company" style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-55)" }}>Company Name</label>
                <input 
                  id="manual-company"
                  className="input"
                  required
                  placeholder="e.g. Stripe"
                  value={manualCompany}
                  onChange={(e) => setManualCompany(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="manual-role" style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-55)" }}>Role Title</label>
                <input 
                  id="manual-role"
                  className="input"
                  required
                  placeholder="e.g. Senior Frontend Architect"
                  value={manualRole}
                  onChange={(e) => setManualRole(e.target.value)}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="field">
                  <label htmlFor="manual-status" style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-55)" }}>Initial Status</label>
                  <select 
                    id="manual-status"
                    className="input"
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value)}
                  >
                    {TRACKER_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="manual-priority" style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-55)" }}>Priority</label>
                  <select 
                    id="manual-priority"
                    className="input"
                    value={manualPriority}
                    onChange={(e) => setManualPriority(e.target.value as Application["priority"])}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="manual-tags" style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-55)" }}>Tags (comma separated)</label>
                <input 
                  id="manual-tags"
                  className="input"
                  placeholder="e.g. remote, react, fintech"
                  value={manualTagsInput}
                  onChange={(e) => setManualTagsInput(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsManualModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-white">
                  Create Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingDeleteApp && (
        <div className="modal-overlay" onClick={() => setPendingDeleteApp(null)} style={{ zIndex: 2200 }}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              borderRadius: "var(--r-s)",
              maxWidth: "420px",
              padding: "1.25rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.8rem", alignItems: "flex-start" }}>
              <div
                aria-hidden="true"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  flex: "0 0 34px",
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "#ef4444",
                  fontWeight: 800,
                }}
              >
                !
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Delete tracker entry?</h3>
                <p style={{ margin: "0.35rem 0 0", color: "var(--ink-65)", fontSize: "0.84rem", lineHeight: 1.5 }}>
                  This will remove {pendingDeleteApp.company} - {pendingDeleteApp.role}, including notes, interviews, and attachments.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setPendingDeleteApp(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => handleDeleteApplication(pendingDeleteApp.id)}
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  borderColor: "#ef4444",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Compare Action Bar */}
      {compareSelected.size >= 2 && (
        <div className="compare-action-bar" role="status">
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            {compareSelected.size} jobs selected
          </span>
          <button className="btn btn-ghost" style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }} onClick={clearCompareSelection}>
            Clear
          </button>
          <button className="btn btn-primary text-white" style={{ fontSize: "0.8rem", padding: "0.4rem 1rem" }} onClick={goToCompare}>
            Compare →
          </button>
        </div>
      )}

      {toast && (
        <div className={`tracker-toast ${toast.tone}`} role="status" aria-live="polite">
          <div className="tracker-toast-dot" aria-hidden="true" />
          <div style={{ minWidth: 0 }}>
            <strong>{toast.title}</strong>
            {toast.description && <span>{toast.description}</span>}
          </div>
          <button type="button" aria-label="Dismiss message" onClick={() => setToast(null)}>
            x
          </button>
        </div>
      )}

      {/* Styled inline overrides for custom tracker classes */}
      <style>{`
        .compare-action-bar {
          position: fixed;
          bottom: 1.5rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 2400;
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.7rem 1rem;
          border-radius: var(--r-m, 12px);
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--ink);
          box-shadow: 0 16px 40px rgba(26, 29, 41, 0.18);
          animation: compare-bar-in 0.2s ease-out;
        }
        @keyframes compare-bar-in {
          from {
            opacity: 0;
            transform: translate(-50%, 10px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .tracker-toast {
          position: fixed;
          top: 1rem;
          right: 1rem;
          z-index: 2500;
          width: min(390px, calc(100vw - 2rem));
          display: grid;
          grid-template-columns: 10px 1fr 28px;
          gap: 0.75rem;
          align-items: flex-start;
          padding: 0.85rem 0.9rem;
          border-radius: var(--r-s);
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--ink);
          box-shadow: 0 16px 40px rgba(26, 29, 41, 0.16);
          animation: toast-in 0.18s ease-out;
        }
        .tracker-toast strong {
          display: block;
          font-size: 0.84rem;
          line-height: 1.25;
        }
        .tracker-toast span {
          display: block;
          margin-top: 0.18rem;
          color: var(--ink-65);
          font-size: 0.76rem;
          line-height: 1.4;
        }
        .tracker-toast button {
          width: 28px;
          height: 28px;
          border: 0;
          background: transparent;
          color: var(--ink-45);
          cursor: pointer;
          border-radius: 50%;
          font-size: 1rem;
          line-height: 1;
        }
        .tracker-toast button:hover {
          background: var(--ink-06);
          color: var(--ink);
        }
        .tracker-toast-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-top: 0.2rem;
          background: var(--iris);
        }
        .tracker-toast.success .tracker-toast-dot {
          background: #10b981;
        }
        .tracker-toast.error .tracker-toast-dot {
          background: #ef4444;
        }
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .kanban-lane-new {
          background: rgba(26, 29, 41, 0.015);
          border: 1.5px dashed var(--ink-12);
          border-radius: var(--r-s);
          padding: 0.75rem;
          min-height: 550px;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          transition: all 0.2s ease;
        }
        .kanban-lane-new.dragover {
          background: var(--iris-08) !important;
          border-color: var(--iris) !important;
        }
        .kanban-card-new {
          background: var(--surface);
          border: 1px solid var(--ink-12);
          border-radius: calc(var(--r-s) - 2px);
          cursor: grab;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        }
        .kanban-card-new:hover {
          border-color: var(--ink-30);
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(26,29,41,0.05);
        }
        .kanban-card-new:active {
          cursor: grabbing;
        }
        .input-inline {
          background: transparent;
          border: none;
          outline: none;
          padding: 0;
          border-bottom: 1.5px solid transparent;
          transition: border-bottom-color 0.15s;
        }
        .input-inline:focus {
          border-bottom-color: var(--iris-30);
        }
        .drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(26,29,41,0.25);
          backdrop-filter: blur(2px);
          z-index: 999;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.25s ease;
        }
        .drawer-overlay.active {
          opacity: 1;
          pointer-events: auto;
        }
        .drawer-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          background: var(--surface);
          border-left: 1px solid var(--border);
          box-shadow: -4px 0 24px rgba(26,29,41,0.06);
          z-index: 1000;
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .drawer-panel.open {
          transform: translateX(0);
        }
        .notion-textarea {
          width: 100%;
          padding: 0.65rem;
          font-family: inherit;
          font-size: 0.82rem;
          line-height: 1.5;
          color: var(--ink);
          border: 1px solid var(--ink-12);
          border-radius: var(--r-s);
          resize: vertical;
          outline: none;
          background: rgba(26,29,41,0.005);
          transition: border-color 0.15s;
        }
        .notion-textarea:focus {
          border-color: var(--iris);
          background: var(--surface);
        }
        .dropzone {
          transition: border-color 0.15s, background-color 0.15s;
        }
        .dropzone:hover {
          border-color: var(--iris-deep) !important;
          background: rgba(78,63,216,0.03) !important;
        }
        .dropzone.uploading {
          border-color: var(--iris) !important;
          background: rgba(78,63,216,0.06) !important;
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(26,29,41,0.4);
          backdrop-filter: blur(2px);
          z-index: 1100;
          display: grid;
          place-items: center;
          padding: 1.5rem;
        }
        .modal-card {
          background: var(--surface);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-card);
          padding: 1.75rem;
          width: 100%;
          position: relative;
          animation: modal-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes modal-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}