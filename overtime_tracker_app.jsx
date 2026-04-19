import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Trash2,
  Target,
  TrendingUp,
  BarChart3,
  Plane,
  Briefcase,
  Umbrella,
  ChevronLeft,
  ChevronRight,
  Dot,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

function formatMonth(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseMonth(monthStr) {
  const [year, month] = monthStr.split("-").map(Number);
  return { year, month };
}

function shiftMonth(monthStr, delta) {
  const { year, month } = parseMonth(monthStr);
  return formatMonth(new Date(year, month - 1 + delta, 1));
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthDays(monthStr) {
  const [year, month] = monthStr.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return Array.from({ length: lastDay }, (_, i) => new Date(year, month - 1, i + 1));
}

function isWorkday(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function roundUpToHalf(num) {
  const safeNum = num || 0;
  if (safeNum <= 0) return 0;
  return Math.floor(safeNum * 2) / 2 + 0.5;
}

function getMondayFirstIndex(date) {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

function getCalendarCells(monthDays) {
  if (monthDays.length === 0) return [];

  const prefix = Array.from({ length: getMondayFirstIndex(monthDays[0]) }, (_, i) => ({
    type: "empty",
    key: `empty-start-${i}`,
  }));

  const days = monthDays.map((date) => ({
    type: "day",
    key: formatDate(date),
    date,
  }));

  const total = prefix.length + days.length;
  const suffixCount = total % 7 === 0 ? 0 : 7 - (total % 7);
  const suffix = Array.from({ length: suffixCount }, (_, i) => ({
    type: "empty",
    key: `empty-end-${i}`,
  }));

  return [...prefix, ...days, ...suffix];
}

function toNumberOrNull(value) {
  if (value === "" || value === undefined || value === null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function createDefaultEntry() {
  return {
    workedHours: "",
    leaveHours: "",
    dayType: "normal",
  };
}

function normalizeEntry(rawEntry) {
  return {
    ...createDefaultEntry(),
    ...(rawEntry || {}),
  };
}

function getEffectiveHours(workedHours, leaveHours, baseHours) {
  const safeWorked = Math.max(0, workedHours || 0);
  const safeLeave = Math.max(0, Math.min(leaveHours || 0, baseHours));
  return safeWorked + safeLeave;
}

function getOvertime(dayType, workedHours, leaveHours, baseHours) {
  const worked = Math.max(0, workedHours || 0);
  if (dayType === "noOvertime") return 0;
  if (dayType === "holiday") return worked;
  return Math.max(0, getEffectiveHours(workedHours, leaveHours, baseHours) - baseHours);
}

function getDayTypeMeta(dayType) {
  if (dayType === "holiday") {
    return { label: "节假日", icon: Umbrella };
  }
  if (dayType === "noOvertime") {
    return { label: "不计加班", icon: Plane };
  }
  return { label: "正常", icon: Briefcase };
}

const STORAGE_API_URL = "/api/state";

function getDesktopStorageApi() {
  if (typeof window === "undefined") return null;
  const api = window.electronAPI;
  if (!api || typeof api.loadState !== "function" || typeof api.saveState !== "function") {
    return null;
  }
  return api;
}

async function loadPersistedStateFromEnvironment() {
  const desktopApi = getDesktopStorageApi();
  if (desktopApi) {
    return desktopApi.loadState();
  }

  const response = await fetch(STORAGE_API_URL);
  if (!response.ok) {
    throw new Error(`Load failed with status ${response.status}`);
  }
  return response.json();
}

async function savePersistedStateToEnvironment(state) {
  const desktopApi = getDesktopStorageApi();
  if (desktopApi) {
    return desktopApi.saveState(state);
  }

  const response = await fetch(STORAGE_API_URL, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(state),
  });

  if (!response.ok) {
    throw new Error(`Save failed with status ${response.status}`);
  }

  return response.json();
}

async function getPersistedStatePathFromEnvironment() {
  const desktopApi = getDesktopStorageApi();
  if (desktopApi && typeof desktopApi.getStatePath === "function") {
    return desktopApi.getStatePath();
  }

  return "data/overtime-state.json";
}

function createInitialEntries(todayStr) {
  return {
    [todayStr]: {
      workedHours: 9.5,
      leaveHours: "",
      dayType: "normal",
    },
  };
}

function createDefaultPersistedState(today, todayStr) {
  return {
    month: formatMonth(today),
    targetHours: 40,
    baseHours: 7.5,
    entries: createInitialEntries(todayStr),
  };
}

function mergePersistedState(rawState, today, todayStr) {
  const defaults = createDefaultPersistedState(today, todayStr);
  if (!rawState || typeof rawState !== "object") return defaults;

  return {
    month: typeof rawState.month === "string" && /^\d{4}-\d{2}$/.test(rawState.month) ? rawState.month : defaults.month,
    targetHours: Number.isFinite(Number(rawState.targetHours)) ? Number(rawState.targetHours) : defaults.targetHours,
    baseHours: Number.isFinite(Number(rawState.baseHours)) ? Number(rawState.baseHours) : defaults.baseHours,
    entries:
      rawState.entries && typeof rawState.entries === "object" && !Array.isArray(rawState.entries)
        ? rawState.entries
        : defaults.entries,
  };
}

function getStorageLabel() {
  return getDesktopStorageApi() ? "本机应用数据" : "当前文件夹";
}

function runSelfChecks() {
  const cases = [
    {
      name: "roundUpToHalf converts 7.5 to 8.0",
      actual: roundUpToHalf(7.5),
      expected: 8,
    },
    {
      name: "roundUpToHalf rounds 7.8 to 8.0",
      actual: roundUpToHalf(7.8),
      expected: 8,
    },
    {
      name: "roundUpToHalf rounds 7.1 to 7.5",
      actual: roundUpToHalf(7.1),
      expected: 7.5,
    },
    {
      name: "roundUpToHalf keeps 0 at 0",
      actual: roundUpToHalf(0),
      expected: 0,
    },
    {
      name: "holiday counts all worked hours as overtime",
      actual: getOvertime("holiday", 4.5, 1, 7.5),
      expected: 4.5,
    },
    {
      name: "normal day includes leave in effective hours",
      actual: getOvertime("normal", 7.1, 1, 7.5),
      expected: 0.6,
    },
    {
      name: "noOvertime day always returns zero",
      actual: getOvertime("noOvertime", 12, 0, 7.5),
      expected: 0,
    },
  ];

  cases.forEach((test) => {
    if (Math.abs(test.actual - test.expected) > 1e-9) {
      throw new Error(`Self-check failed: ${test.name}. Expected ${test.expected}, got ${test.actual}`);
    }
  });
}

runSelfChecks();

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const DAY_TYPE_OPTIONS = [
  { key: "normal", label: "正常" },
  { key: "noOvertime", label: "不计加班" },
  { key: "holiday", label: "节假日" },
];

const StatCard = ({ icon: Icon, title, value, subtitle }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm text-slate-500">{title}</div>
        <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
        {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
      </div>
      <div className="rounded-xl bg-slate-100 p-2">
        <Icon className="h-5 w-5 text-slate-700" />
      </div>
    </div>
  </div>
);

const MiniStat = ({ label, value, tone = "default" }) => {
  const toneClass =
    tone === "strong"
      ? "border-slate-900 bg-slate-900 text-white"
      : tone === "mid"
        ? "border-slate-300 bg-slate-100 text-slate-900"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
};

function CalendarDayCard({ item, isSelected, onSelect }) {
  const meta = getDayTypeMeta(item.dayType);
  const TypeIcon = meta.icon;
  const isStrong = item.dayType === "normal" && item.overtime > 3;

  let tone = "bg-white border-slate-200 hover:border-slate-300";
  if (item.dayType === "holiday") tone = "bg-amber-50 border-amber-200 hover:border-amber-300";
  else if (item.dayType === "noOvertime") tone = "bg-slate-50 border-slate-300 hover:border-slate-400";
  else if (item.overtime > 3) tone = "bg-slate-900 border-slate-900 hover:opacity-95";
  else if (item.overtime > 1.5) tone = "bg-slate-100 border-slate-300 hover:border-slate-400";
  else if (item.overtime > 0) tone = "bg-slate-50 border-slate-300 hover:border-slate-400";

  const titleText = isStrong ? "text-white" : "text-slate-900";
  const subText = isStrong ? "text-white/70" : "text-slate-500";
  const badgeText = isStrong
    ? "border-white/15 bg-white/10 text-white/85"
    : "border-slate-200 bg-white text-slate-600";
  const selectedRing = isSelected
    ? "ring-2 ring-slate-900 shadow-md"
    : item.isToday
      ? "ring-2 ring-slate-300"
      : "";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-[124px] flex-col justify-between rounded-2xl border p-3 text-left transition-all ${tone} ${selectedRing}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`text-base font-bold ${titleText}`}>{item.day}</div>
          <div className={`mt-0.5 text-xs ${subText}`}>
            {item.weekend ? "周末" : "工作日"}
            {item.isToday ? " · 今天" : ""}
          </div>
        </div>
        <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${badgeText}`}>
          <TypeIcon className="h-3 w-3" />
          {meta.label}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-[11px] ${subText}`}>实际工时</span>
          <span className={`text-sm font-semibold ${titleText}`}>
            {item.workedHours === null ? "—" : `${round2(item.workedHours)}h`}
          </span>
        </div>

        {item.leaveHours ? (
          <div className="flex items-center justify-between">
            <span className={`text-[11px] ${subText}`}>请假</span>
            <span className={`text-sm font-medium ${titleText}`}>{round2(item.leaveHours)}h</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-black/5 pt-2">
          <span className={`text-[11px] ${subText}`}>加班</span>
          <span className={`text-sm font-bold ${titleText}`}>{round2(item.overtime)}h</span>
        </div>
      </div>
    </button>
  );
}

function DayDetailPanel({ item, baseHours, onUpdate, onClose }) {
  const meta = getDayTypeMeta(item.dayType);
  const TypeIcon = meta.icon;

  const summary =
    item.dayType === "holiday"
      ? item.workedHours !== null
        ? `节假日已录入，实际工时 ${round2(item.workedHours)} 小时，全部计为加班 ${item.overtime} 小时。`
        : "节假日不会占用可加班工作日；如果当天有上班，录入的实际工时会全部计入加班。"
      : item.dayType === "noOvertime"
        ? "这一天不会累计加班，也不会计入后续可加班工作日。"
        : item.hasAnyInput
          ? item.overtime > 0
            ? `折算后 ${item.effectiveHours} 小时，当日加班 ${item.overtime} 小时。`
            : `折算后 ${item.effectiveHours} 小时，未超过基础工时。`
          : "还没有录入数据，填完后会自动计算。";

  return (
    <div className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">当日详情</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{item.dateStr}</div>
          <div className="mt-1 text-sm text-slate-500">
            {item.weekend ? "周末" : "工作日"}
            {item.isToday ? " · 今天" : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
            <TypeIcon className="h-4 w-4" />
            {meta.label}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            收起
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {DAY_TYPE_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onUpdate({ dayType: option.key })}
            className={`rounded-2xl border px-3 py-2 text-sm transition-colors ${
              item.dayType === option.key
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">实际工时</label>
          <input
            type="number"
            step="0.5"
            min="0"
            placeholder="输入当天总工时"
            value={item.workedHours === null ? "" : item.workedHours}
            onChange={(e) => onUpdate({ workedHours: e.target.value })}
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">请假小时</label>
          <input
            type="number"
            step="0.5"
            min="0"
            placeholder="例如 1 小时"
            value={item.leaveHours === null ? "" : item.leaveHours}
            onChange={(e) => onUpdate({ leaveHours: e.target.value })}
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
          />
          <div className="mt-2 text-xs text-slate-500">
            普通工作日按“实际工时 + 请假小时 - {baseHours}”折算；节假日只看实际工时。
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs text-slate-500">折算工时</div>
          <div className="mt-1 text-xl font-bold text-slate-900">{round2(item.effectiveHours)}h</div>
        </div>
        <div className="rounded-2xl border border-slate-900 bg-slate-900 p-4 text-white">
          <div className="text-xs text-white/70">当日加班</div>
          <div className="mt-1 text-xl font-bold">{round2(item.overtime)}h</div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        {summary}
      </div>
    </div>
  );
}

export default function OvertimeTrackerApp() {
  const [today] = useState(() => new Date());
  const todayStr = formatDate(today);
  const defaultState = useMemo(() => createDefaultPersistedState(today, todayStr), [today, todayStr]);

  const [month, setMonth] = useState(defaultState.month);
  const [targetHours, setTargetHours] = useState(defaultState.targetHours);
  const [baseHours, setBaseHours] = useState(defaultState.baseHours);
  const [entries, setEntries] = useState(defaultState.entries);
  const [selectedDate, setSelectedDate] = useState(null);
  const [hasLoadedPersistedState, setHasLoadedPersistedState] = useState(false);
  const [saveStatus, setSaveStatus] = useState("正在加载本地数据...");
  const [storagePath, setStoragePath] = useState("正在读取数据文件路径...");

  useEffect(() => {
    let isActive = true;

    getPersistedStatePathFromEnvironment()
      .then((path) => {
        if (isActive) {
          setStoragePath(path);
        }
      })
      .catch(() => {
        if (isActive) {
          setStoragePath("数据文件路径读取失败");
        }
      });

    async function loadPersistedState() {
      try {
        const data = await loadPersistedStateFromEnvironment();
        if (!isActive) return;

        const nextState = mergePersistedState(data, today, todayStr);
        setMonth(nextState.month);
        setTargetHours(nextState.targetHours);
        setBaseHours(nextState.baseHours);
        setEntries(nextState.entries);
        setSaveStatus("本地数据已加载");
      } catch {
        if (!isActive) return;
        setSaveStatus("未读取到本地文件，当前使用默认数据");
      } finally {
        if (isActive) {
          setHasLoadedPersistedState(true);
        }
      }
    }

    loadPersistedState();

    return () => {
      isActive = false;
    };
  }, [today, todayStr]);

  useEffect(() => {
    if (!hasLoadedPersistedState) return undefined;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setSaveStatus("正在保存到本地文件...");
        await savePersistedStateToEnvironment({
          month,
          targetHours,
          baseHours,
          entries,
        });

        setSaveStatus(`已保存到${getStorageLabel()}`);
      } catch (error) {
        if (error.name === "AbortError") return;
        setSaveStatus("保存失败，请确认本地服务正在运行");
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [month, targetHours, baseHours, entries, hasLoadedPersistedState]);

  const monthDays = useMemo(() => getMonthDays(month), [month]);
  const calendarCells = useMemo(() => getCalendarCells(monthDays), [monthDays]);

  const monthEntries = useMemo(() => {
    return monthDays.map((date) => {
      const dateStr = formatDate(date);
      const rawEntry = normalizeEntry(entries[dateStr]);
      const workedHours = toNumberOrNull(rawEntry.workedHours);
      const leaveHours = toNumberOrNull(rawEntry.leaveHours);
      const hasAnyInput = workedHours !== null || leaveHours !== null;
      const effectiveHours = getEffectiveHours(workedHours, leaveHours, baseHours);
      const overtime = getOvertime(rawEntry.dayType, workedHours, leaveHours, baseHours);
      const shouldCountAsFutureWorkday = isWorkday(date) && rawEntry.dayType === "normal";

      return {
        date,
        dateStr,
        day: date.getDate(),
        weekend: !isWorkday(date),
        isToday: dateStr === todayStr,
        workedHours,
        leaveHours,
        effectiveHours: round2(effectiveHours),
        overtime: round2(overtime),
        hasAnyInput,
        shouldCountAsFutureWorkday,
        dayType: rawEntry.dayType,
      };
    });
  }, [monthDays, entries, baseHours, todayStr]);

  const selectedItem = useMemo(() => {
    if (!selectedDate) return null;
    return monthEntries.find((item) => item.dateStr === selectedDate) || null;
  }, [monthEntries, selectedDate]);

  const metrics = useMemo(() => {
    const totalWorked = monthEntries.reduce((sum, item) => sum + (item.workedHours || 0), 0);
    const totalSelfRated = monthEntries.reduce((sum, item) => {
      if (item.workedHours === null) return sum;
      return sum + roundUpToHalf(item.workedHours);
    }, 0);
    const totalLeave = monthEntries.reduce((sum, item) => sum + (item.leaveHours || 0), 0);
    const totalOvertime = monthEntries.reduce((sum, item) => sum + item.overtime, 0);
    const remainingHours = Math.max(0, targetHours - totalOvertime);
    const remainingWorkdays = monthEntries.filter(
      (item) => item.dateStr > todayStr && item.shouldCountAsFutureWorkday,
    ).length;
    const workedDays = monthEntries.filter((item) => item.workedHours !== null).length;
    const excludedDays = monthEntries.filter((item) => item.dayType !== "normal").length;
    const avgWorked = workedDays > 0 ? totalWorked / workedDays : 0;
    const avgNeedPerWorkday = remainingWorkdays > 0 ? remainingHours / remainingWorkdays : remainingHours;
    const suggestedDailyHours = baseHours + avgNeedPerWorkday;
    const progress = targetHours > 0 ? Math.min(100, (totalOvertime / targetHours) * 100) : 0;

    return {
      totalWorked: round2(totalWorked),
      totalSelfRated: round2(totalSelfRated),
      totalLeave: round2(totalLeave),
      totalOvertime: round2(totalOvertime),
      remainingHours: round2(remainingHours),
      remainingWorkdays,
      workedDays,
      excludedDays,
      avgWorked: round2(avgWorked),
      avgNeedPerWorkday: round2(avgNeedPerWorkday),
      suggestedDailyHours: round2(suggestedDailyHours),
      progress: round2(progress),
    };
  }, [monthEntries, targetHours, baseHours, todayStr]);

  const distribution = useMemo(() => {
    const normalDays = monthEntries.filter((item) => item.dayType === "normal" && item.hasAnyInput);
    return {
      normal: normalDays.filter((item) => item.overtime <= 0).length,
      light: normalDays.filter((item) => item.overtime > 0 && item.overtime <= 1.5).length,
      medium: normalDays.filter((item) => item.overtime > 1.5 && item.overtime <= 3).length,
      heavy: normalDays.filter((item) => item.overtime > 3).length,
    };
  }, [monthEntries]);

  const statusStats = useMemo(() => {
    return {
      noOvertime: monthEntries.filter((item) => item.dayType === "noOvertime").length,
      holiday: monthEntries.filter((item) => item.dayType === "holiday").length,
    };
  }, [monthEntries]);

  const chartData = useMemo(() => {
    return monthEntries
      .filter((item) => item.hasAnyInput)
      .map((item) => ({
        day: `${item.day}日`,
        overtime: round2(item.overtime),
      }));
  }, [monthEntries]);

  const updateEntry = (dateStr, patch) => {
    setEntries((prev) => ({
      ...prev,
      [dateStr]: {
        ...normalizeEntry(prev[dateStr]),
        ...patch,
      },
    }));
  };

  const fillBlankWorkdays = () => {
    setEntries((prev) => {
      const next = { ...prev };
      monthEntries.forEach((item) => {
        if (item.dayType === "normal" && !item.weekend) {
          const current = normalizeEntry(next[item.dateStr]);
          if (current.workedHours === "" || current.workedHours === undefined || current.workedHours === null) {
            next[item.dateStr] = {
              ...current,
              workedHours: baseHours,
            };
          }
        }
      });
      return next;
    });
  };

  const clearCurrentMonth = () => {
    setEntries((prev) => {
      const next = { ...prev };
      monthEntries.forEach((item) => {
        delete next[item.dateStr];
      });
      return next;
    });
    setSelectedDate(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-300">加班管理</div>
              <h1 className="mt-2 text-3xl font-bold">每月加班追踪器</h1>
              <p className="mt-2 text-sm text-slate-300">
                直接按日历录入工时，并支持请假、出差、节假日。
              </p>
              <p className="mt-2 text-xs text-slate-400">{saveStatus}</p>
              <p className="mt-1 break-all text-xs text-slate-400">数据文件：{storagePath}</p>
            </div>
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 md:w-auto">
              <label className="rounded-2xl border border-white/10 bg-white/10 p-3">
                <div className="mb-1 text-xs text-slate-300">统计月份</div>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    setSelectedDate(null);
                  }}
                  className="w-full bg-transparent text-white outline-none"
                />
              </label>
              <label className="rounded-2xl border border-white/10 bg-white/10 p-3">
                <div className="mb-1 text-xs text-slate-300">月目标加班（小时）</div>
                <input
                  type="number"
                  step="0.5"
                  value={targetHours}
                  onChange={(e) => setTargetHours(Number(e.target.value) || 0)}
                  className="w-full bg-transparent text-white outline-none"
                />
              </label>
              <label className="rounded-2xl border border-white/10 bg-white/10 p-3">
                <div className="mb-1 text-xs text-slate-300">基础工时（小时）</div>
                <input
                  type="number"
                  step="0.5"
                  value={baseHours}
                  onChange={(e) => setBaseHours(Number(e.target.value) || 0)}
                  className="w-full bg-transparent text-white outline-none"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Clock3} title="已累计加班" value={`${metrics.totalOvertime} 小时`} subtitle={`目标 ${targetHours} 小时`} />
          <StatCard icon={Target} title="还差多少" value={`${metrics.remainingHours} 小时`} subtitle={metrics.remainingHours === 0 ? "已达成本月目标" : "继续加油"} />
          <StatCard icon={CalendarDays} title="剩余可加班日" value={`${metrics.remainingWorkdays} 天`} subtitle="已自动排除节假日和不计加班日" />
          <StatCard icon={TrendingUp} title="平均每天还要上" value={`${metrics.suggestedDailyHours} 小时`} subtitle={`其中约 ${metrics.avgNeedPerWorkday} 小时算加班`} />
        </div>

        <div className={`grid grid-cols-1 items-start gap-6 ${selectedItem ? "xl:grid-cols-[1.65fr_0.95fr]" : ""}`}>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">每日工时录入</h2>
                <p className="mt-1 text-sm text-slate-500">月视图只看概览，点中某一天后在右侧编辑。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMonth((prev) => shiftMonth(prev, -1));
                    setSelectedDate(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50"
                >
                  <ChevronLeft className="h-4 w-4" /> 上月
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMonth((prev) => shiftMonth(prev, 1));
                    setSelectedDate(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50"
                >
                  下月 <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={fillBlankWorkdays}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-white hover:opacity-90"
                >
                  未填普通工作日补 {baseHours} 小时
                </button>
                <button
                  type="button"
                  onClick={clearCurrentMonth}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  <Trash2 className="h-4 w-4" /> 清空本月
                </button>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-7 gap-3">
              {WEEK_LABELS.map((label) => (
                <div key={label} className="py-2 text-center text-sm font-medium text-slate-500">
                  周{label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-3">
              {calendarCells.map((cell) => {
                if (cell.type === "empty") {
                  return <div key={cell.key} className="min-h-[124px] rounded-2xl" />;
                }

                const item = monthEntries.find((entry) => entry.dateStr === cell.key);
                return (
                  <CalendarDayCard
                    key={cell.key}
                    item={item}
                    isSelected={selectedItem?.dateStr === item.dateStr}
                    onSelect={() => setSelectedDate(item.dateStr)}
                  />
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-500">
              <div className="inline-flex items-center gap-1.5">
                <Dot className="h-4 w-4 text-slate-400" />普通工作日
              </div>
              <div className="inline-flex items-center gap-1.5">
                <Dot className="h-4 w-4 text-amber-400" />节假日
              </div>
              <div className="inline-flex items-center gap-1.5">
                <Dot className="h-4 w-4 text-slate-500" />不计加班日
              </div>
              <div className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-slate-700" />深色表示加班较高
              </div>
            </div>
          </div>

          {selectedItem ? (
            <DayDetailPanel
              item={selectedItem}
              baseHours={baseHours}
              onUpdate={(patch) => updateEntry(selectedItem.dateStr, patch)}
              onClose={() => setSelectedDate(null)}
            />
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-slate-700" />
              <h2 className="text-xl font-bold text-slate-900">加班时长分布</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">按天看加班时长分布，更容易看出这个月的高强度日期。</p>

            <div className="mt-4 h-64">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                  录入几天后，这里会自动显示你的工时分布
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={28} />
                    <Tooltip
                      cursor={{ fill: "rgba(148, 163, 184, 0.10)" }}
                      contentStyle={{ borderRadius: 16, border: "1px solid #e2e8f0" }}
                      formatter={(value, name) => {
                        return [`${value} 小时`, "加班时长"];
                      }}
                    />
                    <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                    <Bar dataKey="overtime" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniStat label="无加班" value={`${distribution.normal} 天`} />
              <MiniStat label="轻度加班" value={`${distribution.light} 天`} />
              <MiniStat label="中度加班" value={`${distribution.medium} 天`} tone="mid" />
              <MiniStat label="高强度日" value={`${distribution.heavy} 天`} tone="strong" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">本月进度</h2>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                <span>完成度</span>
                <span>{metrics.progress}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${metrics.progress}%` }} />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                <span className="text-slate-500">本月总工时</span>
                <span className="font-semibold text-slate-900">{metrics.totalWorked} 小时</span>
              </div>
              <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                <span className="text-slate-500">自评工时</span>
                <span className="font-semibold text-slate-900">{metrics.totalSelfRated} 小时</span>
              </div>
              <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                <span className="text-slate-500">本月请假折算</span>
                <span className="font-semibold text-slate-900">{metrics.totalLeave} 小时</span>
              </div>
              <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                <span className="text-slate-500">实际录入工时天数</span>
                <span className="font-semibold text-slate-900">{metrics.workedDays} 天</span>
              </div>
              <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                <span className="text-slate-500">特殊标记天数</span>
                <span className="font-semibold text-slate-900">{metrics.excludedDays} 天</span>
              </div>
              <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                <span className="text-slate-500">录入日平均工时</span>
                <span className="font-semibold text-slate-900">{metrics.avgWorked} 小时</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">本月特殊日期</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniStat label="不计加班日" value={`${statusStats.noOvertime} 天`} />
              <MiniStat label="节假日" value={`${statusStats.holiday} 天`} tone="mid" />
            </div>
            <div className="mt-4 text-sm leading-6 text-slate-500">
              未来出差、培训、外部会议这种不会拿到加班的日期，标成“不计加班”即可；法定假期或你想排除掉的日期，标成“节假日”即可。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
