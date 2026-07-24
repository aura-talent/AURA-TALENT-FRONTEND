import { supabase } from "./supabaseClient";
import { api, type Application } from "./api";

export interface CandidateNotification {
  id: string;
  type: "interview" | "bounty" | "job_match" | "system";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link: string;
}

export async function fetchCandidateNotifications(userId: string): Promise<CandidateNotification[]> {
  const notifications: CandidateNotification[] = [];

  try {
    // 1. Fetch upcoming interviews from applications. These live in the
    // FastAPI backend's own database, not Supabase — go through the same
    // proxied endpoint the tracker/dashboard already use, not a direct
    // supabase.from("applications") query (that table doesn't exist here).
    const apps = await api.listApplications().catch(() => null);

    if (apps) {
      for (const app of apps as Application[]) {
        if (app.rounds) {
          for (const r of app.rounds) {
            if (r.scheduled_at) {
              const scheduledTime = new Date(r.scheduled_at).getTime();
              const isUpcoming = scheduledTime >= Date.now();
              const company = app.company_name || app.company || "Company";
              const roleTitle = app.job_title || app.role || "Role";
              notifications.push({
                id: `int-${app.id}-${r.name || "round"}`,
                type: "interview",
                title: isUpcoming ? "Upcoming Interview Scheduled" : "Interview Round Recorded",
                message: `${r.name || "Interview"} with ${company} for ${roleTitle}`,
                timestamp: new Date(r.scheduled_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                read: false,
                link: "/tracker",
              });

            }
          }
        }
      }
    }

    // 2. Fetch bounty submissions & results
    const { data: submissions } = await supabase
      .from("bounty_submissions")
      .select("id, bounty_id, submitted_at, bounties(id, title)")
      .eq("candidate_user_id", userId);

    if (submissions && submissions.length > 0) {
      const subIds = submissions.map((s) => s.id);
      const { data: results } = await supabase
        .from("bounty_submission_results")
        .select("*")
        .in("submission_id", subIds);

      const resultMap = new Map((results ?? []).map((r) => [r.submission_id as string, r]));

      for (const sub of submissions) {
        const bountyObj = sub.bounties as unknown as { id: string; title: string } | null;
        const bountyTitle = bountyObj?.title || "Bounty";
        const result = resultMap.get(sub.id);

        if (result?.status === "winner") {
          notifications.push({
            id: `bounty-win-${sub.id}`,
            type: "bounty",
            title: "🏆 Bounty Winner Announcement!",
            message: `Congratulations! You won Rank ${result.rank} in "${bountyTitle}".`,
            timestamp: new Date(result.decided_at || sub.submitted_at).toLocaleDateString(),
            read: false,
            link: `/bounties/${sub.bounty_id}`,
          });
        } else {
          notifications.push({
            id: `bounty-sub-${sub.id}`,
            type: "bounty",
            title: "Bounty Submission Received",
            message: `Your entry for "${bountyTitle}" has been submitted and is under review.`,
            timestamp: new Date(sub.submitted_at).toLocaleDateString(),
            read: true,
            link: `/bounties/${sub.bounty_id}`,
          });
        }
      }
    }
  } catch (err) {
    console.error("Failed to load notifications:", err);
  }

  // Sort newest first
  return notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
