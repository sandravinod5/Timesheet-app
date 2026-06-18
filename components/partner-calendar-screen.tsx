"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Save } from "lucide-react";
import { fetchPartnerCalendarAction } from "@/lib/client";
import type { WeeklyPlannerCellChange, WeeklyPlannerData, WeeklyPlannerRow } from "@/lib/types";
import { ManagementCalendarScreen } from "@/components/management-calendar-screen";
import { Button, EmptyState, LoadingState, Panel } from "@/components/ui";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  next.setDate(next.getDate() - next.getDay());
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfWeek(date: Date) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  return next;
}

function shiftWeek(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount * 7);
  return next;
}

function formatWeekLabel(date: Date) {
  const from = startOfWeek(date);
  const to = endOfWeek(date);
  return `${from.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short"
  })} - ${to.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}

function displayDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return `${pad(parsed.getDate())}-${pad(parsed.getMonth() + 1)}-${parsed.getFullYear()}`;
}

function getCellKey(date: string, session: string, user: string) {
  return `${date}__${session}__${user}`;
}

function initialDraftMap(rows: WeeklyPlannerRow[]) {
  const next: Record<string, string> = {};

  for (const row of rows) {
    for (const [user, cell] of Object.entries(row.entries)) {
      next[getCellKey(row.date, row.session, user)] = cell.customer || "";
    }
  }

  return next;
}

export function PartnerCalendarScreen() {
  const [weekCursor, setWeekCursor] = useState<Date | null>(null);
  const [data, setData] = useState<WeeklyPlannerData | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [mobileColumnKey, setMobileColumnKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarRefreshToken, setCalendarRefreshToken] = useState(0);
  const [showCalendarOverview, setShowCalendarOverview] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(true);
  const weekCacheRef = useRef<Record<string, WeeklyPlannerData>>({});
  const inFlightPrefetchRef = useRef<Record<string, boolean>>({});

  const load = async (targetWeek: Date, options?: { silent?: boolean; preferCache?: boolean }) => {
    const weekKey = `${dateKey(startOfWeek(targetWeek))}__${dateKey(endOfWeek(targetWeek))}`;
    const cachedData = weekCacheRef.current[weekKey];
    const silent = options?.silent ?? Boolean(data || cachedData);
    const preferCache = options?.preferCache !== false;

    if (preferCache && cachedData) {
      setData(cachedData);
      setDraftValues(initialDraftMap(cachedData.rows || []));
    }

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    const fromDate = dateKey(startOfWeek(targetWeek));
    const toDate = dateKey(endOfWeek(targetWeek));

    const prefetchWeek = async (date: Date) => {
      const prefetchKey = `${dateKey(startOfWeek(date))}__${dateKey(endOfWeek(date))}`;
      if (weekCacheRef.current[prefetchKey] || inFlightPrefetchRef.current[prefetchKey]) {
        return;
      }

      inFlightPrefetchRef.current[prefetchKey] = true;
      try {
        const response = await fetchPartnerCalendarAction<WeeklyPlannerData>("weekly_grid", {
          from_date: dateKey(startOfWeek(date)),
          to_date: dateKey(endOfWeek(date))
        });
        weekCacheRef.current[prefetchKey] = response.data;
      } catch {
        return;
      } finally {
        delete inFlightPrefetchRef.current[prefetchKey];
      }
    };

    try {
      const response = await fetchPartnerCalendarAction<WeeklyPlannerData>("weekly_grid", {
        from_date: fromDate,
        to_date: toDate
      });
      weekCacheRef.current[weekKey] = response.data;
      setData(response.data);
      setDraftValues(initialDraftMap(response.data.rows || []));
      void prefetchWeek(shiftWeek(targetWeek, -1));
      void prefetchWeek(shiftWeek(targetWeek, 1));
    } catch (loadError) {
      if (!cachedData && !data) {
        setData(null);
      }
      setError(loadError instanceof Error ? loadError.message : "Weekly planner could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setWeekCursor(new Date());
  }, []);

  useEffect(() => {
    if (!weekCursor) {
      return;
    }

    void load(weekCursor, {
      silent: Boolean(data || weekCacheRef.current[`${dateKey(startOfWeek(weekCursor))}__${dateKey(endOfWeek(weekCursor))}`])
    });
  }, [weekCursor]);

  useEffect(() => {
    if (!data || showCalendarOverview) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowCalendarOverview(true);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [data, showCalendarOverview]);

  useEffect(() => {
    if (!data?.columns?.length) {
      return;
    }

    if (!mobileColumnKey || !data.columns.some((column) => column.key === mobileColumnKey)) {
      setMobileColumnKey(data.columns[0].key);
    }
  }, [data?.columns, mobileColumnKey]);

  const changedCells = useMemo(() => {
    if (!data) {
      return [];
    }

    const changes: WeeklyPlannerCellChange[] = [];
    for (const row of data.rows) {
      for (const column of data.columns) {
        const key = getCellKey(row.date, row.session, column.key);
        const existingCell = row.entries[column.key];
        const currentValue = (draftValues[key] || "").trim();
        const existingValue = (existingCell?.customer || "").trim();

        if (currentValue !== existingValue) {
          changes.push({
            date: row.date,
            session: row.session,
            user: column.key,
            customer: currentValue,
            docName: existingCell?.docName || null
          });
        }
      }
    }

    return changes;
  }, [data, draftValues]);

  const groupedRows = useMemo(() => {
    const groups: Array<{ date: string; dayLabel: string; rows: WeeklyPlannerRow[] }> = [];
    const map = new Map<string, { date: string; dayLabel: string; rows: WeeklyPlannerRow[] }>();

    for (const row of data?.rows || []) {
      if (!map.has(row.date)) {
        map.set(row.date, {
          date: row.date,
          dayLabel: row.dayLabel,
          rows: []
        });
      }

      map.get(row.date)!.rows.push(row);
    }

    map.forEach((value) => groups.push(value));
    return groups;
  }, [data?.rows]);

  const mobileColumn = useMemo(() => {
    if (!data?.columns?.length) {
      return null;
    }

    return data.columns.find((column) => column.key === mobileColumnKey) || data.columns[0];
  }, [data?.columns, mobileColumnKey]);

  const handleSave = async () => {
    if (changedCells.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await fetchPartnerCalendarAction(
        "save_weekly_grid",
        {
          changes: JSON.stringify(changedCells)
        },
        "POST"
      );

      await load(weekCursor || new Date(), { silent: true, preferCache: true });
      setCalendarRefreshToken((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Planner changes could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (!weekCursor || (loading && !data)) {
    return <LoadingState label="Loading management meeting planner..." />;
  }

  if (!data) {
    return (
      <div className="screen-stack">
        <Panel className="partner-calendar-hero">
          <div className="partner-calendar-hero-copy">
            <p className="panel-eyebrow">Management planner</p>
            <h2 className="panel-title">Meeting Calendar</h2>
            <p className="panel-subtitle">{error || "Planner data is not available."}</p>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="screen-stack management-meeting-screen">
      <Panel className="management-planner-hero">
        <div className="partner-calendar-hero-copy">
          <p className="panel-eyebrow">Management planner</p>
          <h2 className="panel-title">Meeting Calendar</h2>
          {error ? <p className="partner-calendar-inline-error">{error}</p> : null}
        </div>

        <div className="management-planner-actions">
          <button
            className={refreshing ? "ghost-button is-spinning" : "ghost-button"}
            onClick={() => void load(weekCursor, { silent: true, preferCache: true })}
            aria-label="Refresh planner"
            type="button"
          >
            <RefreshCw size={18} />
          </button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || changedCells.length === 0}>
            <Save size={16} />
            {saving ? "Saving..." : `Save Changes${changedCells.length ? ` (${changedCells.length})` : ""}`}
          </Button>
        </div>
      </Panel>

      <Panel>
        <div className="management-planner-toolbar">
          <div className="partner-calendar-toolbar">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setWeekCursor((current) => shiftWeek(current || new Date(), -1))}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="partner-calendar-period">
              <CalendarDays size={18} />
              <span>{formatWeekLabel(weekCursor)}</span>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setWeekCursor((current) => shiftWeek(current || new Date(), 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </Panel>

      {groupedRows.length === 0 ? (
        <Panel>
          <EmptyState title="No planner rows" copy="The selected week has no session rows to display." />
        </Panel>
      ) : (
        <Panel className="management-planner-panel">
          <div className="panel-title-row management-card-collapse-row">
            <div>
              <h2 className="panel-title">Weekly Planner</h2>
            </div>
            <button
              type="button"
              className="ghost-button management-card-toggle"
              aria-expanded={plannerOpen}
              aria-label={plannerOpen ? "Collapse weekly planner" : "Expand weekly planner"}
              onClick={() => setPlannerOpen((current) => !current)}
            >
              <ChevronDown size={18} className={`collapsible-chevron ${plannerOpen ? "is-open" : ""}`} />
            </button>
          </div>
          {plannerOpen ? (
            <>
              <div className="management-planner-mobile-switcher" aria-label="Choose team member">
                <div className="management-planner-mobile-switcher-track">
                  {data.columns.map((column) => (
                    <button
                      key={column.key}
                      type="button"
                      className={`management-planner-mobile-user-button ${
                        mobileColumn?.key === column.key ? "is-active" : ""
                      }`}
                      onClick={() => setMobileColumnKey(column.key)}
                    >
                      {column.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="management-planner-table-wrap management-planner-table-desktop">
                <table className="management-planner-table">
                  <thead>
                    <tr>
                      <th>Date / Day</th>
                      <th>Session</th>
                      {data.columns.map((column) => (
                        <th key={column.key}>{column.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedRows.map((group) =>
                      group.rows.map((row, rowIndex) => (
                        <tr
                          key={`${row.date}-${row.session}`}
                          className={rowIndex === group.rows.length - 1 ? "management-planner-day-end" : undefined}
                        >
                          {rowIndex === 0 ? (
                            <td rowSpan={group.rows.length} className="management-planner-date-day-cell">
                              <span className="management-planner-date-text">{displayDate(group.date)}</span>
                              <span className="management-planner-day-text">{group.dayLabel}</span>
                            </td>
                          ) : null}
                          <td className="management-planner-session-cell">{row.session}</td>
                          {data.columns.map((column) => {
                            const key = getCellKey(row.date, row.session, column.key);
                            const currentValue = draftValues[key] || "";
                            return (
                              <td key={key} className="management-planner-entry-cell">
                                <input
                                  className="management-planner-input"
                                  value={currentValue}
                                  onChange={(event) =>
                                    setDraftValues((current) => ({
                                      ...current,
                                      [key]: event.target.value
                                    }))
                                  }
                                  placeholder="Add entry"
                                  aria-label={`${column.label} ${row.session} entry for ${group.dayLabel} ${displayDate(group.date)}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {mobileColumn ? (
                <div className="management-planner-table-wrap management-planner-table-mobile">
                  <table className="management-planner-table">
                    <thead>
                      <tr>
                        <th>Date / Day</th>
                        <th>Session</th>
                        <th>{mobileColumn.label}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedRows.map((group) =>
                        group.rows.map((row, rowIndex) => {
                          const key = getCellKey(row.date, row.session, mobileColumn.key);
                          const currentValue = draftValues[key] || "";

                          return (
                            <tr
                              key={`${row.date}-${row.session}-${mobileColumn.key}`}
                              className={rowIndex === group.rows.length - 1 ? "management-planner-day-end" : undefined}
                            >
                              {rowIndex === 0 ? (
                                <td rowSpan={group.rows.length} className="management-planner-date-day-cell">
                                  <span className="management-planner-date-text">{displayDate(group.date)}</span>
                                  <span className="management-planner-day-text">{group.dayLabel}</span>
                                </td>
                              ) : null}
                              <td className="management-planner-session-cell">{row.session}</td>
                              <td className="management-planner-entry-cell">
                                <input
                                  className="management-planner-input"
                                  value={currentValue}
                                  onChange={(event) =>
                                    setDraftValues((current) => ({
                                      ...current,
                                      [key]: event.target.value
                                    }))
                                  }
                                  placeholder="Add entry"
                                  aria-label={`${mobileColumn.label} ${row.session} entry for ${group.dayLabel} ${displayDate(group.date)}`}
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
        </Panel>
      )}

      <div className="management-meeting-calendar-section">
        {showCalendarOverview ? (
          <ManagementCalendarScreen
            embedded
            open={calendarOpen}
            refreshToken={calendarRefreshToken}
            onToggleOpen={() => setCalendarOpen((current) => !current)}
            onEntriesChanged={() => {
              void load(weekCursor || new Date(), { silent: true, preferCache: true });
            }}
          />
        ) : (
          <Panel>
            <div className="partner-calendar-hero-copy">
              <p className="panel-eyebrow">Calendar overview</p>
              <h2 className="panel-title">Calendar</h2>
              <p className="panel-subtitle">Loading calendar overview...</p>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
