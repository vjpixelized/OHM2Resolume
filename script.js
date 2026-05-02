const STORAGE_KEY = "supplementChecklistDataV1";

const defaultSupplements = [
  { name: "Complejo B", dose: "1 cápsula", time: "Mañana con desayuno", notes: "", optional: false },
  { name: "Zinc", dose: "20 mg", time: "Mañana con desayuno", notes: "", optional: false },
  { name: "Vitamina D3", dose: "según dosis del frasco", time: "Mañana con desayuno", notes: "", optional: false },
  { name: "Omega-3", dose: "según dosis del frasco", time: "Mañana con desayuno", notes: "", optional: false },
  { name: "Selenio", dose: "100–200 mcg", time: "Mediodía con comida", notes: "", optional: false },
  { name: "Glucosamina", dose: "según dosis del frasco", time: "Mediodía con comida", notes: "", optional: false },
  { name: "Creatina", dose: "5 g", time: "Post-entrenamiento o flexible", notes: "", optional: false },
  { name: "Teanina", dose: "según dosis del frasco", time: "Tarde / relajación", notes: "", optional: false },
  { name: "Colágeno", dose: "según dosis del frasco", time: "Noche opcional", notes: "", optional: true },
];

const state = { viewDate: todayKey(), data: loadData() };
if (!state.data.supplements?.length) bootstrapSupplements();
ensureDateEntry(state.viewDate);
render();

function todayKey() { return new Date().toISOString().slice(0, 10); }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()); }

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { supplements: [], checkByDate: {} };
  } catch {
    return { supplements: [], checkByDate: {} };
  }
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data)); refreshHistory(); }
function ensureDateEntry(date) { state.data.checkByDate[date] ||= {}; saveData(); }

function bootstrapSupplements() {
  state.data.supplements = defaultSupplements.map(s => ({ id: uid(), ...s }));
  saveData();
}

function getChecks(date = state.viewDate) { return state.data.checkByDate[date] || {}; }
function setCheck(id, checked) { ensureDateEntry(state.viewDate); state.data.checkByDate[state.viewDate][id] = checked; saveData(); render(); }

function render() {
  const dateEl = document.getElementById("currentDate");
  dateEl.textContent = new Date(state.viewDate + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const container = document.getElementById("groupsContainer");
  container.innerHTML = "";
  const grouped = groupByTime(state.data.supplements);
  const checks = getChecks();

  Object.entries(grouped).forEach(([time, items]) => {
    const section = document.createElement("section");
    section.className = "card group";
    section.innerHTML = `<h3>${time}</h3>`;

    items.forEach(item => {
      const div = document.createElement("article");
      div.className = `supplement ${item.optional ? "optional" : ""}`;
      div.innerHTML = `
        <input type="checkbox" ${checks[item.id] ? "checked" : ""} aria-label="Tomado ${item.name}">
        <div class="meta">
          <strong>${item.name} ${item.optional ? "(opcional)" : ""}</strong>
          <small>Dosis: ${item.dose}</small>
          <small>${item.notes || "Sin notas"}</small>
        </div>
        <div class="actions">
          <button data-edit="${item.id}" class="btn">Editar</button>
          <button data-delete="${item.id}" class="btn">Borrar</button>
        </div>`;
      div.querySelector("input").addEventListener("change", e => setCheck(item.id, e.target.checked));
      div.querySelector("[data-edit]").addEventListener("click", () => openDialog(item));
      div.querySelector("[data-delete]").addEventListener("click", () => deleteSupplement(item.id));
      section.appendChild(div);
    });

    container.appendChild(section);
  });

  updateProgress();
  refreshHistory();
}

function groupByTime(items) {
  return items.reduce((acc, item) => {
    (acc[item.time] ||= []).push(item);
    return acc;
  }, {});
}

function updateProgress() {
  const checks = getChecks();
  const required = state.data.supplements.filter(s => !s.optional);
  const completed = required.filter(s => checks[s.id]).length;
  const total = required.length;
  document.getElementById("progressText").textContent = `${completed} de ${total} tomados`;
  document.getElementById("progressBar").style.width = `${total ? (completed / total) * 100 : 0}%`;
  document.getElementById("completionMsg").hidden = completed !== total || total === 0;
}

function openDialog(item = null) {
  const dialog = document.getElementById("supplementDialog");
  document.getElementById("dialogTitle").textContent = item ? "Editar suplemento" : "Agregar suplemento";
  document.getElementById("supplementId").value = item?.id || "";
  document.getElementById("nameInput").value = item?.name || "";
  document.getElementById("doseInput").value = item?.dose || "";
  document.getElementById("timeInput").value = item?.time || "Mañana con desayuno";
  document.getElementById("notesInput").value = item?.notes || "";
  document.getElementById("optionalInput").checked = !!item?.optional;
  dialog.showModal();
}

function deleteSupplement(id) {
  if (!confirm("¿Borrar suplemento?")) return;
  state.data.supplements = state.data.supplements.filter(s => s.id !== id);
  Object.values(state.data.checkByDate).forEach(day => delete day[id]);
  saveData();
  render();
}

function refreshHistory() {
  const sel = document.getElementById("historySelect");
  const dates = Object.keys(state.data.checkByDate).sort((a, b) => b.localeCompare(a));
  sel.innerHTML = dates.map(d => `<option value="${d}">${d}</option>`).join("");
  sel.value = state.viewDate;
}

document.getElementById("addBtn").addEventListener("click", () => openDialog());
document.getElementById("cancelDialogBtn").addEventListener("click", () => document.getElementById("supplementDialog").close());
document.getElementById("supplementForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = document.getElementById("supplementId").value;
  const payload = {
    id: id || uid(),
    name: document.getElementById("nameInput").value.trim(),
    dose: document.getElementById("doseInput").value.trim(),
    time: document.getElementById("timeInput").value,
    notes: document.getElementById("notesInput").value.trim(),
    optional: document.getElementById("optionalInput").checked,
  };
  if (!payload.name || !payload.dose) return;
  if (id) {
    const idx = state.data.supplements.findIndex(s => s.id === id);
    state.data.supplements[idx] = payload;
  } else state.data.supplements.push(payload);
  saveData();
  document.getElementById("supplementDialog").close();
  render();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  if (!confirm("¿Resetear checklist del día?")) return;
  state.data.checkByDate[state.viewDate] = {};
  saveData(); render();
});

document.getElementById("duplicateBtn").addEventListener("click", () => {
  const today = todayKey();
  const y = new Date(today + "T00:00:00");
  y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  if (!state.data.checkByDate[yesterday]) return alert("No hay registro de ayer.");
  state.data.checkByDate[today] = { ...state.data.checkByDate[yesterday] };
  state.viewDate = today;
  saveData(); render();
});

document.getElementById("loadHistoryBtn").addEventListener("click", () => {
  const d = document.getElementById("historySelect").value;
  if (!d) return;
  state.viewDate = d;
  ensureDateEntry(d);
  render();
});

document.getElementById("backTodayBtn").addEventListener("click", () => {
  state.viewDate = todayKey();
  ensureDateEntry(state.viewDate);
  render();
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `suplementos-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById("importInput").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.supplements) || typeof parsed.checkByDate !== "object") throw new Error();
    state.data = parsed;
    state.viewDate = todayKey();
    ensureDateEntry(state.viewDate);
    saveData(); render();
    alert("Datos importados correctamente.");
  } catch {
    alert("JSON inválido.");
  } finally {
    e.target.value = "";
  }
});
