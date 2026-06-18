"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, Plus, RefreshCw, UserRound } from "lucide-react";
import { fetchPartnerCalendarAction } from "@/lib/client";
import type { PartnerCalendarCustomersData, PartnerCalendarData, PartnerCalendarEntry, SelectOption } from "@/lib/types";
import { Button, EmptyState, InputShell, LoadingState, Modal, Panel } from "@/components/ui";

type ManagementUsersData = {
  users: SelectOption[];
};

type CalendarFormState = {
  customer: string;
  user: string;
  timeslots: string[];
};

const TIMESLOT_OPTIONS = ["Morning", "Afternoon", "Evening"];
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function firstOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
}

function formatLongDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

function buildMonthGrid(cursorDate: Date) {
  const first = firstOfMonth(cursorDate);
  const last = endOfMonth(cursorDate);
  const days: Array<{ key: string; dayNumber: number; inMonth: boolean }> = [];

  for (let index = 0; index < first.getDay(); index += 1) {
    const filler = new Date(first);
    filler.setDate(first.getDate() - (first.getDay() - index));
    days.push({ key: dateKey(filler), dayNumber: filler.getDate(), inMonth: false });
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const current = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), day);
    days.push({ key: dateKey(current), dayNumber: day, inMonth: true });
  }

  while (days.length % 7 !== 0) {
    const filler = new Date(last);
    filler.setDate(filler.getDate() + 1);
    days.push({ key: dateKey(filler), dayNumber: filler.getDate(), inMonth: false });
    last.setDate(last.getDate() + 1);
  }

  return days;
}

function groupEntriesByDate(entries: PartnerCalendarEntry[]) {
  const grouped: Record<string, PartnerCalendarEntry[]> = {};

  for (const entry of entries) {
    const key = entry.date || "unknown";
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(entry);
  }

  return grouped;
}

function sanitizeOptions(options: SelectOption[]) {
  return options.filter(
    (option): option is SelectOption =>
      Boolean(option && typeof option.value === "string" && option.value.trim() && typeof option.label === "string")
  );
}

function SearchableSelect({
  label,
  value,
  options,
  placeholder,
  ariaLabel,
  onChange
}: {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder: string;
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) || null;
  const [inputValue, setInputValue] = useState(selectedOption?.label || "");

  useEffect(() => {
    setInputValue(selectedOption?.label || "");
  }, [selectedOption?.label]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) {
      return options;
    }

    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [inputValue, options]);

  const handleBlur = () => {
    window.setTimeout(() => {
      if (!rootRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
        setInputValue(selectedOption?.label || "");
      }
    }, 0);
  };

  return (
    <div ref={rootRef} className="task-create-field">
      <label className="report-date-label">{label}</label>
      <InputShell className="searchable-select-shell">
        <input
          className="searchable-select-input"
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            setIsOpen(true);
            if (!event.target.value.trim()) {
              onChange("");
            }
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          aria-label={ariaLabel}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="searchable-select-toggle"
          aria-label={`Open ${ariaLabel}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setIsOpen((current) => !current)}
        >
          ▾
        </button>
      </InputShell>
      {isOpen ? (
        <div className="searchable-select-menu">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={option.value === value ? "searchable-select-option is-active" : "searchable-select-option"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setInputValue(option.label);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="searchable-select-empty">No matches found</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DayModal({
  selectedDate,
  entries,
  customerOptions,
  userOptions,
  form,
  saving,
  onChange,
  onToggleTimeslot,
  onSave,
  onClose
}: {
  selectedDate: string;
  entries: PartnerCalendarEntry[];
  customerOptions: SelectOption[];
  userOptions: SelectOption[];
  form: CalendarFormState;
  saving: boolean;
  onChange: (field: "customer" | "user", value: string) => void;
  onToggleTimeslot: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const safeCustomerOptions = useMemo(() => sanitizeOptions(customerOptions), [customerOptions]);
  const safeUserOptions = useMemo(() => sanitizeOptions(userOptions), [userOptions]);

  return (
    <Modal
      title={formatLongDate(selectedDate)}
      subtitle="Choose a customer, assign who is doing it, and select one or more timeslots."
      onClose={onClose}
      size="wide"
    >
      <div className="management-calendar-modal">
        <div className="management-calendar-form">
          <SearchableSelect
            label="Customer"
            value={form.customer}
            options={safeCustomerOptions}
            placeholder="Search customer"
            ariaLabel="Customer"
            onChange={(value) => onChange("customer", value)}
          />

          <div className="task-create-field">
            <label className="report-date-label">Who is doing</label>
            <InputShell>
              <select
                className="searchable-select-input"
                value={form.user}
                onChange={(event) => onChange("user", event.target.value)}
                aria-label="Who is doing"
              >
                <option value="">Select user</option>
                {safeUserOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </InputShell>
          </div>

          <div className="task-create-field">
            <label className="report-date-label">Timeslot</label>
            <div className="management-calendar-timeslots">
              {TIMESLOT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={form.timeslots.includes(option) ? "management-calendar-timeslot is-active" : "management-calendar-timeslot"}
                  onClick={() => onToggleTimeslot(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="button-row button-row-top">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={onSave} disabled={saving || !form.customer || !form.user || form.timeslots.length === 0}>
              {saving ? "Saving..." : form.timeslots.length > 1 ? `Save Entries (${form.timeslots.length})` : "Save Entry"}
            </Button>
          </div>
        </div>

        <div className="management-calendar-day-entries">
          <h3 className="panel-title">Entries for this day</h3>
          {entries.length === 0 ? (
            <EmptyState title="No entries yet" copy="Create the first calendar entry for this date." />
          ) : (
            <div className="partner-calendar-entry-list">
              {entries.map((entry) => (
                <article key={entry.name} className="partner-calendar-entry">
                  <div className="partner-calendar-entry-row">
                    <div>
                      <p className="partner-calendar-entry-title">{entry.customerName || entry.customer}</p>
                      <p className="partner-calendar-entry-subtitle">{entry.user}</p>
                    </div>
                    <span className={`partner-calendar-slot partner-calendar-slot--${String(entry.timeslot).toLowerCase()}`}>
                      <Clock3 size={14} />
                      {entry.timeslot}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function ManagementCalendarScreen({
  embedded = false,
  open = true,
  refreshToken = 0,
  onToggleOpen,
  onEntriesChanged
}: {
  embedded?: boolean;
  open?: boolean;
  refreshToken?: number;
  onToggleOpen?: () => void;
  onEntriesChanged?: () => void;
}) {
  const [monthCursor, setMonthCursor] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [data, setData] = useState<PartnerCalendarData | null>(null);
  const [customerOptions, setCustomerOptions] = useState<SelectOption[]>([]);
  const [userOptions, setUserOptions] = useState<SelectOption[]>([]);
  const [form, setForm] = useState<CalendarFormState>({ customer: "", user: "", timeslots: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const monthCacheRef = useRef<Record<string, PartnerCalendarData>>({});
  const inFlightPrefetchRef = useRef<Record<string, boolean>>({});

  const load = async (targetMonth: Date, options?: { silent?: boolean; includeOptions?: boolean; preferCache?: boolean }) => {
    const monthKey = `${targetMonth.getFullYear()}-${pad(targetMonth.getMonth() + 1)}`;
    const cachedData = monthCacheRef.current[monthKey];
    const silent = options?.silent ?? Boolean(data || cachedData);
    const includeOptions = Boolean(options?.includeOptions) || !optionsLoaded;
    const preferCache = options?.preferCache !== false;

    if (preferCache && cachedData) {
      setData(cachedData);
    }

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    const fromDate = dateKey(firstOfMonth(targetMonth));
    const toDate = dateKey(endOfMonth(targetMonth));

    const prefetchMonth = async (date: Date) => {
      const prefetchKey = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
      if (monthCacheRef.current[prefetchKey] || inFlightPrefetchRef.current[prefetchKey]) {
        return;
      }

      inFlightPrefetchRef.current[prefetchKey] = true;
      try {
        const response = await fetchPartnerCalendarAction<PartnerCalendarData>("monthly_entries", {
          from_date: dateKey(firstOfMonth(date)),
          to_date: dateKey(endOfMonth(date))
        });
        monthCacheRef.current[prefetchKey] = response.data;
      } catch {
        return;
      } finally {
        delete inFlightPrefetchRef.current[prefetchKey];
      }
    };

    try {
      const requests: Array<Promise<unknown>> = [
        fetchPartnerCalendarAction<PartnerCalendarData>("monthly_entries", {
          from_date: fromDate,
          to_date: toDate
        })
      ];

      if (includeOptions) {
        requests.push(fetchPartnerCalendarAction<PartnerCalendarCustomersData>("customer_options"));
        requests.push(fetchPartnerCalendarAction<ManagementUsersData>("management_users"));
      }

      const results = await Promise.allSettled(requests);
      const entriesResult = results[0] as PromiseSettledResult<{ data: PartnerCalendarData }>;

      if (entriesResult.status !== "fulfilled") {
        throw entriesResult.reason;
      }

      monthCacheRef.current[monthKey] = entriesResult.value.data;
      setData(entriesResult.value.data);

      void prefetchMonth(shiftMonth(targetMonth, -1));
      void prefetchMonth(shiftMonth(targetMonth, 1));

      if (includeOptions) {
        const customersResult = results[1] as PromiseSettledResult<{ data: PartnerCalendarCustomersData }>;
        const usersResult = results[2] as PromiseSettledResult<{ data: ManagementUsersData }>;

        if (customersResult.status === "fulfilled") {
          setCustomerOptions(sanitizeOptions(customersResult.value.data.customers || []));
        } else if (customerOptions.length === 0) {
          setCustomerOptions([]);
        }

        if (usersResult.status === "fulfilled") {
          setUserOptions(sanitizeOptions(usersResult.value.data.users || []));
        } else if (userOptions.length === 0) {
          setUserOptions([]);
        }

        if (customersResult.status === "fulfilled" && usersResult.status === "fulfilled") {
          setOptionsLoaded(true);
        }
      }
    } catch (loadError) {
      if (!cachedData && !data) {
        setData(null);
      }
      setError(loadError instanceof Error ? loadError.message : "Calendar could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setMonthCursor(new Date());
  }, []);

  useEffect(() => {
    if (!monthCursor) {
      return;
    }

    void load(monthCursor, {
      silent: Boolean(data || monthCacheRef.current[`${monthCursor.getFullYear()}-${pad(monthCursor.getMonth() + 1)}`]),
      includeOptions: !optionsLoaded
    });
  }, [monthCursor, refreshToken]);

  const groupedEntries = useMemo(() => groupEntriesByDate(data?.entries || []), [data?.entries]);
  const monthDays = useMemo(() => (monthCursor ? buildMonthGrid(monthCursor) : []), [monthCursor]);

  const selectedEntries = selectedDate ? groupedEntries[selectedDate] || [] : [];

  const handleSave = async () => {
    if (!selectedDate || !form.customer || !form.user || form.timeslots.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await Promise.all(
        form.timeslots.map((timeslot) =>
          fetchPartnerCalendarAction(
            "create_entry",
            {
              date: selectedDate,
              customer: form.customer,
              assigned_user: form.user,
              timeslot
            },
            "POST"
          )
        )
      );

      setSelectedDate(null);
      setForm({ customer: "", user: "", timeslots: [] });
      await load(monthCursor || new Date(), { silent: true, preferCache: true });
      onEntriesChanged?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Calendar entry could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (!monthCursor || (loading && !data)) {
    return <LoadingState label="Loading management calendar..." />;
  }

  return (
    <div className={embedded ? "screen-stack screen-stack--single management-calendar-embedded" : "screen-stack"}>
      <Panel className="management-calendar-summary-card">
        <div className="management-planner-hero">
          <div className="partner-calendar-hero-copy">
            <p className="panel-eyebrow">{embedded ? "Calendar overview" : "Management calendar"}</p>
            <h2 className="panel-title">Calendar</h2>
            <p className="panel-subtitle">
              Monthly calendar for Management Users. Click any day to assign customer, user, and timeslot.
            </p>
            {error ? <p className="partner-calendar-inline-error">{error}</p> : null}
          </div>
          <div className="management-planner-actions">
            <button
              className={refreshing ? "ghost-button is-spinning" : "ghost-button"}
              onClick={() => void load(monthCursor, { silent: true, includeOptions: true, preferCache: true })}
              aria-label="Refresh calendar"
              type="button"
            >
              <RefreshCw size={18} />
            </button>
            <button
              type="button"
              className="ghost-button management-card-toggle"
              aria-expanded={open}
              aria-label={open ? "Collapse calendar" : "Expand calendar"}
              onClick={onToggleOpen}
            >
              <ChevronDown size={18} className={`collapsible-chevron ${open ? "is-open" : ""}`} />
            </button>
          </div>
        </div>

        {open ? (
          <div className="partner-calendar-toolbar management-calendar-summary-toolbar">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setMonthCursor((current) => shiftMonth(current || new Date(), -1))}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="partner-calendar-period management-calendar-summary-period">
              <CalendarDays size={18} />
              <span>{formatMonthLabel(monthCursor)}</span>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setMonthCursor((current) => shiftMonth(current || new Date(), 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : null}
      </Panel>

      {open ? (
        <Panel>
          <div className="management-month-scroll">
            <div className="management-month-grid-head">
              {WEEK_DAYS.map((day) => (
                <div key={day} className="management-month-grid-head-cell">
                  {day}
                </div>
              ))}
            </div>
            <div className="management-month-grid">
              {monthDays.map((day) => {
                const entries = groupedEntries[day.key] || [];

                return (
                  <button
                    key={day.key}
                    type="button"
                    className={day.inMonth ? "management-month-day" : "management-month-day management-month-day--muted"}
                    onClick={() => {
                      setSelectedDate(day.key);
                      setForm({ customer: "", user: "", timeslots: [] });
                    }}
                  >
                    <div className="management-month-day-head">
                      <strong>{day.dayNumber}</strong>
                      <span>{entries.length}</span>
                    </div>
                    <div className="management-month-day-list">
                      <div className="management-month-day-summary">
                        {entries.length > 0 ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}` : "No entries"}
                      </div>
                      <div className="meeting-day-empty">
                        <Plus size={12} />
                        <span>Add entry</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Panel>
      ) : null}

      {selectedDate ? (
        <DayModal
          selectedDate={selectedDate}
          entries={selectedEntries}
          customerOptions={customerOptions}
          userOptions={userOptions}
          form={form}
          saving={saving}
          onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
          onToggleTimeslot={(value) =>
            setForm((current) => ({
              ...current,
              timeslots: current.timeslots.includes(value)
                ? current.timeslots.filter((item) => item !== value)
                : [...current.timeslots, value]
            }))
          }
          onSave={() => void handleSave()}
          onClose={() => setSelectedDate(null)}
        />
      ) : null}
    </div>
  );
}
