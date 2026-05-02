const STORAGE_KEY = "supplementChecklistDataV2";
const WEEK = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const defaultSupplements = [
  { name: "Complejo B", dose: "1 cápsula", frequencyType: "daily", daysOfWeek: [], dosesPerDay: 1, times: ["desayuno"], notes: "", optional: false, active: true },
  { name: "Omega-3", dose: "según etiqueta", frequencyType: "daily", daysOfWeek: [], dosesPerDay: 1, times: ["desayuno o comida"], notes: "", optional: false, active: true },
  { name: "Zinc + Selenio", dose: "1 cápsula", frequencyType: "daily", daysOfWeek: [], dosesPerDay: 1, times: ["comida"], notes: "", optional: false, active: true },
  { name: "Creatina", dose: "3–5 g", frequencyType: "daily", daysOfWeek: [], dosesPerDay: 1, times: ["después del gym"], notes: "", optional: false, active: true },
  { name: "Teanina", dose: "según etiqueta", frequencyType: "custom", daysOfWeek: [], dosesPerDay: 1, times: ["noche"], notes: "diaria o según necesidad", optional: true, active: true },
  { name: "Glucosamina", dose: "3 tabletas (total diario)", frequencyType: "daily", daysOfWeek: [], dosesPerDay: 3, times: ["desayuno", "comida", "cena"], notes: "Glucosamina sulfato 900 mg, MSM 900 mg, condroitina sulfato 150 mg", optional: false, active: true },
  { name: "Vitamina D3", dose: "1 cápsula por toma", frequencyType: "specific_days", daysOfWeek: [1, 3, 5], dosesPerDay: 1, times: ["desayuno"], notes: "Tomar con comida que tenga grasa", optional: false, active: true },
];

const state = { viewDate: todayKey(), data: loadData() };
if (!state.data.supplements?.length) state.data.supplements = defaultSupplements.map(s => ({ id: uid(), ...s }));
ensureDate(state.viewDate);
setupWeekdays();
bindEvents();
render();

function uid() { return crypto.randomUUID?.() || String(Date.now() + Math.random()); }
function todayKey() { return new Date().toISOString().slice(0, 10); }
function dateToDayIndex(k) { return new Date(k + "T00:00:00").getDay(); }
function ensureDate(d) { state.data.checkByDate[d] ||= {}; save(); }
function loadData() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { supplements: [], checkByDate: {} }; } catch { return { supplements: [], checkByDate: {} }; } }
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data)); }

function shouldShowToday(s, dateKey) {
  if (!s.active) return false;
  const day = dateToDayIndex(dateKey);
  if (s.frequencyType === "daily" || s.frequencyType === "custom") return true;
  if (s.frequencyType === "specific_days") return s.daysOfWeek.includes(day);
  if (s.frequencyType === "weekly") return s.daysOfWeek[0] === day;
  return true;
}

function todayDoses(dateKey = state.viewDate) {
  const doses = [];
  state.data.supplements.forEach(s => {
    if (!shouldShowToday(s, dateKey)) return;
    for (let i = 0; i < s.dosesPerDay; i++) {
      const moment = s.times[i] || s.times[0] || `toma ${i + 1}`;
      doses.push({ key: `${s.id}__${i}`, sup: s, moment });
    }
  });
  return doses;
}

function nextDoseLabel(s, fromDate = state.viewDate) {
  if (s.frequencyType === "daily" || s.frequencyType === "custom") return "Hoy";
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(fromDate + "T00:00:00"); d.setDate(d.getDate() + offset);
    const idx = d.getDay();
    if ((s.frequencyType === "specific_days" && s.daysOfWeek.includes(idx)) || (s.frequencyType === "weekly" && s.daysOfWeek[0] === idx)) return WEEK[idx];
  }
  return "—";
}

function render() {
  ensureDate(state.viewDate);
  document.getElementById("currentDate").textContent = new Date(state.viewDate + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const checks = state.data.checkByDate[state.viewDate] || {};
  const doses = todayDoses();
  const groups = {};
  doses.forEach(d => { (groups[d.moment] ||= []).push(d); });
  const container = document.getElementById("groupsContainer");
  container.innerHTML = Object.keys(groups).length ? "" : `<section class='card'><p>No hay suplementos para hoy.</p></section>`;
  Object.entries(groups).forEach(([moment, items]) => {
    const sec = document.createElement("section"); sec.className = "card group"; sec.innerHTML = `<h3>${moment}</h3>`;
    items.forEach(d => {
      const checked = !!checks[d.key];
      const nextTxt = d.sup.frequencyType !== "daily" ? `<small>Próxima toma: ${nextDoseLabel(d.sup)}</small>` : "";
      const el = document.createElement("article");
      el.className = `supplement ${d.sup.optional ? "optional" : ""}`;
      el.innerHTML = `<input type='checkbox' ${checked ? "checked" : ""}><div class='meta'><strong>${d.sup.name} — ${d.moment}</strong><small>Dosis: ${d.sup.dose}</small>${nextTxt}<small>${d.sup.notes || ""}</small></div><div class='actions'><button class='btn' data-edit='${d.sup.id}'>Editar</button><button class='btn' data-delete='${d.sup.id}'>Borrar</button></div>`;
      el.querySelector("input").addEventListener("change", e => { state.data.checkByDate[state.viewDate][d.key] = e.target.checked; save(); updateProgress(); });
      el.querySelector("[data-edit]").onclick = () => openDialog(d.sup);
      el.querySelector("[data-delete]").onclick = () => removeSupplement(d.sup.id);
      sec.appendChild(el);
    });
    container.appendChild(sec);
  });
  refreshHistory();
  updateProgress();
}

function updateProgress() {
  const checks = state.data.checkByDate[state.viewDate] || {};
  const doses = todayDoses();
  const req = doses.filter(d => !d.sup.optional);
  const done = req.filter(d => checks[d.key]).length;
  document.getElementById("progressText").textContent = `${done} de ${req.length} tomados`;
  document.getElementById("progressBar").style.width = `${req.length ? (done / req.length) * 100 : 0}%`;
  document.getElementById("completionMsg").hidden = !(req.length && done === req.length);
}

function setupWeekdays() {
  document.getElementById("weekDaysInput").innerHTML = WEEK.map((d, i) => `<label><input type='checkbox' value='${i}'> ${d.slice(0,3)}</label>`).join("");
}
function selectedDays() { return [...document.querySelectorAll("#weekDaysInput input:checked")].map(c => Number(c.value)); }
function setSelectedDays(days) { document.querySelectorAll("#weekDaysInput input").forEach(c => c.checked = days.includes(Number(c.value))); }

function openDialog(s = null) {
  supplementDialog.showModal();
  dialogTitle.textContent = s ? "Editar suplemento" : "Agregar suplemento";
  supplementId.value = s?.id || ""; nameInput.value = s?.name || ""; doseInput.value = s?.dose || "";
  frequencyTypeInput.value = s?.frequencyType || "daily"; dosesPerDayInput.value = s?.dosesPerDay || 1;
  timesInput.value = s?.times?.join(", ") || ""; notesInput.value = s?.notes || "";
  optionalInput.checked = !!s?.optional; activeInput.checked = s?.active ?? true; setSelectedDays(s?.daysOfWeek || []);
}

function removeSupplement(id) { if (!confirm("¿Borrar suplemento?")) return; state.data.supplements = state.data.supplements.filter(s => s.id !== id); Object.values(state.data.checkByDate).forEach(day => Object.keys(day).forEach(k => k.startsWith(id+"__") && delete day[k])); save(); render(); }
function refreshHistory() { const sel = historySelect; const dates = Object.keys(state.data.checkByDate).sort((a,b)=>b.localeCompare(a)); sel.innerHTML = dates.map(d=>`<option value='${d}'>${d}</option>`).join(""); sel.value = state.viewDate; }

function bindEvents() {
  addBtn.onclick = () => openDialog();
  cancelDialogBtn.onclick = () => supplementDialog.close();
  supplementForm.onsubmit = e => {
    e.preventDefault();
    const payload = { id: supplementId.value || uid(), name: nameInput.value.trim(), dose: doseInput.value.trim(), frequencyType: frequencyTypeInput.value, daysOfWeek: selectedDays(), dosesPerDay: Math.max(1, Number(dosesPerDayInput.value) || 1), times: timesInput.value.split(",").map(s => s.trim()).filter(Boolean), notes: notesInput.value.trim(), optional: optionalInput.checked, active: activeInput.checked };
    if (!payload.name || !payload.dose) return;
    const i = state.data.supplements.findIndex(s => s.id === payload.id);
    if (i >= 0) state.data.supplements[i] = payload; else state.data.supplements.push(payload);
    save(); supplementDialog.close(); render();
  };
  resetBtn.onclick = () => { if (confirm("¿Resetear día?")) { state.data.checkByDate[state.viewDate] = {}; save(); render(); } };
  duplicateBtn.onclick = () => { const t = new Date(todayKey()+"T00:00:00"); t.setDate(t.getDate()-1); const y = t.toISOString().slice(0,10); if (!state.data.checkByDate[y]) return alert("No hay registro de ayer"); state.data.checkByDate[todayKey()] = { ...state.data.checkByDate[y] }; state.viewDate = todayKey(); save(); render(); };
  loadHistoryBtn.onclick = () => { state.viewDate = historySelect.value || todayKey(); render(); };
  backTodayBtn.onclick = () => { state.viewDate = todayKey(); render(); };
  exportBtn.onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" })); a.download = `suplementos-${todayKey()}.json`; a.click(); };
  importInput.onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const p = JSON.parse(await f.text()); state.data = p; ensureDate(todayKey()); state.viewDate = todayKey(); save(); render(); alert("Importado"); } catch { alert("JSON inválido"); } e.target.value = ""; };
}
