import { useState, useEffect } from "react";

const STORAGE_KEY = "gym_tracker_data_v2";

const defaultGroups = [
  { id: "pecho", name: "Pecho / Tríceps", exercises: [] },
  { id: "espalda", name: "Espalda / Bíceps", exercises: [] },
  { id: "piernas", name: "Piernas", exercises: [] },
  { id: "hombros", name: "Hombros / Trapecios", exercises: [] },
  { id: "fullbody", name: "Full Body", exercises: [] },
  { id: "cardio", name: "Cardio / Core", exercises: [] },
  { id: "descanso", name: "Descanso", exercises: [] },
];

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    // migrar datos v1 si existen
    const v1 = localStorage.getItem("gym_tracker_data_v1");
    if (v1) {
      const old = JSON.parse(v1);
      const groups = Object.entries(old.routine).map(([, val], i) => ({
        id: `g${i}`, name: val.name, exercises: val.exercises || []
      }));
      return { groups, log: {}, schedule: {} };
    }
    return { groups: defaultGroups, log: {}, schedule: {} };
  } catch {
    return { groups: defaultGroups, log: {}, schedule: {} };
  }
}

function saveData(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

function getDateKey(date) { return date.toISOString().split("T")[0]; }

function formatDate(dateStr, opts) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-ES", opts);
}

function getRecentDates(n = 14) {
  const dates = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(getDateKey(d));
  }
  return dates;
}

export default function GymTracker() {
  const [data, setData] = useState(loadData);
  const [view, setView] = useState("today");
  const [selectedDate, setSelectedDate] = useState(getDateKey(new Date()));
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [newExName, setNewExName] = useState("");
  const [toast, setToast] = useState(null);

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

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.groups) throw new Error("Formato inválido");
        setData(parsed);
        saveData(parsed);
        showToast("Datos restaurados ✓");
      } catch {
        showToast("Error: archivo inválido");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  useEffect(() => { saveData(data); }, [data]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const todayKey = getDateKey(new Date());
  const groups = data.groups || [];

  const getAssignedGroupId = (dk) => data.schedule?.[dk] ?? null;
  const getAssignedGroup = (dk) => groups.find(g => g.id === getAssignedGroupId(dk)) || null;

  const assignGroup = (dk, groupId) => {
    setData(d => ({ ...d, schedule: { ...d.schedule, [dk]: groupId } }));
  };

  // Logging
  const getLogKey = (dk, groupId) => `${dk}_${groupId}`;

  const logSet = (dk, groupId, exId, setIdx, field, val) => {
    const key = getLogKey(dk, groupId);
    setData(d => {
      const log = { ...(d.log || {}) };
      if (!log[key]) log[key] = {};
      const sets = [...(log[key][exId] || [])];
      while (sets.length <= setIdx) sets.push({ reps: "", weight: "" });
      sets[setIdx] = { ...sets[setIdx], [field]: val };
      log[key] = { ...log[key], [exId]: sets };
      return { ...d, log };
    });
  };

  const getLog = (dk, groupId, exId) => data.log?.[getLogKey(dk, groupId)]?.[exId] || [];

  const markComplete = (dk, groupId) => {
    const key = getLogKey(dk, groupId);
    setData(d => ({ ...d, log: { ...d.log, [key]: { ...(d.log[key] || {}), _complete: true } } }));
    showToast("¡Entrenamiento completado! 💪");
  };

  const isComplete = (dk, groupId) => !!data.log?.[getLogKey(dk, groupId)]?._complete;

  // Routine management
  const addExercise = (groupId) => {
    if (!newExName.trim()) return;
    setData(d => ({
      ...d,
      groups: d.groups.map(g => g.id === groupId
        ? { ...g, exercises: [...g.exercises, { id: Date.now(), name: newExName.trim(), sets: 3, reps: 10, weight: 0 }] }
        : g)
    }));
    setNewExName("");
    showToast("Ejercicio añadido ✓");
  };

  const removeExercise = (groupId, exId) => {
    setData(d => ({
      ...d,
      groups: d.groups.map(g => g.id === groupId
        ? { ...g, exercises: g.exercises.filter(e => e.id !== exId) }
        : g)
    }));
  };

  const updateExField = (groupId, exId, field, val) => {
    setData(d => ({
      ...d,
      groups: d.groups.map(g => g.id === groupId
        ? { ...g, exercises: g.exercises.map(e => e.id === exId ? { ...e, [field]: val } : e) }
        : g)
    }));
  };

  const updateGroupName = (groupId, name) => {
    setData(d => ({ ...d, groups: d.groups.map(g => g.id === groupId ? { ...g, name } : g) }));
  };

  const addGroup = () => {
    const id = `g${Date.now()}`;
    setData(d => ({ ...d, groups: [...d.groups, { id, name: "Nuevo grupo", exercises: [] }] }));
    setActiveGroupId(id);
    showToast("Grupo añadido ✓");
  };

  const removeGroup = (groupId) => {
    setData(d => ({ ...d, groups: d.groups.filter(g => g.id !== groupId) }));
    if (activeGroupId === groupId) setActiveGroupId(null);
  };

  // History
  const getHistory = () => {
    const entries = [];
    Object.entries(data.log || {}).forEach(([key, val]) => {
      if (!val._complete) return;
      const dateKey = key.substring(0, 10);
      const groupId = key.substring(11);
      const group = groups.find(g => g.id === groupId);
      entries.push({ dateKey, groupId, groupName: group?.name || groupId, val, group });
    });
    return entries.sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, 30);
  };

  const recentDates = getRecentDates(14);
  const assignedGroup = getAssignedGroup(selectedDate);

  return (
    <div style={{ fontFamily: "'DM Mono', 'Courier New', monospace", background: "#0d0d0d", minHeight: "100vh", color: "#e8e0d0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Barlow+Condensed:wght@600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #333; }
        input, select { background: #1a1a1a; border: 1px solid #2e2e2e; color: #e8e0d0; padding: 6px 10px; font-family: inherit; font-size: 13px; border-radius: 2px; outline: none; transition: border-color 0.15s; }
        input:focus, select:focus { border-color: #c8ff00; }
        button { cursor: pointer; font-family: inherit; }
        .tab-btn { background: transparent; border: none; color: #555; padding: 10px 16px; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; transition: all 0.15s; border-bottom: 2px solid transparent; }
        .tab-btn.active { color: #c8ff00; border-bottom-color: #c8ff00; }
        .tab-btn:hover { color: #aaa; }
        .date-pill { background: #141414; border: 1px solid #222; color: #666; padding: 5px 8px; font-size: 11px; border-radius: 2px; transition: all 0.15s; white-space: nowrap; min-width: 52px; text-align: center; }
        .date-pill.sel { background: #c8ff00; color: #0d0d0d; border-color: #c8ff00; font-weight: 600; }
        .date-pill.today { border-color: #c8ff0055; }
        .date-pill.done { border-color: #2a4000; }
        .date-pill.assigned { border-color: #1e3000; color: #7a9a44; }
        .date-pill:hover:not(.sel) { border-color: #444; color: #aaa; }
        .group-chip { background: #131313; border: 1px solid #222; color: #666; padding: 8px 14px; font-size: 12px; border-radius: 2px; transition: all 0.15s; letter-spacing: 0.03em; text-align: left; }
        .group-chip.sel { background: #182000; border-color: #c8ff00; color: #c8ff00; }
        .group-chip:hover:not(.sel) { border-color: #3a3a3a; color: #aaa; }
        .ex-row { background: #111; border: 1px solid #1c1c1c; border-radius: 3px; padding: 13px; margin-bottom: 7px; }
        .ex-row:hover { border-color: #272727; }
        .num-input { width: 58px; text-align: center; }
        .set-label { font-size: 10px; color: #3a3a3a; letter-spacing: 0.06em; text-align: center; }
        .icon-btn { background: transparent; border: none; color: #333; font-size: 14px; padding: 2px 6px; transition: color 0.15s; }
        .icon-btn:hover { color: #ff4444; }
        .complete-btn { background: #c8ff00; color: #0d0d0d; border: none; padding: 10px 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; border-radius: 2px; transition: all 0.15s; }
        .complete-btn:hover { background: #d4ff22; }
        .complete-btn:disabled { background: #1c1c1c; color: #3a3a3a; cursor: default; }
        .complete-badge { background: #111800; border: 1px solid #3a5000; color: #c8ff00; padding: 7px 14px; font-size: 11px; letter-spacing: 0.08em; border-radius: 2px; }
        .add-btn { background: #181818; border: 1px solid #2a2a2a; color: #c8ff00; padding: 7px 16px; font-size: 12px; letter-spacing: 0.06em; border-radius: 2px; transition: all 0.15s; }
        .add-btn:hover { background: #1f1f1f; border-color: #c8ff00; }
        .hist-entry { background: #0f0f0f; border: 1px solid #181818; border-radius: 3px; padding: 13px; margin-bottom: 7px; }
        .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #c8ff00; color: #0d0d0d; padding: 10px 22px; font-size: 12px; font-weight: 700; border-radius: 2px; letter-spacing: 0.06em; z-index: 9999; pointer-events: none; animation: fadeUp 0.2s ease; }
        @keyframes fadeUp { from { opacity:0; transform: translateX(-50%) translateY(8px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
        .slabel { font-size: 10px; color: #3a3a3a; letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 7px; }
        .big-title { font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size: clamp(26px, 6vw, 40px); line-height: 1; }
        .empty { color: #2e2e2e; font-size: 13px; padding: 18px 0; text-align: center; }
        .group-card { background: #0f0f0f; border: 1px solid #1c1c1c; border-radius: 3px; margin-bottom: 6px; overflow: hidden; }
        .group-card-hdr { display: flex; align-items: center; justify-content: space-between; padding: 10px 13px; cursor: pointer; transition: background 0.12s; }
        .group-card-hdr:hover { background: #141414; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #161616", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 9, color: "#3a3a3a", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 3 }}>GymLog</div>
          <div className="big-title">REGISTRO<br />DE RUTINA</div>
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, color: "#3a3a3a", letterSpacing: "0.1em", textTransform: "uppercase" }}>Hoy</div>
            <div style={{ fontSize: 13, color: "#c8ff00", marginTop: 2 }}>
              {formatDate(todayKey, { weekday: "short", day: "numeric", month: "short" })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="add-btn" style={{ fontSize: 10, padding: "5px 10px" }} onClick={exportData}>↓ Exportar</button>
            <label className="add-btn" style={{ fontSize: 10, padding: "5px 10px", cursor: "pointer" }}>
              ↑ Importar
              <input type="file" accept=".json" onChange={importData} style={{ display: "none" }} />
            </label>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #161616", display: "flex", paddingLeft: 8 }}>
        {[["today","Hoy"],["routine","Rutina"],["history","Historial"]].map(([v,l]) => (
          <button key={v} className={`tab-btn${view===v?" active":""}`} onClick={() => setView(v)}>{l}</button>
        ))}
      </div>

      <div style={{ padding: "13px 13px 80px" }}>

        {/* ── HOY ── */}
        {view === "today" && (
          <div>
            <div className="slabel">Fecha</div>
            <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 10, marginBottom: 14 }}>
              {recentDates.map(dk => {
                const gid = getAssignedGroupId(dk);
                const done = gid && isComplete(dk, gid);
                return (
                  <button key={dk}
                    className={`date-pill${selectedDate===dk?" sel":""}${dk===todayKey?" today":""}${done?" done":gid?" assigned":""}`}
                    onClick={() => setSelectedDate(dk)}>
                    <div style={{ fontSize: 9, opacity: 0.65 }}>{formatDate(dk, { weekday: "short" })}</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{formatDate(dk, { day: "numeric" })}</div>
                    {done && <div style={{ fontSize: 8, color: selectedDate===dk ? "#0d0d0d" : "#c8ff00" }}>✓</div>}
                  </button>
                );
              })}
            </div>

            <div className="slabel">¿Qué trabajás hoy?</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6, marginBottom: 16 }}>
              {groups.map(g => (
                <button key={g.id}
                  className={`group-chip${getAssignedGroupId(selectedDate)===g.id?" sel":""}`}
                  onClick={() => assignGroup(selectedDate, g.id)}>
                  {g.name}
                </button>
              ))}
            </div>

            {!assignedGroup && (
              <div className="empty">Seleccioná un grupo muscular arriba</div>
            )}

            {assignedGroup && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 0 12px" }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 20 }}>
                    {assignedGroup.name}
                  </div>
                  {isComplete(selectedDate, assignedGroup.id)
                    ? <span className="complete-badge">✓ Completado</span>
                    : <button className="complete-btn"
                        disabled={assignedGroup.exercises.length === 0 || assignedGroup.id === "descanso"}
                        onClick={() => markComplete(selectedDate, assignedGroup.id)}>
                        Completar
                      </button>
                  }
                </div>

                {assignedGroup.id === "descanso" && (
                  <div style={{ color: "#333", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
                    😴 Día de descanso
                  </div>
                )}

                {assignedGroup.id !== "descanso" && assignedGroup.exercises.length === 0 && (
                  <div className="empty">Sin ejercicios — añadílos en la pestaña Rutina</div>
                )}

                {assignedGroup.id !== "descanso" && assignedGroup.exercises.map(ex => {
                  const logged = getLog(selectedDate, assignedGroup.id, ex.id);
                  return (
                    <div key={ex.id} className="ex-row">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 9 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{ex.name}</div>
                        <div style={{ fontSize: 11, color: "#3a3a3a" }}>{ex.sets}×{ex.reps} · {ex.weight}kg</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr", gap: "4px 8px" }}>
                        <div className="set-label">—</div>
                        <div className="set-label">REPS</div>
                        <div className="set-label">KG</div>
                        {Array.from({ length: ex.sets }).map((_, i) => (
                          <>
                            <div key={`l${i}`} style={{ fontSize: 10, color: "#c8ff0055", textAlign: "center", paddingTop: 8 }}>{i+1}</div>
                            <input key={`r${i}`} className="num-input" type="number" min="0" placeholder={String(ex.reps)}
                              value={logged[i]?.reps ?? ""}
                              onChange={e => logSet(selectedDate, assignedGroup.id, ex.id, i, "reps", e.target.value)} />
                            <input key={`w${i}`} className="num-input" type="number" min="0" step="0.5" placeholder={String(ex.weight)}
                              value={logged[i]?.weight ?? ""}
                              onChange={e => logSet(selectedDate, assignedGroup.id, ex.id, i, "weight", e.target.value)} />
                          </>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── RUTINA ── */}
        {view === "routine" && (
          <div>
            <div className="slabel">Grupos musculares</div>
            {groups.map(g => (
              <div key={g.id} className="group-card">
                <div className="group-card-hdr" onClick={() => setActiveGroupId(activeGroupId===g.id ? null : g.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, color: activeGroupId===g.id ? "#c8ff00" : "#999" }}>{g.name}</span>
                    <span style={{ fontSize: 11, color: "#333" }}>{g.exercises.length} ejerc.</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "#333" }}>{activeGroupId===g.id ? "▲" : "▼"}</span>
                    <button className="icon-btn" onClick={e => { e.stopPropagation(); removeGroup(g.id); }}>✕</button>
                  </div>
                </div>

                {activeGroupId === g.id && (
                  <div style={{ padding: "0 13px 13px", borderTop: "1px solid #181818" }}>
                    <div style={{ marginBottom: 12, marginTop: 12 }}>
                      <div className="slabel">Nombre del grupo</div>
                      <input value={g.name} onChange={e => updateGroupName(g.id, e.target.value)} style={{ width: "100%", maxWidth: 260 }} />
                    </div>
                    <div className="slabel">Ejercicios</div>
                    {g.exercises.length === 0 && <div className="empty" style={{ padding: "10px 0" }}>Sin ejercicios</div>}
                    {g.exercises.map(ex => (
                      <div key={ex.id} className="ex-row">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <input value={ex.name} onChange={e => updateExField(g.id, ex.id, "name", e.target.value)}
                            style={{ background: "transparent", border: "none", borderBottom: "1px solid #252525", color: "#e8e0d0", fontSize: 14, fontFamily: "inherit", padding: "2px 0", width: "65%" }} />
                          <button className="icon-btn" onClick={() => removeExercise(g.id, ex.id)}>✕</button>
                        </div>
                        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                          {[["sets","Sets"],["reps","Reps"],["weight","Peso kg"]].map(([f,l]) => (
                            <label key={f} style={{ fontSize: 11, color: "#555" }}>{l}<br />
                              <input className="num-input" type="number" min="0" step={f==="weight"?"0.5":"1"}
                                value={ex[f]} onChange={e => updateExField(g.id, ex.id, f, parseFloat(e.target.value)||0)} />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <input style={{ flex: 1 }} placeholder="Nombre del ejercicio..." value={newExName}
                        onChange={e => setNewExName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addExercise(g.id)} />
                      <button className="add-btn" onClick={() => addExercise(g.id)}>+ Añadir</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <button className="add-btn" style={{ marginTop: 10, width: "100%" }} onClick={addGroup}>
              + Nuevo grupo muscular
            </button>
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {view === "history" && (
          <div>
            <div className="slabel" style={{ marginBottom: 10 }}>Últimos entrenamientos</div>
            {getHistory().length === 0 && <div className="empty">No hay entrenamientos registrados aún</div>}
            {getHistory().map(({ dateKey, groupName, val, group }, i) => {
              const exEntries = Object.entries(val).filter(([k]) => k !== "_complete");
              const totalSets = exEntries.reduce((acc, [, sets]) => acc + (Array.isArray(sets) ? sets.filter(s => s.reps).length : 0), 0);
              return (
                <div key={i} className="hist-entry">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 17 }}>{groupName}</div>
                      <div style={{ fontSize: 11, color: "#3a3a3a", marginTop: 2 }}>
                        {formatDate(dateKey, { weekday: "long", day: "numeric", month: "long" })}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: 11, color: "#444" }}>
                      <div style={{ color: "#c8ff0077" }}>{exEntries.length} ejerc</div>
                      <div>{totalSets} sets</div>
                    </div>
                  </div>
                  {group && exEntries.map(([exId, sets]) => {
                    const ex = group.exercises.find(e => String(e.id) === exId);
                    if (!ex || !Array.isArray(sets)) return null;
                    const done = sets.filter(s => s.reps);
                    if (!done.length) return null;
                    return (
                      <div key={exId} style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #161616" }}>
                        <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{ex.name}</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {done.map((s, j) => (
                            <span key={j} style={{ background: "#181818", border: "1px solid #1f1f1f", padding: "3px 8px", borderRadius: 2, fontSize: 11, color: "#c8ff0077" }}>
                              {s.reps} reps{s.weight ? ` × ${s.weight}kg` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}