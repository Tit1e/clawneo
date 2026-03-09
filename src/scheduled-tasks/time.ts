const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const WEEKDAY_LABELS_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

type CronParts = {
  minute: number;
  hour: number;
  dayOfWeek: number | null;
};

function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function getFormatter(timezone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
}

function getZonedParts(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;
} {
  const formatter = getFormatter(timezone);
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    dayOfWeek: weekdayMap[map.weekday] ?? 0,
  };
}

function roundUpToNextMinute(baseDate: Date): Date {
  const rounded = new Date(baseDate.getTime());
  rounded.setUTCSeconds(0, 0);
  rounded.setUTCMinutes(rounded.getUTCMinutes() + 1);
  return rounded;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseCronExpr(cronExpr: string): CronParts {
  const fields = cronExpr.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error("Only 5-field cron expressions are supported.");
  }

  const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] = fields;
  if (dayOfMonthField !== "*" || monthField !== "*") {
    throw new Error("Only daily and weekly cron expressions are supported in this version.");
  }

  const minute = Number(minuteField);
  const hour = Number(hourField);
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error(`Invalid cron minute field: ${minuteField}`);
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`Invalid cron hour field: ${hourField}`);
  }

  let dayOfWeek: number | null = null;
  if (dayOfWeekField !== "*") {
    const parsed = Number(dayOfWeekField);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 7) {
      throw new Error(`Invalid cron day-of-week field: ${dayOfWeekField}`);
    }
    dayOfWeek = parsed === 7 ? 0 : parsed;
  }

  return { minute, hour, dayOfWeek };
}

function isSameZonedDate(left: Date, right: Date, timezone: string): boolean {
  const leftParts = getZonedParts(left, timezone);
  const rightParts = getZonedParts(right, timezone);
  return (
    leftParts.year === rightParts.year
    && leftParts.month === rightParts.month
    && leftParts.day === rightParts.day
  );
}

export function resolveTaskTimezone(timezone?: string): string {
  const trimmed = timezone?.trim();
  if (!trimmed) {
    return DEFAULT_TIMEZONE;
  }
  if (!isValidTimezone(trimmed)) {
    throw new Error(`Invalid timezone: ${trimmed}`);
  }
  return trimmed;
}

export function validateRunAt(runAt: string): string {
  const parsed = new Date(runAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid runAt timestamp: ${runAt}`);
  }
  if (parsed.getTime() <= Date.now()) {
    throw new Error("runAt must be in the future.");
  }
  return parsed.toISOString();
}

export function resolveNextRunAtForCron(cronExpr: string, timezone: string, fromDate = new Date()): string {
  const cron = parseCronExpr(cronExpr);
  let cursor = roundUpToNextMinute(fromDate);
  const maxChecks = 60 * 24 * 8;

  for (let index = 0; index < maxChecks; index += 1) {
    const parts = getZonedParts(cursor, timezone);
    const matchesMinute = parts.minute === cron.minute;
    const matchesHour = parts.hour === cron.hour;
    const matchesDay = cron.dayOfWeek === null || parts.dayOfWeek === cron.dayOfWeek;

    if (matchesMinute && matchesHour && matchesDay) {
      return cursor.toISOString();
    }

    cursor = new Date(cursor.getTime() + 60_000);
  }

  throw new Error(`Unable to resolve the next run time for cron expression: ${cronExpr}`);
}

export function formatRunAtForDisplay(runAt: string, timezone: string, now = new Date()): string {
  const target = new Date(runAt);
  if (Number.isNaN(target.getTime())) {
    throw new Error(`Invalid runAt timestamp: ${runAt}`);
  }

  const targetParts = getZonedParts(target, timezone);
  const timeLabel = `${pad2(targetParts.hour)}:${pad2(targetParts.minute)}`;

  if (isSameZonedDate(target, now, timezone)) {
    return `今天 ${timeLabel}`;
  }

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (isSameZonedDate(target, tomorrow, timezone)) {
    return `明天 ${timeLabel}`;
  }

  return `${targetParts.year}-${pad2(targetParts.month)}-${pad2(targetParts.day)} ${timeLabel}`;
}

export function formatCronExprForDisplay(cronExpr: string): string {
  const cron = parseCronExpr(cronExpr);
  const timeLabel = `${pad2(cron.hour)}:${pad2(cron.minute)}`;

  if (cron.dayOfWeek === null) {
    return `每天 ${timeLabel}`;
  }

  return `每${WEEKDAY_LABELS_ZH[cron.dayOfWeek]} ${timeLabel}`;
}
