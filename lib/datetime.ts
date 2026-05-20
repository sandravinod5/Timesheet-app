const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?$/;

function parseNaiveDateTime(value: string) {
  const match = value.trim().match(DATE_TIME_PATTERN);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour = "0", minute = "0", second = "0", fraction = "0"] = match;
  const milliseconds = Number(fraction.padEnd(3, "0"));

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
    millisecond: milliseconds
  };
}

function hasExplicitTimezone(value: string) {
  return /(?:z|[+-]\d{2}:\d{2})$/i.test(value.trim());
}

export function parseApiDateTime(value?: string | null, utcValue?: string | null) {
  const candidate = utcValue || value;
  if (!candidate) {
    return null;
  }

  if (utcValue || hasExplicitTimezone(candidate)) {
    const parsed = new Date(candidate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parts = parseNaiveDateTime(candidate);
  if (parts) {
    return new Date(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond
    );
  }

  const fallback = new Date(candidate.includes("T") ? candidate : candidate.replace(" ", "T"));
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function formatDateTimeLocalInput(value?: string | null, utcValue?: string | null) {
  const parsed = parseApiDateTime(value, utcValue);
  if (!parsed) {
    return value ? value.replace(" ", "T").slice(0, 16) : "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hour = String(parsed.getHours()).padStart(2, "0");
  const minute = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function formatLocalDateTime(
  value?: string | null,
  utcValue?: string | null,
  options: Intl.DateTimeFormatOptions = {}
) {
  const parsed = parseApiDateTime(value, utcValue);
  if (!parsed) {
    return value || "";
  }

  return parsed.toLocaleString([], options);
}

export function formatLocalTime(value?: string | null, utcValue?: string | null) {
  const parsed = parseApiDateTime(value, utcValue);
  if (!parsed) {
    const match = value?.match(/\b(\d{2}:\d{2})/);
    return match ? match[1] : value || null;
  }

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatLocalDate(value?: string | null) {
  if (!value) {
    return "";
  }

  const parsed = parseApiDateTime(`${value}T00:00:00`);
  if (!parsed) {
    return value;
  }

  return parsed.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getElapsedSeconds(fromTime?: string | null, fromTimeUtc?: string | null) {
  // Always trust backend UTC first. Local naive timestamps are display-only
  // and can introduce 30/60/90 minute timezone drifts in cross-region usage.
  const startFromUtc = fromTimeUtc ? parseApiDateTime(undefined, fromTimeUtc) : null;
  const startFromLocal = fromTime ? parseApiDateTime(fromTime, undefined) : null;
  const start = startFromUtc ?? startFromLocal;

  if (!start) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
}

export function getDateKeyFromDateTime(value?: string | null, utcValue?: string | null) {
  const parsed = parseApiDateTime(value, utcValue);
  if (!parsed) {
    const match = value?.match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
