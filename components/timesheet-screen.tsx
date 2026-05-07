"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAction } from "@/lib/client";
import type { ActivityTypesData, Task, TimesheetsData } from "@/lib/types";
import { formatHours } from "@/lib/utils";
import { Clock3, Square } from "lucide-react";
import { EmptyState, InputShell, LoadingState, Panel } from "@/components/ui";
import { TimerModal } from "@/components/timer-modal";

export function TimesheetScreen() {
  const [payload, setPayload] = useState<TimesheetsData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activityTypes, setActivityTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showTimerModal, setShowTimerModal] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);

    const [timesheetsResult, tasksResult, activityTypesResult] = await Promise.allSettled([
      fetchAction<TimesheetsData>("timesheets"),
      fetchAction<{ tasks: Task[] }>("tasks"),
      fetchAction<ActivityTypesData>("activity_types")
    ]);

    if (timesheetsResult.status === "fulfilled") {
      setPayload(timesheetsResult.value.data);
    } else {
      setPayload(null);
      setError(
        timesheetsResult.reason instanceof Error
          ? timesheetsResult.reason.message
          : "Timesheet data could not be loaded."
      );
    }

    if (tasksResult.status === "fulfilled") {
      setTasks(tasksResult.value.data.tasks);
    } else {
      setTasks([]);
    }

    if (activityTypesResult.status === "fulfilled") {
      setActivityTypes(activityTypesResult.value.data.activityTypes);
    } else {
      setActivityTypes([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const lastWorkedId = useMemo(() => {
    const entry = payload?.timesheets?.find((e) => !e.isRunning);
    return entry?.timesheetDetailId ?? null;
  }, [payload?.timesheets]);

  const filteredTimesheets = useMemo(() => {
    if (!payload?.timesheets) {
      return [];
    }

    return payload.timesheets.filter((entry) =>
      [entry.taskSubject, entry.customerName, entry.projectName, entry.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [payload?.timesheets, search]);

  const startTimer = async (taskId: string, activityType: string) => {
    await fetchAction("start_timer", { task: taskId, activity_type: activityType }, "POST");
    setShowTimerModal(false);
    await load();
  };

  const stopTimer = async () => {
    await fetchAction("stop_timer", undefined, "POST");
    await load();
  };

  if (loading) {
    return <LoadingState label="Loading timesheets..." />;
  }

  if (!payload) {
    return <EmptyState title="Timesheets unavailable" copy={error || "No timesheet data was returned from the API."} />;
  }

  return (
    <>
      <div className="screen-stack screen-stack--single">
        <Panel>
          <div className="panel-title-row panel-title-row-stack">
            <div>
              <h2 className="panel-title">Timesheets</h2>
              <p className="panel-subtitle">Manage your running timer and review time entries.</p>
            </div>
            <div className="button-row button-row-end">
              {payload.runningTimer ? (
                <button className="timer-action-button timer-action-button-stop" onClick={() => void stopTimer()}>
                  <Square size={18} />
                  Stop Timer
                </button>
              ) : (
                <button className="timer-action-button timer-action-button-start" onClick={() => setShowTimerModal(true)}>
                  <Clock3 size={18} />
                  Start Timer
                </button>
              )}
            </div>
          </div>

          <div className="metric-grid metric-grid--timesheet">
            <article className="metric-card">
              <span className="metric-label">Entries</span>
              <span className="metric-value">{payload.summary.entries}</span>
            </article>
            <article className="metric-card">
              <span className="metric-label">Completed</span>
              <span className="metric-value">{payload.summary.completedEntries}</span>
            </article>
            <article className="metric-card">
              <span className="metric-label">Hours</span>
              <span className="metric-value">{formatHours(payload.summary.totalHours)}</span>
            </article>
          </div>
        </Panel>

        <Panel>
          <div className="search-row" style={{ marginBottom: "1rem" }}>
            <InputShell className="search-field">
              <Search size={18} color="var(--muted)" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search timesheets"
              />
            </InputShell>
          </div>

          <div className="list-stack">
            {filteredTimesheets.length === 0 ? (
              <EmptyState title="No timesheets found" copy="Start a timer or change the current filter." />
            ) : (
              filteredTimesheets.map((entry) => {
                const isLastWorked = entry.timesheetDetailId === lastWorkedId;
                return (
                  <article key={entry.timesheetDetailId} className={`list-card ${isLastWorked ? "list-card--highlighted" : ""}`}>
                    {isLastWorked && (
                      <div className="last-worked-badge">
                        <Clock3 size={11} />
                        Last worked on
                      </div>
                    )}
                    <div className="list-head">
                      <div className="list-head-copy">
                        <h3 className="list-title">{entry.taskSubject}</h3>
                        <p className="panel-subtitle">{entry.customerName || "No customer"}</p>
                      </div>
                      <span className={`badge ${entry.isRunning ? "badge-progress" : "badge-complete"}`}>
                        {entry.isRunning ? "Running" : formatHours(entry.hours)}
                      </span>
                    </div>
                    <p className="list-description task-supporting-copy">{entry.projectName || "No project"}</p>
                    <div className="muted-row time-range-row" style={{ marginTop: "0.8rem" }}>
                      {entry.fromTime} {entry.toTime ? `to ${entry.toTime}` : "to now"}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </Panel>
      </div>

      <TimerModal
        open={showTimerModal}
        tasks={tasks}
        activityTypes={activityTypes}
        onClose={() => setShowTimerModal(false)}
        onStart={startTimer}
      />
    </>
  );
}
