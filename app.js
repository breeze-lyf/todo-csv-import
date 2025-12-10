const STORAGE_KEY = "reminders.v1";
const reminderListElement = document.getElementById("reminderList");
const emptyListElement = document.getElementById("emptyList");
const listView = document.getElementById("listView");
const calendarView = document.getElementById("calendarView");
const listViewBtn = document.getElementById("listViewBtn");
const calendarViewBtn = document.getElementById("calendarViewBtn");
const openImportDrawerBtn = document.getElementById("openImportDrawer");
const closeImportDrawerBtn = document.getElementById("closeImportDrawer");
const importDrawer = document.getElementById("importDrawer");
const importDrawerBackdrop = document.querySelector(
  "#importDrawer .import-drawer__backdrop"
);
const csvInput = document.getElementById("csvInput");
const clearAllBtn = document.getElementById("clearAll");
const reminderTemplate = document.getElementById("reminderItemTemplate");
const quickAddForm = document.getElementById("quickAddForm");
const quickAddCard = document.querySelector(".quick-add-card");
const quickAddTitleInput = document.getElementById("title");
const quickAddDateInput = document.getElementById("date");
const calendarGrid = document.getElementById("calendarGrid");
const calendarLabel = document.getElementById("calendarLabel");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");

let reminders = loadReminders();
const reminderTimers = new Map();
let currentCalendarDate = new Date();

render();
scheduleAllReminders();

listViewBtn.addEventListener("click", () => setView("list"));
calendarViewBtn.addEventListener("click", () => setView("calendar"));
clearAllBtn.addEventListener("click", clearAllReminders);
quickAddForm.addEventListener("submit", handleQuickAdd);
csvInput.addEventListener("change", handleCsvImport);
prevMonthBtn.addEventListener("click", () => updateMonth(-1));
nextMonthBtn.addEventListener("click", () => updateMonth(1));
openImportDrawerBtn.addEventListener("click", () => toggleImportDrawer(true));
closeImportDrawerBtn.addEventListener("click", () => toggleImportDrawer(false));
importDrawerBackdrop.addEventListener("click", () => toggleImportDrawer(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && importDrawer.classList.contains("open")) {
    toggleImportDrawer(false);
  }
});

setView("calendar");

function setView(view) {
  if (view === "list") {
    listView.classList.add("active");
    calendarView.classList.remove("active");
    listViewBtn.classList.add("primary");
    calendarViewBtn.classList.remove("primary");
  } else {
    calendarView.classList.add("active");
    listView.classList.remove("active");
    calendarViewBtn.classList.add("primary");
    listViewBtn.classList.remove("primary");
  }
}

function handleQuickAdd(event) {
  event.preventDefault();
  const formData = new FormData(quickAddForm);
  const reminder = {
    id: crypto.randomUUID(),
    title: formData.get("title")?.trim(),
    description: formData.get("description")?.trim(),
    date: formData.get("date"),
    time: formData.get("time"),
    remindBefore: Number(formData.get("remindBefore")) || 0,
    remindBeforeDays: Number(formData.get("remindBeforeDays")) || 0,
    createdAt: new Date().toISOString(),
  };

  if (!reminder.title || !reminder.date || !reminder.time) {
    alert("请填写完整的标题、日期和时间");
    return;
  }

  reminders.push(reminder);
  persistReminders();
  quickAddForm.reset();
  render();
  scheduleReminder(reminder);
}

function handleCsvImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = reader.result.toString();
      const imported = parseCsv(text);
      if (!imported.length) {
        alert("没有可导入的数据");
        return;
      }
      reminders = reminders.concat(imported);
      persistReminders();
      render();
      imported.forEach(scheduleReminder);
      alert(`成功导入 ${imported.length} 条提醒`);
    } catch (error) {
      console.error(error);
      alert("解析 CSV 时出错，请确认格式正确");
    } finally {
      csvInput.value = "";
    }
  };
  reader.readAsText(file);
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const header = parseCsvLine(lines.shift());
  const columnIndex = {
    title: header.indexOf("title"),
    description: header.indexOf("description"),
    date: header.indexOf("date"),
    time: header.indexOf("time"),
    remindBefore: header.indexOf("remindBefore"),
    remindBeforeDays: header.indexOf("remindBeforeDays"),
  };

  return lines
    .map((line) => parseCsvLine(line))
    .map((cols) => ({
      id: crypto.randomUUID(),
      title: cols[columnIndex.title]?.trim(),
      description: cols[columnIndex.description]?.trim() ?? "",
      date: cols[columnIndex.date]?.trim(),
      time: cols[columnIndex.time]?.trim(),
      remindBefore: Number(cols[columnIndex.remindBefore] ?? 0) || 0,
      remindBeforeDays: Number(cols[columnIndex.remindBeforeDays] ?? 0) || 0,
      createdAt: new Date().toISOString(),
    }))
    .filter((reminder) => reminder.title && reminder.date && reminder.time);
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function render() {
  renderListView();
  renderCalendar();
}

function renderListView() {
  reminderListElement.innerHTML = "";
  const sorted = [...reminders].sort((a, b) =>
    getReminderDate(a) - getReminderDate(b)
  );

  if (!sorted.length) {
    emptyListElement.style.display = "block";
    return;
  }

  emptyListElement.style.display = "none";

  sorted.forEach((reminder) => {
    const fragment = reminderTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".reminder");
    fragment.querySelector(".reminder-title").textContent = reminder.title;
    fragment.querySelector(".reminder-description").textContent =
      reminder.description || "无描述";
    fragment.querySelector(".reminder-meta").textContent = formatReminderMeta(
      reminder
    );
    fragment.querySelector(".delete").addEventListener("click", () =>
      deleteReminder(reminder.id)
    );
    reminderListElement.appendChild(fragment);
  });
}

function renderCalendar() {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  calendarLabel.textContent = `${year} 年 ${month + 1} 月`;

  const start = new Date(year, month, 1);
  const firstDay = start.getDay();
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - firstDay);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    cells.push(date);
  }

  calendarGrid.innerHTML = "";
  cells.forEach((date) => {
    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    if (date.getMonth() !== month) {
      cell.classList.add("out-month");
    }
    cell.dataset.date = formatDate(date);
    const header = document.createElement("header");
    const dayLabel = document.createElement("span");
    dayLabel.textContent = date.getDate();
    header.appendChild(dayLabel);

    const cellReminders = reminders.filter(
      (reminder) => reminder.date === formatDate(date)
    );
    if (cellReminders.length) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = cellReminders.length;
      header.appendChild(badge);
    }

    cell.appendChild(header);

    cellReminders
      .sort((a, b) => getReminderDate(a) - getReminderDate(b))
      .forEach((reminder) => {
        const chip = document.createElement("div");
        chip.className = "calendar-event";
        chip.textContent = `${reminder.time} ${reminder.title}`;
        cell.appendChild(chip);
      });

    if (date.getMonth() === month) {
      cell.addEventListener("click", () => openQuickAddForDate(date));
    }

    calendarGrid.appendChild(cell);
  });
}

function updateMonth(offset) {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + offset);
  renderCalendar();
}

function deleteReminder(id) {
  reminders = reminders.filter((reminder) => reminder.id !== id);
  if (reminderTimers.has(id)) {
    clearTimeout(reminderTimers.get(id));
    reminderTimers.delete(id);
  }
  persistReminders();
  render();
}

function clearAllReminders() {
  if (!reminders.length) return;
  if (confirm("确定要清空所有提醒吗？")) {
    reminders = [];
    reminderTimers.forEach((timer) => clearTimeout(timer));
    reminderTimers.clear();
    persistReminders();
    render();
  }
}

function persistReminders() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

function loadReminders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Failed to load reminders", error);
    return [];
  }
}

function scheduleAllReminders() {
  reminders.forEach(scheduleReminder);
}

function supportsNotifications() {
  return typeof Notification !== "undefined";
}

async function scheduleReminder(reminder) {
  const reminderDate = getReminderDate(reminder);
  const notifyAt = new Date(
    reminderDate - getLeadTimeMinutes(reminder) * 60000
  );
  const delay = notifyAt - new Date();

  if (delay <= 0) return;

  if (supportsNotifications() && Notification.permission === "default") {
    await Notification.requestPermission();
  }

  const timer = setTimeout(() => {
    if (supportsNotifications() && Notification.permission === "granted") {
      new Notification(reminder.title, {
        body: `${reminder.description || ""} ${reminder.date} ${reminder.time}`.trim(),
      });
    } else {
      alert(`提醒：${reminder.title} (${reminder.date} ${reminder.time})`);
    }
    reminderTimers.delete(reminder.id);
  }, delay);

  reminderTimers.set(reminder.id, timer);
}

function getReminderDate(reminder) {
  return new Date(`${reminder.date}T${reminder.time}`);
}

function formatReminderMeta(reminder) {
  const datetime = getReminderDate(reminder).toLocaleString();
  const leadTime = formatLeadTime(reminder);
  return leadTime
    ? `${datetime} · 提前 ${leadTime}提醒`
    : `${datetime} · 到点提醒`;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLeadTimeMinutes(reminder) {
  const days = Number(reminder.remindBeforeDays) || 0;
  const minutes = Number(reminder.remindBefore) || 0;
  return days * 1440 + minutes;
}

function formatLeadTime(reminder) {
  const days = Number(reminder.remindBeforeDays) || 0;
  const minutes = Number(reminder.remindBefore) || 0;
  const parts = [];
  if (days) parts.push(`${days} 天`);
  if (minutes) parts.push(`${minutes} 分钟`);
  return parts.join(" ");
}

function toggleImportDrawer(open) {
  importDrawer.classList.toggle("open", open);
  importDrawer.setAttribute("aria-hidden", String(!open));
  if (open) {
    csvInput?.focus();
  }
}

function openQuickAddForDate(date) {
  if (!quickAddDateInput) return;
  quickAddDateInput.value = formatDate(date);
  quickAddForm.scrollIntoView({ behavior: "smooth", block: "center" });
  quickAddCard?.classList.add("pulse");
  requestAnimationFrame(() => {
    quickAddTitleInput?.focus();
  });
  setTimeout(() => quickAddCard?.classList.remove("pulse"), 1200);
}
