"use client";

import {
  BarChart3,
  CalendarDays,
  Clock3,
  PieChart,
  TimerReset,
  TrendingUp,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAction } from "@/lib/client";
import type { HoursByDay, KpiCardsData, ReportsData } from "@/lib/types";
import { formatHours } from "@/lib/utils";
import { EmptyState, LoadingState, Panel } from "@/components/ui";

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
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString([], {
    month: "short",
    day: "numeric"
  });
}

function formatPeriodLabel(fromDate?: string, toDate?: string) {
  if (!fromDate || !toDate) {
    return "Current period";
  }

  return `${fromDate} to ${toDate}`;
}

function formatTimerClock(value?: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const match = value.match(/\b(\d{2}:\d{2})/);
  return match ? match[1] : value;
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

function normalizeHoursByDay(rows?: Array<Record<string, string | number | boolean | null>>): HoursByDay[] {
  return (rows || []).map((row) => ({
    date: String(row.date || row.work_date || ""),
    hours: Number(row.hours || row.total_hours || 0)
  }));
}

type ReportRow = Record<string, string | number | boolean | null>;

export function ReportsScreen() {
  const [dashboardPayload, setDashboardPayload] = useState<ReportsData | null>(null);
  const [detailPayload, setDetailPayload] = useState<ReportsData | null>(null);
  const [selectedReport, setSelectedReport] = useState<string>("kpi_cards");
  const [loading, setLoading] = useState(true);

  const load = async (reportKey: string = "kpi_cards") => {
    setLoading(true);
    const params = reportKey ? { report_key: reportKey } : undefined;
    const response = await fetchAction<ReportsData>("reports", params);
    const nextPayload = response.data;

    if (reportKey === "kpi_cards" || !dashboardPayload) {
      setDashboardPayload(nextPayload);
    }

    setDetailPayload(nextPayload);
    setSelectedReport(reportKey);
    setLoading(false);
  };

  useEffect(() => {
    void load("kpi_cards");
  }, []);

  const periodLabel = useMemo(() => {
    return formatPeriodLabel(dashboardPayload?.period.fromDate, dashboardPayload?.period.toDate);
  }, [dashboardPayload]);

  const kpiCards = dashboardPayload?.kpiCards || dashboardPayload?.summary?.kpiCards;
  const hoursByDay =
    dashboardPayload?.hoursByDay ||
    dashboardPayload?.summary?.hoursByDay ||
    (selectedReport === "hours_by_day" ? normalizeHoursByDay(detailPayload?.rows) : []);
  const availableReports = detailPayload?.availableReports || dashboardPayload?.availableReports || [];
  const leaveRows = detailPayload?.rows || [];
  const activeTimerRow = detailPayload?.rows?.[0] || null;

  if (loading) {
    return <LoadingState label="Loading my insights..." />;
  }

  if (!dashboardPayload) {
    return <EmptyState title="Reports unavailable" copy="The reports API did not return data." />;
  }

  return (
    <div className="screen-stack screen-stack--single report-dashboard">
      <Panel>
        <div className="panel-title-row panel-title-row-stack">
          <div>
            <h2 className="panel-title">My Reports</h2>
            <p className="panel-subtitle">
              Personal insights for {periodLabel}. Built for the logged-in employee.
            </p>
          </div>
          <div className="report-period-chip">
            <CalendarDays size={16} />
            <span>{periodLabel}</span>
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
          </div>
        ) : null}
      </Panel>

      <Panel>
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
              onClick={() => void load(report.key)}
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

          {kpiCards ? (
            <article className="report-detail-card">
              <div className="report-detail-head">
                <div>
                  <h3 className="list-title">Task Status</h3>
                  <p className="panel-subtitle">A simple breakdown of your work pipeline.</p>
                </div>
                <span className="report-pill">
                  <BarChart3 size={14} />
                  <span>{kpiCards.tasksCompleted.value + kpiCards.tasksInProgress.value + kpiCards.tasksPending.value + kpiCards.tasksOverdue.value}</span>
                </span>
              </div>
              <TaskStatusChart kpis={kpiCards} />
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
                <span>{kpiCards?.activeTimer.isRunning ? "Running" : "Idle"}</span>
              </span>
            </div>

            {kpiCards?.activeTimer.isRunning ? (
              <div className="report-active-timer">
                <div className="report-active-value">{formatHours(kpiCards.activeTimer.liveHours)}</div>
                <p className="report-active-copy">{kpiCards.activeTimer.taskSubject || "No task selected"}</p>
                <p className="report-active-meta">
                  {kpiCards.activeTimer.customerName || "No customer"}
                  {kpiCards.activeTimer.fromTime ? ` • Started ${formatTimerClock(kpiCards.activeTimer.fromTime)}` : ""}
                </p>
              </div>
            ) : (
              <EmptyState title="No active timer" copy="You are not tracking time right now." />
            )}
          </article>
        </div>
      </Panel>

      <Panel>
        {selectedReport === "leave_breakdown" ? (
          leaveRows.length === 0 ? (
            <EmptyState title="No leave data" copy="There are no approved leave entries in this period." />
          ) : (
            <div className="report-list-stack">
              {leaveRows.map((row, index) => {
                const item = row as ReportRow;
                return (
                  <article key={`${selectedReport}-${index}`} className="report-list-item">
                    <div className="report-list-head">
                      <div>
                        <h3 className="list-title">{String(item.leaveType || item.leave_type || "Leave")}</h3>
                        <p className="panel-subtitle">{Number(item.applications || 0)} applications</p>
                      </div>
                      <span className="report-list-value">{Number(item.days || 0).toFixed(1)} days</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : selectedReport === "active_timer" ? (
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
              <>
                <ReportKpiCard
                  label="Hours Logged"
                  value={kpiCards.hoursLogged.value}
                  color={kpiCards.hoursLogged.color}
                  subLabel={kpiCards.hoursLogged.subLabel}
                  deltaLabel={kpiCards.hoursLogged.deltaLabel}
                />
                <ReportKpiCard
                  label="Avg hrs / Day"
                  value={kpiCards.avgHoursPerDay.value}
                  color={kpiCards.avgHoursPerDay.color}
                  subLabel={kpiCards.avgHoursPerDay.subLabel}
                />
                <ReportKpiCard
                  label="Leaves Taken"
                  value={kpiCards.leavesTaken.value}
                  color={kpiCards.leavesTaken.color}
                  subLabel={`${kpiCards.leavesTaken.breakdown?.length || 0} leave types`}
                />
                <article className="report-kpi-card report-kpi-card--tall">
                  <div className="report-kpi-top">
                    <p className="kpi-label">Leaves Breakdown</p>
                    <span className="kpi-icon info-gradient">
                      <Users size={18} />
                    </span>
                  </div>
                  <div className="report-breakdown">
                    {kpiCards.leavesTaken.breakdown?.length ? (
                      kpiCards.leavesTaken.breakdown.map((item) => (
                        <div key={item.leaveType} className="report-breakdown-row">
                          <span>{item.leaveType}</span>
                          <span>{item.days.toFixed(1)} days</span>
                        </div>
                      ))
                    ) : (
                      <EmptyState title="No leave breakdown" copy="There are no leave entries to display." />
                    )}
                  </div>
                </article>
              </>
            ) : (
              <EmptyState title="Choose a view" copy="Select a report view above to see the detail cards." />
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
