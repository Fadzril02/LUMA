import React, { useState, useEffect } from "react";
import { Calendar, User, ArrowRight, Clock, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "../../components/ui";
import { db } from "../../../lib/supabase";

interface AdvisingLog {
  id: string;
  student_matric_no: string;
  advisor_staff_id: string;
  session_date: string;
  notes: string;
  action_item?: string | null;
  follow_up_date?: string | null;
  created_at: string;
}

export function AdvisingNotesView() {
  const [logs, setLogs] = useState<AdvisingLog[]>([]);
  const [advisorNames, setAdvisorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchAdvisingNotes = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch advising_logs for the logged-in student, newest first.
        // Rely exclusively on RLS for visibility and access control.
        const { data: logsData, error: logsError } = await db
          .from("advising_logs")
          .select("*")
          .order("session_date", { ascending: false });

        if (logsError) {
          throw logsError;
        }

        // 2. Fetch advisor names for display
        try {
          const { data: advisorsData } = await db
            .from("advisors")
            .select("staff_id, name");

          if (advisorsData && isMounted) {
            const map: Record<string, string> = {};
            advisorsData.forEach((adv: any) => {
              if (adv.staff_id) {
                map[adv.staff_id] = adv.name || adv.staff_id;
              }
            });
            setAdvisorNames(map);
          }
        } catch (advErr) {
          console.warn("[AdvisingNotesView] Warning fetching advisor names:", advErr);
        }

        if (isMounted) {
          setLogs(logsData || []);
        }
      } catch (err: any) {
        console.error("[AdvisingNotesView] Error fetching advising notes:", err);
        if (isMounted) {
          setError(err.message || "Failed to load advising notes.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAdvisingNotes();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header and Helper Text */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900 shadow-sm">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Advising Notes</h2>
            <p className="text-xs text-gray-500">
              Notes shared by your advisor after each advising meeting, including agreed next steps.
            </p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-gray-200 text-gray-500 text-xs font-medium">
          <Loader2 className="w-4 h-4 mr-2 animate-spin text-blue-900" />
          Loading advising notes...
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center text-rose-700 text-sm">
          {error}
        </div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-200">
          <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto text-gray-400 mb-3">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800">No advising notes yet</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            No advising notes yet. Your advisor will share notes after your meetings.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const advisorName = advisorNames[log.advisor_staff_id] || log.advisor_staff_id || "Academic Advisor";
            const formattedDate = new Date(log.session_date).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            });

            return (
              <Card key={log.id} className="bg-white border border-gray-200 overflow-hidden shadow-xs hover:shadow-sm transition-shadow">
                <CardHeader className="bg-gray-50/60 border-b border-gray-100 py-3.5 px-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
                      <User className="w-4 h-4 text-blue-800" />
                      <span>{advisorName}</span>
                    </div>
                    <span className="text-gray-300">•</span>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>{formattedDate}</span>
                    </div>
                  </div>
                  {log.follow_up_date && (
                    <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-800 border-blue-200">
                      Follow-up: {new Date(log.follow_up_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Discussion Notes</h4>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {log.notes}
                    </p>
                  </div>

                  {log.action_item && (
                    <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-lg flex items-start gap-3">
                      <div className="w-6 h-6 rounded-md bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0 mt-0.5">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-amber-900 uppercase tracking-wide block">
                          Next step
                        </span>
                        <p className="text-sm text-amber-800 mt-0.5 font-medium leading-snug">
                          {log.action_item}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
