(() => {
  "use strict";

  const SUPABASE_URL = "https://eybiwgsxeulwwpjkicvx.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_PVfpFRG1XcUarGPFhieKqg_l3hOUAj0";
  const THEME_KEY = "today-i-did.theme";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  const elements = {
    authView: document.querySelector("#auth-view"), appView: document.querySelector("#app-view"),
    authForm: document.querySelector("#auth-form"), authEmail: document.querySelector("#auth-email"),
    authPassword: document.querySelector("#auth-password"), authSubmit: document.querySelector("#auth-submit"),
    authTitle: document.querySelector("#auth-title"), authSubtitle: document.querySelector("#auth-subtitle"),
    authMessage: document.querySelector("#auth-message"), authSwitch: document.querySelector("#auth-switch"),
    authSwitchCopy: document.querySelector("#auth-switch-copy"), userControls: document.querySelector("#user-controls"),
    userEmail: document.querySelector("#user-email"), signOut: document.querySelector("#sign-out-button"),
    form: document.querySelector("#activity-form"), input: document.querySelector("#activity-input"),
    categoryInput: document.querySelector("#category-input"), submitButton: document.querySelector("#submit-button"),
    cancelEdit: document.querySelector("#cancel-edit"), editActions: document.querySelector("#edit-actions"),
    list: document.querySelector("#activity-list"), emptyState: document.querySelector("#empty-state"),
    emptyTitle: document.querySelector("#empty-title"), emptyMessage: document.querySelector("#empty-message"),
    search: document.querySelector("#search-input"), categoryFilter: document.querySelector("#category-filter"),
    periodButtons: [...document.querySelectorAll("[data-period]")], dailyStat: document.querySelector("#daily-stat"),
    weeklyStat: document.querySelector("#weekly-stat"), totalStat: document.querySelector("#total-stat"),
    resultCount: document.querySelector("#result-count"), dateLabel: document.querySelector("#date-label"),
    themeToggle: document.querySelector("#theme-toggle"), toast: document.querySelector("#toast")
  };

  let activities = [];
  let editingId = null;
  let activePeriod = "all";
  let authMode = "signin";
  let currentUser = null;
  let toastTimer;

  function localDayKey(date) { return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; }
  function startOfWeek(date) { const start = new Date(date); const day = (start.getDay() + 6) % 7; start.setDate(start.getDate() - day); start.setHours(0, 0, 0, 0); return start; }
  function isToday(value) { return localDayKey(new Date(value)) === localDayKey(new Date()); }
  function isThisWeek(value) { const date = new Date(value); const start = startOfWeek(new Date()); const end = new Date(start); end.setDate(end.getDate() + 7); return date >= start && date < end; }

  function visibleActivities() {
    const query = elements.search.value.trim().toLocaleLowerCase();
    const category = elements.categoryFilter.value;
    return activities
      .filter((activity) => !query || activity.text.toLocaleLowerCase().includes(query))
      .filter((activity) => category === "all" || activity.category === category)
      .filter((activity) => activePeriod === "all" || (activePeriod === "today" ? isToday(activity.completedAt) : isThisWeek(activity.completedAt)))
      .sort((a, b) => Number(b.important) - Number(a.important) || new Date(b.completedAt) - new Date(a.completedAt));
  }

  function fromRow(row) { return { id: row.id, text: row.text, category: row.category, completedAt: row.completed_at, important: row.important }; }

  async function loadActivities() {
    setLoadingState(true);
    const { data, error } = await db.from("activities").select("id,text,category,completed_at,important").order("completed_at", { ascending: false });
    setLoadingState(false);
    if (error) { showToast(`Could not load activities: ${error.message}`); return; }
    activities = data.map(fromRow);
    render();
  }

  function setLoadingState(loading) {
    elements.submitButton.disabled = loading;
    if (loading && activities.length === 0) {
      elements.emptyState.hidden = false;
      elements.emptyTitle.textContent = "Loading your wins…";
      elements.emptyMessage.textContent = "Syncing your private activity history.";
    }
  }

  function icon(name) {
    const paths = {
      star: '<path d="m12 2.7 2.8 5.67 6.26.91-4.53 4.42 1.07 6.24L12 18l-5.6 2.94 1.07-6.24-4.53-4.42 6.26-.91L12 2.7Z"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
  }

  function createActivityCard(activity) {
    const article = document.createElement("article"); article.className = "activity-card"; article.dataset.id = activity.id;
    const mark = document.createElement("span"); mark.className = "check-mark"; mark.setAttribute("aria-hidden", "true"); mark.textContent = "✓";
    const content = document.createElement("div"); content.className = "activity-content";
    const title = document.createElement("p"); title.className = "activity-title"; title.textContent = activity.text;
    const meta = document.createElement("div"); meta.className = "activity-meta";
    const category = document.createElement("span"); category.className = "category-badge"; category.textContent = activity.category;
    const time = document.createElement("time"); time.dateTime = activity.completedAt; time.textContent = formatActivityDate(activity.completedAt);
    meta.append(category, time); content.append(title, meta);
    const actions = document.createElement("div"); actions.className = "card-actions";
    actions.append(createCardButton("important", activity.important ? "Remove important mark" : "Mark important", icon("star"), activity.important), createCardButton("edit", "Edit activity", icon("edit")), createCardButton("delete", "Delete activity", icon("trash")));
    article.append(mark, content, actions); return article;
  }

  function createCardButton(action, label, svg, active = false) {
    const button = document.createElement("button"); button.type = "button"; button.className = `card-button ${action}${active ? " active" : ""}`;
    button.dataset.action = action; button.setAttribute("aria-label", label); button.title = label; button.innerHTML = svg; return button;
  }

  function formatActivityDate(value) {
    const date = new Date(value);
    if (isToday(value)) return `Today at ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)}`;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric", hour: "numeric", minute: "2-digit" }).format(date);
  }

  function render() {
    const visible = visibleActivities();
    elements.list.replaceChildren(...visible.map(createActivityCard));
    elements.emptyState.hidden = visible.length > 0;
    elements.resultCount.textContent = `${visible.length} ${visible.length === 1 ? "activity" : "activities"}`;
    const hasFilters = elements.search.value.trim() || elements.categoryFilter.value !== "all" || activePeriod !== "all";
    elements.emptyTitle.textContent = activities.length === 0 ? "No activities yet" : "No matching activities";
    elements.emptyMessage.textContent = activities.length === 0 ? "Add a completed activity above. Your first small win is waiting." : hasFilters ? "Try changing your search or filters." : "Add another completed activity above.";
    elements.dailyStat.textContent = activities.filter((item) => isToday(item.completedAt)).length;
    elements.weeklyStat.textContent = activities.filter((item) => isThisWeek(item.completedAt)).length;
    elements.totalStat.textContent = activities.length;
  }

  async function addOrUpdateActivity(event) {
    event.preventDefault();
    const text = elements.input.value.trim(); if (!text || !currentUser) return;
    elements.submitButton.disabled = true;
    let result;
    if (editingId) result = await db.from("activities").update({ text, category: elements.categoryInput.value }).eq("id", editingId).select().single();
    else result = await db.from("activities").insert({ text, category: elements.categoryInput.value }).select().single();
    elements.submitButton.disabled = false;
    if (result.error) { showToast(result.error.message); return; }
    showToast(editingId ? "Activity updated" : "Activity added — nice work!");
    resetForm(); await loadActivities();
  }

  async function handleCardAction(event) {
    const button = event.target.closest("[data-action]"); const card = event.target.closest("[data-id]"); if (!button || !card) return;
    const activity = activities.find((item) => item.id === card.dataset.id); if (!activity) return;
    if (button.dataset.action === "important") {
      const { error } = await db.from("activities").update({ important: !activity.important }).eq("id", activity.id);
      if (error) return showToast(error.message); activity.important = !activity.important; render(); showToast(activity.important ? "Marked as important" : "Important mark removed");
    }
    if (button.dataset.action === "edit") {
      editingId = activity.id; elements.input.value = activity.text; elements.categoryInput.value = activity.category;
      elements.submitButton.innerHTML = '<span aria-hidden="true">✓</span> Save changes'; elements.editActions.hidden = false; elements.input.focus(); elements.form.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (button.dataset.action === "delete") {
      const { error } = await db.from("activities").delete().eq("id", activity.id);
      if (error) return showToast(error.message); activities = activities.filter((item) => item.id !== activity.id); if (editingId === activity.id) resetForm(); render(); showToast("Activity deleted");
    }
  }

  function resetForm() { editingId = null; elements.form.reset(); elements.submitButton.innerHTML = '<span aria-hidden="true">＋</span> Add activity'; elements.editActions.hidden = true; }
  function showToast(message) { clearTimeout(toastTimer); elements.toast.textContent = message; elements.toast.classList.add("show"); toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600); }

  function setTheme(theme) { document.documentElement.dataset.theme = theme; localStorage.setItem(THEME_KEY, theme); elements.themeToggle.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} mode`); }
  function initTheme() { const saved = localStorage.getItem(THEME_KEY); const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; setTheme(saved === "dark" || saved === "light" ? saved : preferred); }

  function updateAuthMode() {
    const signingUp = authMode === "signup";
    elements.authTitle.textContent = signingUp ? "Create your account" : "Welcome back";
    elements.authSubtitle.textContent = signingUp ? "Your activities will stay private and sync across your devices." : "Sign in to see your private activity history.";
    elements.authSubmit.textContent = signingUp ? "Create account" : "Sign in";
    elements.authSwitchCopy.textContent = signingUp ? "Already have an account?" : "New here?";
    elements.authSwitch.textContent = signingUp ? "Sign in" : "Create an account";
    elements.authPassword.autocomplete = signingUp ? "new-password" : "current-password";
    elements.authMessage.textContent = ""; elements.authMessage.classList.remove("error");
  }

  async function handleAuth(event) {
    event.preventDefault(); elements.authSubmit.disabled = true; elements.authMessage.textContent = "Working…"; elements.authMessage.classList.remove("error");
    const credentials = { email: elements.authEmail.value.trim(), password: elements.authPassword.value };
    const result = authMode === "signup" ? await db.auth.signUp(credentials) : await db.auth.signInWithPassword(credentials);
    elements.authSubmit.disabled = false;
    if (result.error) { elements.authMessage.textContent = result.error.message; elements.authMessage.classList.add("error"); return; }
    if (authMode === "signup" && !result.data.session) elements.authMessage.textContent = "Check your email, then follow the confirmation link to sign in.";
  }

  async function showSession(user) {
    currentUser = user || null;
    elements.authView.hidden = Boolean(user); elements.appView.hidden = !user; elements.userControls.hidden = !user;
    elements.userEmail.textContent = user?.email || "";
    if (user) await loadActivities(); else { activities = []; render(); resetForm(); }
  }

  elements.form.addEventListener("submit", addOrUpdateActivity);
  elements.cancelEdit.addEventListener("click", resetForm);
  elements.list.addEventListener("click", handleCardAction);
  elements.search.addEventListener("input", render);
  elements.categoryFilter.addEventListener("change", render);
  elements.periodButtons.forEach((button) => button.addEventListener("click", () => { activePeriod = button.dataset.period; elements.periodButtons.forEach((item) => item.classList.toggle("active", item === button)); render(); }));
  elements.themeToggle.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  elements.authSwitch.addEventListener("click", () => { authMode = authMode === "signin" ? "signup" : "signin"; elements.authForm.reset(); updateAuthMode(); });
  elements.authForm.addEventListener("submit", handleAuth);
  elements.signOut.addEventListener("click", async () => { await db.auth.signOut(); showToast("Signed out"); });

  elements.dateLabel.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  initTheme(); updateAuthMode(); render();
  db.auth.onAuthStateChange((_event, session) => { setTimeout(() => showSession(session?.user), 0); });
  db.auth.getSession().then(({ data }) => showSession(data.session?.user));
})();
