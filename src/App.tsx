import { useState, useEffect } from "react";
const STORAGE_KEY = "gym_tracker_data_v3";
const defaultGroups = [
{ id: "pecho", name: "Pecho / Tríceps", exercises: [] },
{ id: "espalda", name: "Espalda / Bíceps", exercises: [] },
{ id: "piernas", name: "Pierna / Isquiotibiales", exercises: [] },
{ id: "hombros", name: "Hombros / Brazos", exercises: [] },
{ id: "cuadriceps", name: "Pierna / Cuádriceps", exercises: [] },
{ id: "solocardio", name: "Solo Cardio", exercises: [] },
{ id: "descanso", name: "Descanso", exercises: [] },
];
function migrateData(raw: any) {
if (raw.groups) {
raw.groups = raw.groups.map((g: any) => {
if (g.id === "descanso" && g.exercises && g.exercises.length > 0) {
return { ...g, id: "cuadriceps" };
}
return g;
});
const hasDescanso = raw.groups.some((g: any) => g.id === "descanso");
if (!hasDescanso) {
raw.groups.push({ id: "descanso", name: "Descanso", exercises: [] });
}
if (raw.log) {
const cuadGroup = raw.groups.find((g: any) => g.id === "cuadriceps");
if (cuadGroup && cuadGroup.exercises.length > 0) {
const newLog: any = {};
Object.entries(raw.log).forEach(([key, val]: any) => {
if (key.endsWith("_descanso") && Object.keys(val).some((k: string) => k !== "_compl
const newKey = key.replace(/_descanso$/, "_cuadriceps");
newLog[newKey] = val;
const dateKey = key.substring(0, 10);
if (raw.schedule && raw.schedule[dateKey] === "descanso") {
raw.schedule[dateKey] = "cuadriceps";
}
} else {
newLog[key] = val;
}
});
raw.log = newLog;
}
}
}
return raw;
}
function loadData() {
try {
const raw = localStorage.getItem(STORAGE_KEY);
if (raw) return JSON.parse(raw);
const v2 = localStorage.getItem("gym_tracker_data_v2");
if (v2) {
const parsed = JSON.parse(v2);
const migrated = migrateData(parsed);
localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
return migrated;
}
} catch {
return { groups: defaultGroups, log: {}, schedule: {} };
return { groups: defaultGroups, log: {}, schedule: {} };
}
}
function saveData(d: any) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
function getDateKey(date: Date) { return date.toISOString().split("T")[0]; }
function formatDate(dateStr: string, opts: any) {
return new Date(dateStr + "T12:00:00").toLocaleDateString("es-MX", opts);
function getDaysInMonth(year: number, month: number) {
return new Date(year, month + 1, 0).getDate();
}
}
function getFirstDayOfMonth(year: number, month: number) {
const d = new Date(year, month, 1).getDay();
return (d + 6) % 7;
}
// Build progress data for a given group+exercise using real session dates (last 8 sessions)
function buildProgressData(log: any, groupId: string, exId: number) {
// Collect all sessions for this group+exercise
const sessions: { date: string; sets: any[] }[] = [];
Object.entries(log || {}).forEach(([key, val]: any) => {
if (!val._complete) return;
const dateKey = key.substring(0, 10);
const keyGroupId = key.substring(11);
if (keyGroupId !== groupId) return;
const sets = val[exId];
if (!sets || !Array.isArray(sets)) return;
sessions.push({ date: dateKey, sets });
});
// Sort by date, take last 8
sessions.sort((a, b) => a.date.localeCompare(b.date));
const last8 = sessions.slice(-8);
// How many sets max
let maxSets = 0;
last8.forEach(s => { if (s.sets.length > maxSets) maxSets = s.sets.length; });
// Build series data using real dates as labels
const seriesData: { weekLabel: string; weights: (number | null)[] }[] = last8.map(session =
const d = new Date(session.date + "T12:00:00");
const label = `${d.getDate()}/${d.getMonth() + 1}`;
const weights: (number | null)[] = Array.from({ length: maxSets }, (_, i) => {
const s = session.sets[i];
if (!s || !s.weight) return null;
return parseFloat(s.weight);
});
return { weekLabel: label, weights };
});
return { seriesData, maxSets };
}
const SERIES_COLORS = ["#c8ff00", "#4ecdc4", "#ff6b6b", "#f9ca24", "#6c5ce7", "#fd79a8"];
const GROUP_COLORS: any = {
pecho: "#ff6b6b",
espalda: "#4ecdc4",
piernas: "#45b7d1",
hombros: "#f9ca24",
cuadriceps: "#6c5ce7",
solocardio: "#00b4d8",
descanso: "#333",
};
const getGroupColor = (id: string) => GROUP_COLORS[id] || "#c8ff00";
export default function GymTracker() {
const [data, setData] = useState(loadData);
const [view, setView] = useState("today");
const [selectedDate, setSelectedDate] = useState(getDateKey(new Date()));
const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
const [expandedExIds, setExpandedExIds] = useState<Set<number>>(new Set());
const [newExName, setNewExName] = useState("");
const [toast, setToast] = useState<string | null>(null);
const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
const [calMonth, setCalMonth] = useState(() => {
const n = new Date();
return { year: n.getFullYear(), month: n.getMonth() };
});
const [progressGroup, setProgressGroup] = useState<string>("");
const [progressEx, setProgressEx] = useState<number | null>(null);
const [progressGroupOpen, setProgressGroupOpen] = useState(false);
const [progressExOpen, setProgressExOpen] = useState(false);
const [cardioOpen, setCardioOpen] = useState(false);
useEffect(() => { saveData(data); }, [data]);
const showToast = (msg: string) => {
setToast(msg);
setTimeout(() => setToast(null), 2200);
};
const exportData = () => {
const json = JSON.stringify(data, null, 2);
const blob = new Blob([json], { type: "application/json" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = `gymlog-backup-${getDateKey(new Date())}.json`;
a.click();
URL.revokeObjectURL(url);
showToast("Backup descargado ✓");
};
const importData = (e: any) => {
const file = e.target.files[0];
if (!file) return;
const reader = new FileReader();
reader.onload = (ev: any) => {
try {
const parsed = JSON.parse(ev.target.result);
if (!parsed.groups) throw new Error("Formato inválido");
const migrated = migrateData(parsed);
setData(migrated);
saveData(migrated);
showToast("Datos restaurados ✓");
} catch {
showToast("Error: archivo inválido");
}
};
reader.readAsText(file);
e.target.value = "";
};
const todayKey = getDateKey(new Date());
const groups: any[] = data.groups || [];
const getAssignedGroupId = (dk: string) => data.schedule?.[dk] ?? null;
const getAssignedGroup = (dk: string) => groups.find(g => g.id === getAssignedGroupId(dk))
const assignGroup = (dk: string, groupId: string) => {
setData((d: any) => ({ ...d, schedule: { ...d.schedule, [dk]: groupId } }));
setGroupDropdownOpen(false);
};
const getLogKey = (dk: string, groupId: string) => `${dk}_${groupId}`;
const logSet = (dk: string, groupId: string, exId: number, setIdx: number, field: string, v
const key = getLogKey(dk, groupId);
setData((d: any) => {
const log = { ...(d.log || {}) };
if (!log[key]) log[key] = {};
const sets = [...(log[key][exId] || [])];
while (sets.length <= setIdx) sets.push({ reps: "", weight: "" });
sets[setIdx] = { ...sets[setIdx], [field]: val };
log[key] = { ...log[key], [exId]: sets };
return { ...d, log };
});
};
const getLog = (dk: string, groupId: string, exId: number) =>
data.log?.[getLogKey(dk, groupId)]?.[exId] || [];
// Find most recent previous session weight for this group+exercise+setIndex
const getBestWeight = (groupId: string, exId: number, setIdx: number): string => {
const entries = Object.entries(data.log || {})
.filter(([key, val]: any) => {
const gid = key.substring(11);
return gid === groupId && (val as any)._complete;
});
let best = 0;
entries.forEach(([, val]: any) => {
const sets = val[exId];
if (!sets || !Array.isArray(sets) || !sets[setIdx]) return;
const w = parseFloat(sets[setIdx].weight);
if (!isNaN(w) && w > best) best = w;
});
return best > 0 ? String(best) : "";
};
const markComplete = (dk: string, groupId: string) => {
const key = getLogKey(dk, groupId);
setData((d: any) => ({ ...d, log: { ...d.log, [key]: { ...(d.log[key] || {}), _complete:
showToast("¡Entrenamiento completado! ");
};
const isComplete = (dk: string, groupId: string) =>
!!data.log?.[getLogKey(dk, groupId)]?._complete;
const getCardioKey = (dk: string) => `${dk}_cardio`;
const getCardioLog = (dk: string): any[] =>
data.log?.[getCardioKey(dk)]?.activities || [];
const addCardioActivity = (dk: string) => {
const key = getCardioKey(dk);
setData((d: any) => {
const existing = d.log?.[key]?.activities || [];
return {
...d,
log: {
...d.log,
[key]: { activities: [...existing, { id: Date.now(), type: "", duration: "" }] }
}
};
});
};
const updateCardioActivity = (dk: string, id: number, field: string, val: string) => {
const key = getCardioKey(dk);
setData((d: any) => {
const existing = d.log?.[key]?.activities || [];
return {
...d,
log: {
...d.log,
[key]: {
activities: existing.map((a: any) => a.id === id ? { ...a, [field]: val } : a)
}
}
};
});
};
const removeCardioActivity = (dk: string, id: number) => {
const key = getCardioKey(dk);
setData((d: any) => {
const existing = d.log?.[key]?.activities || [];
return {
...d,
log: {
...d.log,
[key]: { activities: existing.filter((a: any) => a.id !== id) }
}
};
});
};
const toggleEx = (exId: number) => {
setExpandedExIds(prev => {
const next = new Set(prev);
if (next.has(exId)) next.delete(exId); else next.add(exId);
return next;
});
};
const addExercise = (groupId: string) => {
if (!newExName.trim()) return;
setData((d: any) => ({
...d,
groups: d.groups.map((g: any) => g.id === groupId
? { ...g, exercises: [...g.exercises, { id: Date.now(), name: newExName.trim(), sets:
: g)
}));
setNewExName("");
showToast("Ejercicio añadido ✓");
};
const removeExercise = (groupId: string, exId: number) => {
setData((d: any) => ({
...d,
groups: d.groups.map((g: any) => g.id === groupId
? { ...g, exercises: g.exercises.filter((e: any) => e.id !== exId) }
: g)
}));
};
const updateExField = (groupId: string, exId: number, field: string, val: any) => {
setData((d: any) => ({
...d,
groups: d.groups.map((g: any) => g.id === groupId
? { ...g, exercises: g.exercises.map((e: any) => e.id === exId ? { ...e, [field]: val
: g)
}));
};
const updateGroupName = (groupId: string, name: string) => {
setData((d: any) => ({ ...d, groups: d.groups.map((g: any) => g.id === groupId ? { ...g,
};
const addGroup = () => {
const id = `g${Date.now()}`;
setData((d: any) => ({ ...d, groups: [...d.groups, { id, name: "Nuevo grupo", exercises:
setActiveGroupId(id);
showToast("Grupo añadido ✓");
};
const removeGroup = (groupId: string) => {
setData((d: any) => ({ ...d, groups: d.groups.filter((g: any) => g.id !== groupId) if (activeGroupId === groupId) setActiveGroupId(null);
}));
};
const moveGroup = (index: number, dir: -1 | 1) => {
const newIndex = index + dir;
if (newIndex < 0 || newIndex >= groups.length) return;
setData((d: any) => {
const newGroups = [...d.groups];
const [moved] = newGroups.splice(index, 1);
newGroups.splice(newIndex, 0, moved);
return { ...d, groups: newGroups };
});
};
const getLogForDate = (dk: string) => {
const entry = Object.entries(data.log || {}).find(([key]: any) =>
key.startsWith(dk) && !key.endsWith("_cardio") && (data.log[key] as any)._complete
);
const cardioEntry = data.log?.[`${dk}_cardio`];
const cardioCount = cardioEntry?.activities?.filter((a: any) => a.type).length || 0;
if (!entry && cardioCount === 0) return null;
if (!entry && cardioCount > 0) {
return { groupId: "solocardio", groupName: "Solo Cardio", exCount: 0, totalSets: 0, car
}
const [key, val]: any = entry!;
const groupId = key.substring(11);
if (groupId === "descanso") return { groupId: "descanso", groupName: "Descanso", exCount:
const group = groups.find(g => g.id === groupId);
const exEntries = Object.entries(val).filter(([k]) => k !== "_complete");
const totalSets = exEntries.reduce((acc: number, [, sets]: any) =>
acc + (Array.isArray(sets) ? sets.filter((s: any) => s.reps).length : 0), 0);
return { groupId, groupName: group?.name || groupId, exCount: exEntries.length, totalSets
};
const getHistory = () => {
const entries: any[] = [];
Object.entries(data.log || {}).forEach(([key, val]: any) => {
if (!val._complete) return;
const dateKey = key.substring(0, 10);
const groupId = key.substring(11);
if (groupId === "descanso") return; // exclude rest days
const group = groups.find(g => g.id === groupId);
entries.push({ dateKey, groupId, groupName: group?.name || groupId, val, group });
});
return entries.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
};
const assignedGroup = getAssignedGroup(selectedDate);
const assignedGroupId = getAssignedGroupId(selectedDate);
const prevMonth = () => setCalMonth(m => {
const d = new Date(m.year, m.month - 1, 1);
return { year: d.getFullYear(), month: d.getMonth() };
});
const nextMonth = () => setCalMonth(m => {
const d = new Date(m.year, m.month + 1, 1);
return { year: d.getFullYear(), month: d.getMonth() };
});
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
// Progress chart
const progressGroupData = groups.find(g => g.id === progressGroup);
const progressExData = progressGroupData?.exercises?.find((e: any) => e.id === progressEx);
const chartData = progressGroup && progressEx
? buildProgressData(data.log, progressGroup, progressEx)
: null;
const renderChart = () => {
if (!chartData) return null;
const { seriesData, maxSets } = chartData;
if (maxSets === 0) return <div className="empty">Sin datos registrados para este ejercici
const W = 320;
const H = 180;
const PAD = { top: 16, right: 16, bottom: 28, left: 40 };
const chartW = W - PAD.left - PAD.right;
const chartH = H - PAD.top - PAD.bottom;
// Find min/max weight across all series and weeks
let minW = Infinity, maxW = -Infinity;
seriesData.forEach(w => {
w.weights.forEach(v => {
if (v !== null) { if (v < minW) minW = v; if (v > maxW) maxW = v; }
});
});
if (minW === Infinity) return <div className="empty">Sin datos registrados para este ejer
const padding = (maxW - minW) * 0.15 || 5;
const yMin = Math.max(0, minW - padding);
const yMax = maxW + padding;
const xScale = (i: number) => PAD.left + (i / (seriesData.length - 1)) * chartW;
const yScale = (v: number) => PAD.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
// Y axis ticks
const yTicks = 4;
const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) =>
Math.round((yMin + (i / yTicks) * (yMax - yMin)) * 10) / 10
);
return (
<svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: {/* Grid lines */}
{yTickVals.map((v, i) => (
<g key={i}>
<line x1={PAD.left} x2={PAD.left + chartW} y1={yScale(v)} y2={yScale(v)}
stroke="#1e1e1e" strokeWidth="1" />
<text x={PAD.left - 4} y={yScale(v) + 4} textAnchor="end"
fontSize="8" fill="#444">{v}</text>
"visib
</g>
))}
{/* X axis labels */}
{seriesData.map((w, i) => (
<text key={i} x={xScale(i)} y={H - 6} textAnchor="middle"
fontSize="8" fill="#444">{w.weekLabel}</text>
))}
{/* Series lines */}
{Array.from({ length: maxSets }, (_, si) => {
const points = seriesData
.map((w, xi) => w.weights[si] !== null ? { x: xScale(xi), y: yScale(w.weights[si]
.filter(Boolean) as { x: number; y: number; v: number }[];
if (points.length < 1) return null;
const color = SERIES_COLORS[si % SERIES_COLORS.length];
const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
return (
<g key={si}>
{points.length > 1 && (
<path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="
)}
{points.map((p, i) => (
<g key={i}>
<circle cx={p.x} cy={p.y} r="3" fill={color} />
<text x={p.x} y={p.y - 6} textAnchor="middle" fontSize="8" fill={color}>{p.
</g>
))}
</g>
);
})}
</svg>
);
};
return (
<div style={{ fontFamily: "'DM Mono', 'Courier New', monospace", background: "#0d0d0d", m
<style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Bar
* { box-sizing: border-box; margin: 0; padding: 0; }
::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #111; } :
input, select { background: #1a1a1a; border: 1px solid #2e2e2e; color: #e8e0d0; paddi
input:focus { border-color: #c8ff00; }
button { cursor: pointer; font-family: inherit; }
.tab-btn { background: transparent; border: none; color: #555; padding: 10px 14px; fo
.tab-btn.active { color: #c8ff00; border-bottom-color: #c8ff00; }
.tab-btn:hover { color: #aaa; }
.date-pill { background: #141414; border: 1px solid #222; color: #666; padding: 5px 8
.date-pill.sel { background: #c8ff00; color: #0d0d0d; border-color: #c8ff00; font-wei
.date-pill.today { border-color: #c8ff0055; }
.date-pill.done { border-color: #2a4000; }
.date-pill.rest { border-color: #222; }
.date-pill.assigned { border-color: #1e3000; color: #7a9a44; }
.date-pill:hover:not(.sel) { border-color: #444; color: #aaa; }
.ex-row { background: #111; border: 1px solid #1c1c1c; border-radius: 3px; margin-bot
.ex-row-header { display: flex; justify-content: space-between; align-items: center;
.ex-row-header:hover { background: #161616; }
.ex-body { padding: 0 13px 13px; border-top: 1px solid #1a1a1a; }
.num-input-reps { width: 58px; text-align: center; }
.num-input-weight { width: 76px; text-align: center; }
.set-label { font-size: 10px; color: #3a3a3a; letter-spacing: 0.06em; text-align: cen
.icon-btn { background: transparent; border: none; color: #333; font-size: 14px; padd
.icon-btn:hover { color: #ff4444; }
.move-btn { background: transparent; border: 1px solid #222; color: #444; font-size:
.move-btn:hover { border-color: #555; color: #aaa; }
.move-btn:disabled { color: #222; border-color: #1a1a1a; cursor: default; }
.complete-btn { background: #c8ff00; color: #0d0d0d; border: none; padding: 10px 20px
.complete-btn:hover { background: #d4ff22; }
.complete-btn:disabled { background: #1c1c1c; color: #3a3a3a; cursor: default; }
.complete-badge { background: #111800; border: 1px solid #3a5000; color: #c8ff00; pad
.add-btn { background: #181818; border: 1px solid #2a2a2a; color: #c8ff00; padding: 7
.add-btn:hover { background: #1f1f1f; border-color: #c8ff00; }
.toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); backg
@keyframes fadeUp { from { opacity:0; transform: translateX(-50%) translateY(8px); }
.slabel { font-size: 10px; color: #3a3a3a; letter-spacing: 0.16em; text-transform: up
.big-title { font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size
.empty { color: #2e2e2e; font-size: 13px; padding: 18px 0; text-align: center; }
.group-card { background: #0f0f0f; border: 1px solid #1c1c1c; border-radius: 3px; mar
.group-card-hdr { display: flex; align-items: center; justify-content: space-between;
.group-card-hdr:hover { background: #141414; }
.dropdown-btn { width: 100%; background: #141414; border: 1px solid #2a2a2a; color: #
.dropdown-btn:hover, .dropdown-btn.open { border-color: #c8ff00; }
.dropdown-menu { background: #141414; border: 1px solid #2a2a2a; border-radius: 3px;
.dropdown-item { padding: 10px 14px; font-size: 13px; cursor: pointer; display: flex;
.dropdown-item:hover { background: #1a1a1a; }
.dropdown-item.sel { color: #c8ff00; background: #182000; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.cal-day-header { font-size: 10px; color: #444; text-align: center; padding: 4px 0; }
.cal-day { background: #111; border-radius: 3px; min-height: 52px; padding: 4px; }
.cal-day.has-entry { background: #131313; border: 1px solid #1f1f1f; cursor: pointer;
.cal-day.has-entry:hover { border-color: #333; }
.cal-day.is-today { border: 1px solid #c8ff0033; }
.cal-day.is-rest { background: #0d0d0d; }
.cal-day.empty-day { background: transparent; }
.cal-day-num { font-size: 11px; color: #444; margin-bottom: 2px; }
.cal-day.is-today .cal-day-num { color: #c8ff00; }
.cal-dot { width: 6px; height: 6px; border-radius: 50%; margin-bottom: 2px; }
.cal-day-label { font-size: 9px; color: #666; line-height: 1.3; }
.cardio-section { background: #0f0f0f; border: 1px solid #1c1c1c; border-radius: 3px;
.cardio-header { display: flex; justify-content: space-between; align-items: center;
.cardio-header:hover { background: #141414; }
.cardio-row { display: flex; gap: 8px; align-items: center; padding: 6px 13px; .cardio-input-type { flex: 1; }
.cardio-input-dur { width: 70px; }
`}</style>
border
{/* Header */}
<div style={{ borderBottom: "1px solid #161616", padding: "14px 16px", display: "flex",
<div>
<div style={{ fontSize: 9, color: "#3a3a3a", letterSpacing: "0.22em", textTransform
<div className="big-title">REGISTRO<br />DE RUTINA</div>
</div>
<div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItem
})}
<div>
<div style={{ fontSize: 9, color: "#3a3a3a", letterSpacing: "0.1em", textTransfor
<div style={{ fontSize: 13, color: "#c8ff00", marginTop: 2 }}>
{formatDate(todayKey, { weekday: "short", day: "numeric", month: "short" </div>
</div>
<div style={{ display: "flex", gap: 6 }}>
<button className="add-btn" style={{ fontSize: 10, padding: "5px 10px" }} onClick
<label className="add-btn" style={{ fontSize: 10, padding: "5px 10px", cursor: "p
↑ Importar
<input type="file" accept=".json" onChange={importData} style={{ display: "none
</label>
</div>
</div>
</div>
{/* Tabs: Hoy | Historial | Progreso | Rutina */}
<div style={{ borderBottom: "1px solid #161616", display: "flex", paddingLeft: 8, overf
{[["today", "Hoy"], ["history", "Historial"], ["progress", "Progreso"], ["routine", "
<button key={v} className={`tab-btn${view === v ? " active" : ""}`} onClick={() =>
))}
</div>
<div style={{ padding: "13px 13px 80px" }}>
{/* ── HOY ── */}
{view === "today" && (
<div>
<div className="slabel">Fecha</div>
<div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 10, marg
{Array.from({ length: 14 }, (_, i) => {
const d = new Date(); d.setDate(d.getDate() - i);
const dk = getDateKey(d);
const gid = getAssignedGroupId(dk);
const done = gid && isComplete(dk, gid);
const isRest = gid === "descanso";
return (
<button key={dk}
className={`date-pill${selectedDate === dk ? " sel" : ""}${dk === todayKe
onClick={() => setSelectedDate(dk)}>
<div style={{ fontSize: 9, opacity: 0.65 }}>{formatDate(dk, { weekday: "s
<div style={{ fontSize: 12, fontWeight: 600 }}>{formatDate(dk, { day: "nu
{done && !isRest && <div style={{ fontSize: 8, color: selectedDate {isRest && <div style={{ fontSize: 9, color: selectedDate === dk ? === dk
"#0d0d
</button>
);
})}
</div>
<div className="slabel">Grupo muscular</div>
<div style={{ marginBottom: 16 }}>
<button
className={`dropdown-btn${groupDropdownOpen ? " open" : ""}`}
onClick={() => setGroupDropdownOpen(o => !o)}>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
{assignedGroup ? (
<>
<span style={{ width: 8, height: 8, borderRadius: "50%", background: ge
<span>{assignedGroup.name}</span>
</>
) : (
<span style={{ color: "#444" }}>Selecciona un grupo muscular...</span>
: "▼"}
)}
</div>
<span style={{ color: "#444", fontSize: 10 }}>{groupDropdownOpen ? "▲" </button>
{groupDropdownOpen && (
<div className="dropdown-menu">
{groups.map(g => (
<div key={g.id}
className={`dropdown-item${assignedGroupId === g.id ? " sel" : ""}`}
onClick={() => assignGroup(selectedDate, g.id)}>
<span style={{ width: 8, height: 8, borderRadius: "50%", background: ge
<span>{g.name}</span>
{assignedGroupId === g.id && <span style={{ marginLeft: "auto", fontSiz
</div>
))}
</div>
)}
</div>
{!assignedGroup && <div className="empty">Selecciona un grupo muscular arriba</di
{assignedGroup && (
<>
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-b
<div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700
{assignedGroup.name}
</div>
{isComplete(selectedDate, assignedGroup.id)
? <span className="complete-badge">✓ Completado</span>
: <button className="complete-btn"
disabled={assignedGroup.id !== "descanso" && assignedGroup.id !== "so
onClick={() => markComplete(selectedDate, assignedGroup.id)}>
Completar
</button>
}
</div>
{assignedGroup.id === "descanso" && (
<div style={{ color: "#333", fontSize: 13, padding: "32px 0", textAlign: "c
<div style={{ fontSize: 28, marginBottom: 8 }}> </div>
Día de descanso
</div>
)}
{assignedGroup.id === "solocardio" && (
<div style={{ color: "#444", fontSize: 13, padding: "16px 0 8px", textAlign
Registra tus actividades de cardio abajo
</div>
)}
{assignedGroup.id !== "descanso" && assignedGroup.exercises.length === 0 && (
<div className="empty">Sin ejercicios - agrégalos en la pestaña Rutina</div
)}
{assignedGroup.id !== "descanso" && assignedGroup.exercises.map((ex: any) =>
const logged = getLog(selectedDate, assignedGroup.id, ex.id);
const isExpanded = expandedExIds.has(ex.id);
const completedSets = logged.filter((s: any) => s.reps).length;
return (
<div key={ex.id} className="ex-row">
<div className="ex-row-header" onClick={() => toggleEx(ex.id)}>
<div>
<div style={{ fontSize: 13, fontWeight: 500 }}>{ex.name}</div>
<div style={{ fontSize: 11, color: "#3a3a3a", marginTop: 2 }}>
{ex.sets}×{ex.reps} · {ex.weight}kg
{completedSets > 0 && <span style={{ color: "#c8ff0077", marginLe
</div>
</div>
<span style={{ color: "#444", fontSize: 10 }}>{isExpanded ? "▲" : "▼"
</div>
{isExpanded && (
<div className="ex-body">
<div style={{ display: "grid", gridTemplateColumns: "22px 1fr 1fr",
<div className="set-label">-</div>
<div className="set-label">REPS</div>
<div className="set-label">KG</div>
{Array.from({ length: ex.sets }).map((_, i) => (
<>
<div key={`l${i}`} style={{ fontSize: 10, color: "#c8ff0055",
<input key={`r${i}`} className="num-input-reps" type="number"
value={logged[i]?.reps ?? ""}
onChange={e => logSet(selectedDate, assignedGroup.id, ex.id
<input key={`w${i}`} className="num-input-weight" type="numbe
value={logged[i]?.weight ?? ""}
onChange={e => logSet(selectedDate, assignedGroup.id, ex.id
</>
))}
</div>
</div>
)}
</div>
);
})}
{/* Cardio section - always visible when a group is selected */}
{assignedGroup.id !== "descanso" && (
<div className="cardio-section">
<div className="cardio-header" onClick={() => setCardioOpen(o => !o)}>
<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
<span style={{ width: 8, height: 8, borderRadius: "50%", background:
<span style={{ fontSize: 13, color: "#888" }}>Cardio</span>
{getCardioLog(selectedDate).length > 0 && (
<span style={{ fontSize: 11, color: "#00b4d844" }}>{getCardioLog(se
)}
</div>
<span style={{ fontSize: 10, color: "#444" }}>{cardioOpen ? "▲" : "▼"}<
</div>
{cardioOpen && (
<div style={{ paddingBottom: 10 }}>
{getCardioLog(selectedDate).length === 0 && (
<div style={{ fontSize: 12, color: "#2e2e2e", padding: "10px )}
13px"
{getCardioLog(selectedDate).map((a: any) => (
<div key={a.id} className="cardio-row">
<input className="cardio-input-type" placeholder="Tipo de cardio.
onChange={e => updateCardioActivity(selectedDate, a.id, "type",
<input className="cardio-input-dur" type="number" min="0" placeho
onChange={e => updateCardioActivity(selectedDate, a.id, "durati
<span style={{ fontSize: 11, color: "#444" }}>min</span>
<button className="icon-btn" onClick={() => removeCardioActivity(
</div>
))}
<div style={{ padding: "8px 13px 0" }}>
<button className="add-btn" style={{ fontSize: 11, padding: "5px 12
onClick={() => addCardioActivity(selectedDate)}>+ Actividad</butt
</div>
</div>
)}
</div>
)}
</>
)}
</div>
)}
{/* ── HISTORIAL ── */}
{view === "history" && (
<div>
</div>
</div>
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-betwe
<button className="icon-btn" style={{ fontSize: 20, color: "#666" }} onClick={p
<div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fo
{new Date(calMonth.year, calMonth.month, 1).toLocaleDateString("es-MX", { mon
<button className="icon-btn" style={{ fontSize: 20, color: "#666" }} onClick={n
<div className="cal-grid" style={{ marginBottom: 4 }}>
{WEEKDAYS.map(d => <div key={d} className="cal-day-header">{d}</div>)}
</div>
{(() => {
const daysInMonth = getDaysInMonth(calMonth.year, calMonth.month);
const firstDay = getFirstDayOfMonth(calMonth.year, calMonth.month);
const cells = [];
for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} className="cal
for (let d = 1; d <= daysInMonth; d++) {
const dk = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}-$
const entry = getLogForDate(dk);
const isToday = dk === todayKey;
const isRestDay = entry?.groupId === "descanso" || data.schedule?.[dk] cells.push(
<div key={dk}
className={`cal-day${entry && !isRestDay ? " has-entry" : ""}${isToday ?
onClick={() => { if (entry && !isRestDay) { setSelectedDate(dk); setView(
<div className="cal-day-num">{d}</div>
{isRestDay && (
<>
=== "d
<div className="cal-dot" style={{ background: "#333" }} />
<div className="cal-day-label" style={{ color: "#444" }}>Descanso</di
<div className="cal-day-label" style={{ color: "#2a2a2a", letterSpaci
</>
)}
{entry && !isRestDay && (
<>
<div className="cal-dot" style={{ background: getGroupColor(entry.gro
<div className="cal-day-label" style={{ color: getGroupColor(entry.gr
{entry.groupName.split(" / ")[0].split(" ")[0]}
</div>
{entry.groupId !== "solocardio" && (
<div className="cal-day-label">{entry.exCount}ej · {entry.totalSets
)}
{entry.cardioCount > 0 && (
<div className="cal-day-label" style={{ color: "#00b4d8" }}>{entry.
)}
</>
)}
</div>
);
}
})()}
return <div className="cal-grid" style={{ gap: 3 }}>{cells}</div>;
{/* Legend */}
<div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14, marginBot
{groups.filter(g => g.id !== "descanso").map(g => (
<div key={g.id} style={{ display: "flex", alignItems: "center", gap: 5, fontS
<span style={{ width: 7, height: 7, borderRadius: "50%", background: getGro
{g.name}
</div>
))}
</div>
regist
i: num
{/* Recent list */}
<div className="slabel" style={{ marginBottom: 10 }}>Registro reciente</div>
{getHistory().length === 0 && <div className="empty">No hay entrenamientos {getHistory().slice(0, 10).map(({ dateKey, groupName, val, groupId }: any, const exEntries = Object.entries(val).filter(([k]) => k !== "_complete");
const totalSets = exEntries.reduce((acc: number, [, sets]: any) =>
acc + (Array.isArray(sets) ? sets.filter((s: any) => s.reps).length : 0), 0);
return (
<div key={i} style={{ background: "#0f0f0f", border: "1px solid #181818", bor
<div style={{ display: "flex", justifyContent: "space-between", alignItems:
<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
<span style={{ width: 8, height: 8, borderRadius: "50%", background: ge
<div>
<div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeigh
<div style={{ fontSize: 10, color: "#3a3a3a" }}>
{formatDate(dateKey, { weekday: "short", day: "numeric", month: "sh
</div>
</div>
</div>
<div style={{ textAlign: "right", fontSize: 11, color: "#444" }}>
<div style={{ color: "#c8ff0077" }}>{exEntries.length} ejerc</div>
<div>{totalSets} sets</div>
</div>
</div>
</div>
);
})}
</div>
)}
{/* ── PROGRESO ── */}
{view === "progress" && (
<div>
<div className="slabel">Grupo muscular</div>
<div style={{ marginBottom: 12 }}>
<button className={`dropdown-btn${progressGroupOpen ? " open" : ""}`}
onClick={() => { setProgressGroupOpen(o => !o); setProgressExOpen(false); }}>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
{progressGroupData ? (
<>
<span style={{ width: 8, height: 8, borderRadius: "50%", background: ge
<span>{progressGroupData.name}</span>
: "▼"}
</>
) : <span style={{ color: "#444" }}>Selecciona un grupo...</span>}
</div>
<span style={{ color: "#444", fontSize: 10 }}>{progressGroupOpen ? "▲" </button>
{progressGroupOpen && (
<div className="dropdown-menu">
{groups.filter(g => g.id !== "descanso" && g.exercises.length > 0).map(g =>
<div key={g.id} className={`dropdown-item${progressGroup === g.id ? " sel
onClick={() => { setProgressGroup(g.id); setProgressEx(null); setProgre
<span style={{ width: 8, height: 8, borderRadius: "50%", background: ge
{g.name}
</div>
))}
</div>
)}
</div>
{progressGroupData && (
<>
<div className="slabel">Ejercicio</div>
<div style={{ marginBottom: 20 }}>
<button className={`dropdown-btn${progressExOpen ? " open" : ""}`}
onClick={() => setProgressExOpen(o => !o)}>
<span>{progressExData ? progressExData.name : <span style={{ color: "#444
<span style={{ color: "#444", fontSize: 10 }}>{progressExOpen ? "▲" : "▼"
</button>
{progressExOpen && (
<div className="dropdown-menu">
{progressGroupData.exercises.map((ex: any) => (
<div key={ex.id} className={`dropdown-item${progressEx === ex.id ? "
onClick={() => { setProgressEx(ex.id); setProgressExOpen(false); }}
{ex.name}
</div>
))}
</div>
)}
</div>
</>
)}
{chartData && progressExData && (
<div>
<div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
{progressExData.name}
</div>
<div style={{ fontSize: 10, color: "#444", marginBottom: 14 }}>Peso por serie
{/* Legend */}
<div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}
{Array.from({ length: chartData.maxSets }, (_, i) => (
<div key={i} style={{ display: "flex", alignItems: "center", gap: 5, font
<span style={{ width: 16, height: 2, background: SERIES_COLORS[i Serie {i + 1}
</div>
% SERI
))}
</div>
<div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadiu
{renderChart()}
</div>
<div style={{ fontSize: 10, color: "#333", marginTop: 8, textAlign: "center"
Cada punto = peso registrado ese día · toca para ver el valor
</div>
</div>
)}
{!progressGroup && (
<div className="empty">Selecciona un grupo y ejercicio para ver tu progreso</di
)}
{progressGroup && !progressEx && (
<div className="empty">Selecciona un ejercicio</div>
)}
</div>
)}
{/* ── RUTINA ── */}
{view === "routine" && (
<div>
<div className="slabel">Grupos musculares</div>
{groups.map((g: any, index: number) => (
<div key={g.id} className="group-card">
<div className="group-card-hdr" onClick={() => setActiveGroupId(activeGroupId
<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
<div style={{ display: "flex", flexDirection: "column", gap: 2 }} onClick
<button className="move-btn" disabled={index === 0} onClick={() => move
<button className="move-btn" disabled={index === groups.length - 1} onC
</div>
<span style={{ width: 8, height: 8, borderRadius: "50%", background: getG
<span style={{ fontSize: 13, color: activeGroupId === g.id ? "#c8ff00" :
<span style={{ fontSize: 11, color: "#333" }}>{g.exercises.length} ejerc.
</div>
<div style={{ display: "flex", gap: 4, alignItems: "center" }}>
<span style={{ fontSize: 10, color: "#333" }}>{activeGroupId === g.id ? "
<button className="icon-btn" onClick={e => { e.stopPropagation(); removeG
</div>
</div>
}}>
{activeGroupId === g.id && (
<div style={{ padding: "0 13px 13px", borderTop: "1px solid #181818" <div style={{ marginBottom: 12, marginTop: 12 }}>
<div className="slabel">Nombre del grupo</div>
<input value={g.name} onChange={e => updateGroupName(g.id, e.target.val
</div>
{(g.id === "descanso" || g.id === "solocardio") ? (
<div className="empty" style={{ padding: "10px 0", color: "#2a2a2a" }}>
{g.id === "descanso" ? "Sin ejercicios" : "Cardio libre - se registra
</div>
) : (
<>
<div className="slabel">Ejercicios</div>
{g.exercises.length === 0 && <div className="empty" style={{ padding:
{g.exercises.map((ex: any) => (
<div key={ex.id} className="ex-row">
<div style={{ display: "flex", justifyContent: "space-between", a
<input value={ex.name} onChange={e => updateExField(g.id, ex.id
style={{ background: "transparent", border: "none", borderBot
<button className="icon-btn" onClick={() => removeExercise(g.id
</div>
<div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding
{[["sets", "Sets"], ["reps", "Reps"], ["weight", "Peso kg"]].ma
<label key={f} style={{ fontSize: 11, color: "#555" }}>{l}<br
<input className="num-input-reps" type="number" min="0" ste
value={(ex as any)[f]} onChange={e => updateExField(g.id,
</label>
))}
</div>
</div>
))}
<div style={{ display: "flex", gap: 8, marginTop: 10 }}>
<input style={{ flex: 1 }} placeholder="Nombre del ejercicio..." va
onChange={e => setNewExName(e.target.value)}
onKeyDown={e => e.key === "Enter" && addExercise(g.id)} />
<button className="add-btn" onClick={() => addExercise(g.id)}>+ Aña
</div>
</>
)}
</div>
)}
</div>
))}
<button className="add-btn" style={{ marginTop: 10, width: "100%" }} onClick={add
+ Nuevo grupo muscular
</button>
</div>
)}
</div>
{toast && <div className="toast">{toast}</div>}
</div>
);
}
