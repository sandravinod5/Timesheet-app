"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Square,
  Target,
  TrendingUp
} from "lucide-react";
import { fetchAction } from "@/lib/client";
import { showSystemNotification } from "@/lib/notifications";
import type { ActivityTypesData, OverviewData, Task, TimesheetsData } from "@/lib/types";
import { formatDuration, formatHours, statusBadgeClass } from "@/lib/utils";
import { EmptyState, LoadingState, OverviewSkeleton, Panel } from "@/components/ui";
import { KpiModal } from "@/components/kpi-modal";
import { useToast } from "@/components/toast-provider";
import { TimerModal } from "@/components/timer-modal";

function formatClockTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  const match = value.match(/\b(\d{2}:\d{2})/);
  return match ? match[1] : value;
}

function formatPeriodLabel(fromDate?: string, toDate?: string) {
  if (!fromDate || !toDate) {
    return "Current period";
  }

  return `${fromDate} to ${toDate}`;
}

export function OverviewScreen() {
  const { showToast } = useToast();
  const [data, setData] = useState<OverviewData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recent, setRecent] = useState<TimesheetsData | null>(null);
  const [activityTypes, setActivityTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [kpiType, setKpiType] = useState<string | null>(null);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [recentTimesheetsOpen, setRecentTimesheetsOpen] = useState(false);
  const [recentVisitsOpen, setRecentVisitsOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    setRecentError(null);

    const [overviewResult, tasksResult, timesheetsResult, activityTypesResult] = await Promise.allSettled([
      fetchAction<OverviewData>("overview"),
      fetchAction<{ tasks: Task[] }>("tasks"),
      fetchAction<TimesheetsData>("timesheets"),
      fetchAction<ActivityTypesData>("activity_types")
    ]);

    if (overviewResult.status === "fulfilled") {
      setData(overviewResult.value.data);
    } else {
      setData(null);
      setError(overviewResult.reason instanceof Error ? overviewResult.reason.message : "Overview could not be loaded.");
    }

    if (tasksResult.status === "fulfilled") {
      setTasks(tasksResult.value.data.tasks);
    } else {
      setTasks([]);
    }

    if (timesheetsResult.status === "fulfilled") {
      setRecent(timesheetsResult.value.data);
    } else {
      setRecent(null);
      setRecentError(
        timesheetsResult.reason instanceof Error
          ? timesheetsResult.reason.message
          : "Recent timesheets could not be loaded."
      );
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

  useEffect(() => {
    if (!data?.runningTimer?.fromTime) {
      setElapsed(0);
      return;
    }

    const run = () => {
      const start = new Date(data.runningTimer?.fromTime || "").getTime();
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };

    run();
    const timer = window.setInterval(run, 1000);
    return () => window.clearInterval(timer);
  }, [data?.runningTimer?.fromTime]);

  const trackedRatio = useMemo(() => {
    if (!data?.monthSummary.expectedHours) {
      return 0;
    }

    return Math.min(100, (data.monthSummary.trackedHours / data.monthSummary.expectedHours) * 100);
  }, [data]);

  const recentTimesheets = useMemo(() => {
    return recent?.timesheets?.filter((item) => !item.isRunning).slice(0, 5) ?? [];
  }, [recent]);

  const recentClientVisits = useMemo(() => {
    return data?.recentClientVisits ?? [];
  }, [data]);

  const startTimer = async (taskId: string, activityType: string) => {
    try {
      await fetchAction("start_timer", { task: taskId, activity_type: activityType }, "POST");
      setShowTimerModal(false);
      showToast({
        title: "Timer started",
        message: "Your timer is now running."
      });

      if (document.visibilityState === "hidden") {
        await showSystemNotification({
          title: "Timer started",
          body: "Your timesheet timer is now running.",
          tag: "timer-started",
          url: "/timesheet"
        });
      }

      await load();
    } catch (err) {
      showToast({
        title: "Unable to start timer",
        message: err instanceof Error ? err.message : "Please try again.",
        variant: "error"
      });
    }
  };

  const stopTimer = async () => {
    try {
      await fetchAction("stop_timer", undefined, "POST");
      showToast({
        title: "Timer stopped",
        message: "Saved to draft entries."
      });

      if (document.visibilityState === "hidden") {
        await showSystemNotification({
          title: "Timer stopped",
          body: "The timer was saved to your draft entries.",
          tag: "timer-stopped",
          url: "/timesheet"
        });
      }

      await load();
    } catch (err) {
      showToast({
        title: "Unable to stop timer",
        message: err instanceof Error ? err.message : "Please try again.",
        variant: "error"
      });
    }
  };

  if (loading) {
    return (
      <>
        <LoadingState label="Loading overview..." />
        <OverviewSkeleton />
      </>
    );
  }

  if (!data) {
    return <EmptyState title="Overview unavailable" copy={error || "The dashboard data could not be loaded."} />;
  }

  const timerRunning = Boolean(data.runningTimer);
  const kpis = [
    {
      key: "assigned",
      label: "Assigned",
      value: data.kpis.assigned,
      icon: Target,
      gradientClass: "primary-gradient"
    },
    {
      key: "pending",
      label: "Pending",
      value: data.kpis.pending,
      icon: AlertCircle,
      gradientClass: "warning-gradient"
    },
    {
      key: "completed",
      label: "Completed",
      value: data.kpis.completed,
      icon: CheckCircle2,
      gradientClass: "success-gradient"
    },
    {
      key: "overdue",
      label: "Overdue",
      value: data.kpis.overdue,
      icon: TrendingUp,
      gradientClass: "danger-gradient"
    }
  ];

  return (
    <>
      <div className="screen-stack">
        <Panel>
          <div className="panel-title-row">
            <div>
              <h2 className="panel-title">Overview</h2>
              <p className="panel-subtitle">Your live timer, monthly target, and task momentum.</p>
            </div>
          </div>

          <div className="hero-timer">
            <div className={`timer-ring-wrap ${timerRunning ? "timer-ring-wrap--running" : ""}`}>
              <div className="timer-ring-outer">
                <div className="timer-ring-inner">
                  <div className="timer-copy">
                    <p className="eyebrow">{timerRunning ? "Live" : "Idle"}</p>
                    <p className="timer-value">
                      {timerRunning ? formatDuration(elapsed) : "00:00:00"}
                    </p>
                    {timerRunning ? (
                      <>
                        <p className="timer-meta">{data.runningTimer?.taskSubject}</p>
                        <p className="panel-subtitle" style={{ marginTop: "0.25rem", fontSize: "0.8rem" }}>
                          {data.runningTimer?.customerName || "No customer"}
                          {data.runningTimer?.activityType ? ` | ${data.runningTimer.activityType}` : ""}
                        </p>
                      </>
                    ) : (
                      <p className="timer-meta">Tap + to begin</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="timer-fab-row">
              {timerRunning ? (
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
        </Panel>

        <Panel>
          <div className="panel-title-row">
            <div>
              <h2 className="panel-title">This Month</h2>
              <p className="panel-subtitle">
                {formatHours(data.monthSummary.trackedHours)} tracked vs {formatHours(data.monthSummary.expectedHours)} expected at 8h/day
              </p>
            </div>
            <div className="metric-icon info-gradient">
              <Clock3 size={18} />
            </div>
          </div>

          <div className="metric-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginBottom: "1rem" }}>
            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-label">Tracked Hours</span>
                <span className="metric-icon primary-gradient">
                  <Clock3 size={18} />
                </span>
              </div>
              <span className="metric-value">{formatHours(data.monthSummary.trackedHours)}</span>
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-label">Expected Hours (8h/day)</span>
                <span className="metric-icon success-gradient">
                  <Target size={18} />
                </span>
              </div>
              <span className="metric-value">{formatHours(data.monthSummary.expectedHours)}</span>
            </article>
          </div>

          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${trackedRatio}%` }} />
          </div>
        </Panel>

        <Panel className="full-width">
          <div className="panel-title-row">
            <div>
              <h2 className="panel-title">Task KPIs</h2>
              <p className="panel-subtitle">Tap any card to open the matching task set.</p>
            </div>
          </div>
          <div className="kpi-grid">
            {kpis.map((item) => {
              const Icon = item.icon;

              return (
                <button key={item.key} className="kpi-card" onClick={() => setKpiType(item.key)}>
                  <div className="kpi-top">
                    <p className="kpi-label">{item.label}</p>
                    <span className={`kpi-icon ${item.gradientClass}`}>
                      <Icon size={18} />
                    </span>
                  </div>
                  <span className="kpi-value">{item.value}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel className="full-width">
          <button
            type="button"
            className="collapsible-header"
            onClick={() => setRecentTimesheetsOpen((current) => !current)}
            aria-expanded={recentTimesheetsOpen}
          >
            <div className="collapsible-header-copy">
              <h2 className="panel-title">Recent Timesheets</h2>
              <p className="panel-subtitle">
                Latest completed time entries for {formatPeriodLabel(data.period.fromDate, data.period.toDate)}.
              </p>
            </div>
            <div className="collapsible-header-meta">
              <span className="collapsible-count">{recentTimesheets.length}</span>
              <ChevronDown size={18} className={`collapsible-chevron ${recentTimesheetsOpen ? "is-open" : ""}`} />
            </div>
          </button>

          {recentTimesheetsOpen ? (
            <div className="list-stack collapsible-body">
              {recentError ? (
                <EmptyState title="Recent timesheets unavailable" copy={recentError} />
              ) : recentTimesheets.length === 0 ? (
                <EmptyState title="No recent timesheets" copy="There are no completed entries in this period yet." />
              ) : (
                recentTimesheets.map((entry) => (
                  <article key={entry.timesheetDetailId} className="list-card">
                    <div className="list-head">
                      <div className="list-head-copy">
                        <h4 className="list-title">{entry.taskSubject}</h4>
                        <p className="panel-subtitle">{entry.customerName || "No customer"}</p>
                      </div>
                      <span className={`badge ${statusBadgeClass("Completed", 0)}`}>
                        {formatHours(entry.hours)}
                      </span>
                    </div>
                    <div className="muted-row time-range-row" style={{ marginTop: "0.7rem" }}>
                      {formatClockTime(entry.fromTime)} to {formatClockTime(entry.toTime)}
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}
        </Panel>

        <Panel className="full-width">
          <button
            type="button"
            className="collapsible-header"
            onClick={() => setRecentVisitsOpen((current) => !current)}
            aria-expanded={recentVisitsOpen}
          >
            <div className="collapsible-header-copy">
              <h2 className="panel-title">Recent Client Visits</h2>
              <p className="panel-subtitle">
                Client visit time entries for {formatPeriodLabel(data.period.fromDate, data.period.toDate)}.
              </p>
            </div>
            <div className="collapsible-header-meta">
              <span className="collapsible-count">{recentClientVisits.length}</span>
              <ChevronDown size={18} className={`collapsible-chevron ${recentVisitsOpen ? "is-open" : ""}`} />
            </div>
          </button>

          {recentVisitsOpen ? (
            <div className="list-stack collapsible-body">
              {recentClientVisits.length === 0 ? (
                <EmptyState title="No client visits" copy="No visit-type time entries were found in this period." />
              ) : (
                recentClientVisits.map((entry) => (
                  <article key={entry.timesheetDetailId} className="list-card">
                    <div className="list-head">
                      <div className="list-head-copy">
                        <h4 className="list-title">{entry.customerName || entry.taskSubject || "Client Visit"}</h4>
                        <p className="panel-subtitle">{entry.taskSubject || "Visit activity"}</p>
                      </div>
                      <span className="badge badge-progress">{formatHours(entry.hours)}</span>
                    </div>
                    <div className="muted-row list-meta-wrap" style={{ marginTop: "0.7rem" }}>
                      <span>{entry.projectName || "No project"}</span>
                      <span>{entry.activityType || "Visit"}</span>
                    </div>
                    <div className="muted-row time-range-row" style={{ marginTop: "0.45rem" }}>
                      {formatClockTime(entry.fromTime)} to {entry.toTime ? formatClockTime(entry.toTime) : "Running"}
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}
        </Panel>
      </div>

      {kpiType ? <KpiModal type={kpiType} tasks={tasks} onClose={() => setKpiType(null)} /> : null}
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
