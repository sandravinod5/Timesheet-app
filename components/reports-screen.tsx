"use client";

import {
  BarChart3,
  Clock3,
  MapPin,
  PieChart,
  TimerReset,
  TrendingUp
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchAction } from "@/lib/client";
import { formatLocalDate, formatLocalTime, getElapsedSeconds, getLocalDateInputValue } from "@/lib/datetime";
import type { HoursByDay, KpiCardsData, ReportsData, VisitByCustomer } from "@/lib/types";
import { formatDuration, formatHours } from "@/lib/utils";
import { EmptyState, LoadingState, Panel } from "@/components/ui";

function todayStr() {
  return getLocalDateInputValue();
}

function firstOfMonthStr() {
  const d = new Date();
  return getLocalDateInputValue(new Date(d.getFullYear(), d.getMonth(), 1));
}

function colorClass(color?: string) {
  switch (color) {
    case "green":
      return "success-gradient";
    case "blue":
      return "primary-gradient";
    case "orange":
      return "warning-gradient";
    case "red":
      return "danger-gradient";
    case "teal":
      return "info-gradient";
    case "gray":
      return "primary-gradient";
    case "purple":
    default:
      return "primary-gradient";
  }
}

function formatDateLabel(value: string) {
  const formatted = formatLocalDate(value);
  return formatted || value;
}

function formatVisitDateLabel(value: string) {
  return formatLocalDate(value) || value;
}

function formatTimerClock(value?: string | null, utcValue?: string | null) {
  return formatLocalTime(value, utcValue) || "-";
}

function ReportKpiCard({
  label,
  value,
  color,
  subLabel,
  deltaLabel,
  alert
}: {
  label: string;
  value: number;
  color: string;
  subLabel?: string;
  deltaLabel?: string;
  alert?: boolean;
}) {
  return (
    <article className={`report-kpi-card ${alert ? "report-kpi-card--alert" : ""}`}>
      <div className="report-kpi-top">
        <p className="kpi-label">{label}</p>
        <span className={`kpi-icon ${colorClass(color)}`}>
          <TrendingUp size={18} />
        </span>
      </div>
      <span className="report-kpi-value">{Number.isInteger(value) ? value : value.toFixed(1)}</span>
      {subLabel ? <p className="report-kpi-copy">{subLabel}</p> : null}
      {deltaLabel ? <p className="report-kpi-delta">{deltaLabel}</p> : null}
    </article>
  );
}

function HoursChart({ rows }: { rows: HoursByDay[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No hours logged yet" copy="There are no day-level time entries for this period." />;
  }

  const max = Math.max(...rows.map((row) => row.hours), 0.1);

  return (
    <div className="report-bar-chart">
      {rows.map((row) => (
        <div key={row.date} className="report-bar-row">
          <div className="report-bar-meta">
            <span className="report-bar-label">{formatDateLabel(row.date)}</span>
            <span className="report-bar-value">{formatHours(row.hours)}</span>
          </div>
          <div className="progress-track report-bar-track">
            <div
              className="progress-fill report-bar-fill"
              style={{ width: `${Math.max(8, (row.hours / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskStatusChart({ kpis }: { kpis: KpiCardsData["kpis"] }) {
  const total =
    kpis.tasksCompleted.value +
    kpis.tasksInProgress.value +
    kpis.tasksPending.value +
    kpis.tasksOverdue.value;

  if (total <= 0) {
    return <EmptyState title="No task data" copy="There are no task KPIs available for this period." />;
  }

  const segments = [
    { key: "completed", label: kpis.tasksCompleted.label, value: kpis.tasksCompleted.value, color: "var(--success)" },
    { key: "in-progress", label: kpis.tasksInProgress.label, value: kpis.tasksInProgress.value, color: "var(--primary)" },
    { key: "pending", label: kpis.tasksPending.label, value: kpis.tasksPending.value, color: "var(--warning)" },
    { key: "overdue", label: kpis.tasksOverdue.label, value: kpis.tasksOverdue.value, color: "var(--danger)" }
  ].filter((segment) => segment.value > 0);

  const gradients = segments
    .map((segment, index) => {
      const start = segments
        .slice(0, index)
        .reduce((acc, item) => acc + (item.value / total) * 100, 0);
      const end = start + (segment.value / total) * 100;
      return `${segment.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="report-status-chart">
      <div className="report-status-ring" style={{ background: `conic-gradient(${gradients})` }}>
        <div className="report-status-ring-inner">
          <PieChart size={20} />
          <strong>{total}</strong>
          <span>Tasks</span>
        </div>
      </div>
      <div className="report-status-legend">
        {segments.map((segment) => (
          <div key={segment.key} className="report-status-row">
            <span className="report-status-dot" style={{ backgroundColor: segment.color }} />
            <span className="report-status-label">{segment.label}</span>
            <span className="report-status-value">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskStatusChartLoading() {
  return (
    <div className="report-status-chart report-status-chart--loading" aria-hidden="true">
      <div className="report-status-ring report-status-ring--loading">
        <div className="report-status-ring-inner report-status-ring-inner--loading">
          <div className="report-status-loading-core" />
        </div>
      </div>
      <div className="report-status-legend">
        <div className="report-status-row report-status-row--loading">
          <span className="report-status-dot skeleton-block" />
          <span className="report-status-loading-line" />
          <span className="report-status-loading-value" />
        </div>
        <div className="report-status-row report-status-row--loading">
          <span className="report-status-dot skeleton-block" />
          <span className="report-status-loading-line" />
          <span className="report-status-loading-value" />
        </div>
        <div className="report-status-row report-status-row--loading">
          <span className="report-status-dot skeleton-block" />
          <span className="report-status-loading-line" />
          <span className="report-status-loading-value" />
        </div>
      </div>
    </div>
  );
}

function normalizeHoursByDay(rows?: Array<Record<string, string | number | boolean | null>>): HoursByDay[] {
  return (rows || []).map((row) => ({
    date: String(row.date || row.work_date || ""),
    hours: Number(row.hours || row.total_hours || 0)
  }));
}

function VisitBreakdown({ rows }: { rows: VisitByCustomer[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (rows.length === 0) {
    return <EmptyState title="No visits" copy="No visits recorded for this period." />;
  }

  return (
    <div className="visit-breakdown">
      {rows.map((row) => {
        const isOpen = expandedId === row.customerId;
        return (
          <div key={row.customerId} className="visit-breakdown-customer">
            <button
              type="button"
              className="visit-breakdown-row"
              onClick={() => setExpandedId(isOpen ? null : row.customerId)}
            >
              <span className="visit-breakdown-name">{row.customerName}</span>
              <span className="visit-breakdown-right">
                <span className="visit-breakdown-count">{row.visitCount} {row.visitCount === 1 ? "visit" : "visits"}</span>
                <span className="visit-breakdown-chevron">{isOpen ? "▲" : "▼"}</span>
              </span>
            </button>
            {isOpen && (
              <div className="visit-breakdown-dates">
                {row.visitDates && row.visitDates.length > 0 ? (
                  row.visitDates.map((date) => (
                    <span key={date} className="visit-date-chip">{formatVisitDateLabel(date)}</span>
                  ))
                ) : (
                  <span className="visit-date-chip">No date info - update server script</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ReportsScreen() {
  const [dashboardPayload, setDashboardPayload] = useState<ReportsData | null>(null);
  const [detailPayload, setDetailPayload] = useState<ReportsData | null>(null);
  const [selectedReport, setSelectedReport] = useState<string>("kpi_cards");
  const [loading, setLoading] = useState(true);
  const [showVisitBreakdown, setShowVisitBreakdown] = useState(false);
  const [fromDate, setFromDate] = useState(firstOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());
  const [pendingFrom, setPendingFrom] = useState(firstOfMonthStr());
  const [pendingTo, setPendingTo] = useState(todayStr());
  const [timerElapsed, setTimerElapsed] = useState(0);

  const load = async (reportKey: string = "kpi_cards", from?: string, to?: string) => {
    setLoading(true);
    const params: Record<string, string> = { report_key: reportKey };
    if (from) params.from_date = from;
    if (to) params.to_date = to;
    const response = await fetchAction<ReportsData>("reports", params);
    const nextPayload = response.data;

    if (reportKey === "kpi_cards" || !dashboardPayload) {
      setDashboardPayload(nextPayload);
    }

    setDetailPayload(nextPayload);
    setSelectedReport(reportKey);
    setLoading(false);
  };

  const applyDateFilter = () => {
    setFromDate(pendingFrom);
    setToDate(pendingTo);
    setDashboardPayload(null);
    void load("kpi_cards", pendingFrom, pendingTo);
  };

  useEffect(() => {
    void load("kpi_cards", fromDate, toDate);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void load("kpi_cards", fromDate, toDate);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fromDate, toDate]);

  const kpiCards = dashboardPayload?.kpiCards || dashboardPayload?.summary?.kpiCards;

  useEffect(() => {
    const fromTime = kpiCards?.activeTimer?.fromTime;
    if (!fromTime) {
      setTimerElapsed(0);
      return;
    }

    const run = () => {
      setTimerElapsed(
        getElapsedSeconds(
          fromTime,
          kpiCards?.activeTimer?.fromTimeUtc,
          kpiCards?.activeTimer?.liveHours,
          dashboardPayload?.serverNowUtc ?? detailPayload?.serverNowUtc
        )
      );
    };
    run();
    const interval = window.setInterval(run, 1000);
    return () => window.clearInterval(interval);
  }, [
    kpiCards?.activeTimer?.fromTime,
    kpiCards?.activeTimer?.fromTimeUtc,
    kpiCards?.activeTimer?.liveHours,
    dashboardPayload?.serverNowUtc,
    detailPayload?.serverNowUtc
  ]);
  const hoursByDay =
    dashboardPayload?.hoursByDay ||
    dashboardPayload?.summary?.hoursByDay ||
    (selectedReport === "hours_by_day" ? normalizeHoursByDay(detailPayload?.rows) : []);
  const availableReports = (detailPayload?.availableReports || dashboardPayload?.availableReports || []).filter(
    (report) => report.key !== "leave_breakdown"
  );
  const activeTimerRow = detailPayload?.rows?.[0] || null;

  if (loading && !dashboardPayload) {
    return <LoadingState label="Loading my insights..." />;
  }

  if (!dashboardPayload) {
    return <EmptyState title="Reports unavailable" copy="The reports API did not return data." />;
  }

  return (
    <div className="screen-stack screen-stack--single report-dashboard">
      <Panel className="report-top-panel">
        <div className="report-date-header">
          <h2 className="panel-title">My Reports</h2>
          <div className="report-date-filter">
            <div className="report-date-field">
              <label className="report-date-label" htmlFor="report-from-date">
                From
              </label>
              <input
                id="report-from-date"
                type="date"
                className="report-date-input"
                value={pendingFrom}
                max={pendingTo}
                onChange={(e) => setPendingFrom(e.target.value)}
              />
            </div>
            <div className="report-date-field">
              <label className="report-date-label" htmlFor="report-to-date">
                To
              </label>
              <input
                id="report-to-date"
                type="date"
                className="report-date-input"
                value={pendingTo}
                min={pendingFrom}
                max={todayStr()}
                onChange={(e) => setPendingTo(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="report-date-apply"
              onClick={applyDateFilter}
              disabled={loading}
            >
              Apply
            </button>
          </div>
        </div>

        {kpiCards ? (
          <div className="kpi-grid report-kpi-grid">
            <ReportKpiCard
              label={kpiCards.tasksCompleted.label}
              value={kpiCards.tasksCompleted.value}
              color={kpiCards.tasksCompleted.color}
            />
            <ReportKpiCard
              label={kpiCards.tasksInProgress.label}
              value={kpiCards.tasksInProgress.value}
              color={kpiCards.tasksInProgress.color}
            />
            <ReportKpiCard
              label={kpiCards.tasksPending.label}
              value={kpiCards.tasksPending.value}
              color={kpiCards.tasksPending.color}
            />
            <ReportKpiCard
              label={kpiCards.tasksOverdue.label}
              value={kpiCards.tasksOverdue.value}
              color={kpiCards.tasksOverdue.color}
              alert={kpiCards.tasksOverdue.alert}
            />
            {kpiCards.visitCount ? (
              <button
                type="button"
                className={`report-kpi-card report-kpi-card--clickable ${showVisitBreakdown ? "is-active" : ""}`}
                onClick={() => setShowVisitBreakdown((v) => !v)}
              >
                <div className="report-kpi-top">
                  <p className="kpi-label">{kpiCards.visitCount.label}</p>
                  <span className="kpi-icon info-gradient">
                    <MapPin size={18} />
                  </span>
                </div>
                <span className="report-kpi-value">{kpiCards.visitCount.value}</span>
                <p className="report-kpi-copy">Tap to see by customer</p>
              </button>
            ) : null}
          </div>
        ) : null}

        {showVisitBreakdown && kpiCards?.visitCount ? (
          <div className="visit-breakdown-panel">
            <p className="visit-breakdown-title">
              <MapPin size={13} /> Visits by Customer
            </p>
            <VisitBreakdown rows={kpiCards.visitCount.visitBreakdown ?? ([] as VisitByCustomer[])} />
          </div>
        ) : null}
      </Panel>

      <Panel className="report-insight-panel">
        <div className="panel-title-row">
          <div>
            <h2 className="panel-title">Insight Views</h2>
            <p className="panel-subtitle">Choose a view to drill into your own work pattern.</p>
          </div>
          <div className="metric-icon info-gradient">
            <BarChart3 size={18} />
          </div>
        </div>

        <div className="report-switcher">
          {availableReports.map((report) => (
            <button
              key={report.key}
              className={`report-switcher-button ${selectedReport === report.key ? "is-active" : ""}`}
              type="button"
              onClick={() => void load(report.key, fromDate, toDate)}
            >
              <span>{report.label}</span>
            </button>
          ))}
        </div>

        <div className="report-detail-grid">
          <article className="report-detail-card">
            <div className="report-detail-head">
              <div>
                <h3 className="list-title">Hours by Day</h3>
                <p className="panel-subtitle">A quick look at your time allocation across the selected period.</p>
              </div>
              <span className="report-pill">
                <Clock3 size={14} />
                <span>{formatHours(hoursByDay.reduce((total, row) => total + row.hours, 0))}</span>
              </span>
            </div>
            <HoursChart rows={hoursByDay} />
          </article>

          {kpiCards || loading ? (
            <article className="report-detail-card">
              <div className="report-detail-head">
                <div>
                  <h3 className="list-title">Task Status</h3>
                  <p className="panel-subtitle">A simple breakdown of your work pipeline.</p>
                </div>
                <span className="report-pill">
                  <BarChart3 size={14} />
                  <span>{kpiCards ? kpiCards.tasksCompleted.value + kpiCards.tasksInProgress.value + kpiCards.tasksPending.value + kpiCards.tasksOverdue.value : "..."}</span>
                </span>
              </div>
              {loading || !kpiCards ? <TaskStatusChartLoading /> : <TaskStatusChart kpis={kpiCards} />}
            </article>
          ) : null}

          <article className="report-detail-card">
            <div className="report-detail-head">
              <div>
                <h3 className="list-title">Active Timer</h3>
                <p className="panel-subtitle">Your current live timer snapshot.</p>
              </div>
              <span className="report-pill">
                <TimerReset size={14} />
                <span>{kpiCards?.activeTimer?.isRunning ? "Running" : "Idle"}</span>
              </span>
            </div>

            {kpiCards?.activeTimer?.isRunning ? (
              <div className="report-active-timer">
                <div className="report-active-value">{formatDuration(timerElapsed)}</div>
                <p className="report-active-copy">{kpiCards.activeTimer.taskSubject || "No task selected"}</p>
                <p className="report-active-meta">
                  {kpiCards.activeTimer.customerName || "No customer"}
                  {kpiCards.activeTimer.fromTime
                    ? ` • Started ${formatTimerClock(kpiCards.activeTimer.fromTime, kpiCards.activeTimer.fromTimeUtc)}`
                    : ""}
                </p>
              </div>
            ) : (
              <EmptyState title="No active timer" copy="You are not tracking time right now." />
            )}
          </article>
        </div>
      </Panel>

      <Panel className="report-detail-panel">
        {selectedReport === "active_timer" ? (
          activeTimerRow ? (
            <div className="report-active-detail">
              <div className="report-stat-grid">
                <article className="report-stat-card">
                  <p className="kpi-label">Status</p>
                  <h3 className="report-stat-value">{String(activeTimerRow.isRunning ? "Running" : "Idle")}</h3>
                </article>
                <article className="report-stat-card">
                  <p className="kpi-label">Live Hours</p>
                  <h3 className="report-stat-value">{formatHours(Number(activeTimerRow.liveHours || 0))}</h3>
                </article>
              </div>
              <div className="report-stat-card report-stat-card-wide">
                <p className="kpi-label">Task</p>
                <h3 className="report-stat-value report-stat-value-wrap">{String(activeTimerRow.taskSubject || "No task")}</h3>
                <p className="panel-subtitle">{String(activeTimerRow.customerName || "No customer")}</p>
              </div>
            </div>
          ) : (
            <EmptyState title="No active timer" copy="There is no timer data for the selected period." />
          )
        ) : selectedReport === "hours_by_day" ? (
          <div className="report-list-stack">
            {hoursByDay.length === 0 ? (
              <EmptyState title="No hours logged" copy="You have not logged any hours for the selected period." />
            ) : (
              hoursByDay.map((row) => (
                <article key={row.date} className="report-list-item">
                  <div className="report-list-head">
                    <div>
                      <h3 className="list-title">{formatDateLabel(row.date)}</h3>
                      <p className="panel-subtitle">Daily tracked time</p>
                    </div>
                    <span className="report-list-value">{formatHours(row.hours)}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : (
          <div className="report-summary-grid">
            {kpiCards ? (
              <ReportKpiCard
                label="Hours Logged"
                value={kpiCards.hoursLogged.value}
                color={kpiCards.hoursLogged.color}
                subLabel={kpiCards.hoursLogged.subLabel}
                deltaLabel={kpiCards.hoursLogged.deltaLabel}
              />
            ) : (
              <EmptyState title="Choose a view" copy="Select a report view above to see the detail cards." />
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
