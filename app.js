(() => {
  "use strict";

  const SUPABASE_URL = "https://eybiwgsxeulwwpjkicvx.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_PVfpFRG1XcUarGPFhieKqg_l3hOUAj0";
  const THEME_KEY = "today-i-did.theme";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  const $ = (selector) => document.querySelector(selector);
  const elements = {
    authView: $("#auth-view"), appView: $("#app-view"), authForm: $("#auth-form"), authEmail: $("#auth-email"),
    authPassword: $("#auth-password"), authSubmit: $("#auth-submit"), authTitle: $("#auth-title"), authSubtitle: $("#auth-subtitle"),
    authMessage: $("#auth-message"), authSwitch: $("#auth-switch"), authSwitchCopy: $("#auth-switch-copy"), resendVerification: $("#resend-verification"),
    userControls: $("#user-controls"), userEmail: $("#user-email"), signOut: $("#sign-out-button"), themeToggle: $("#theme-toggle"),
    workspaceButtons: [...document.querySelectorAll("[data-view]")], workspaceViews: [...document.querySelectorAll(".workspace-view")],
    activityForm: $("#activity-form"), activityInput: $("#activity-input"), categoryInput: $("#category-input"),
    activitySubmit: $("#submit-button"), cancelEdit: $("#cancel-edit"), editActions: $("#edit-actions"), activityList: $("#activity-list"),
    activityEmpty: $("#empty-state"), emptyTitle: $("#empty-title"), emptyMessage: $("#empty-message"),
    search: $("#search-input"), categoryFilter: $("#category-filter"), periodButtons: [...document.querySelectorAll("[data-period]")],
    dailyStat: $("#daily-stat"), weeklyStat: $("#weekly-stat"), totalStat: $("#total-stat"), resultCount: $("#result-count"), dateLabel: $("#date-label"),
    weeklyProgressRing: $("#weekly-progress-ring"), weeklyProgressValue: $("#weekly-progress-value"),
    missionForm: $("#mission-form"), missionTitle: $("#mission-title"), missionDescription: $("#mission-description"),
    missionDue: $("#mission-due"), missionPoints: $("#mission-points"), missionScope: $("#mission-scope"), missionSubmit: $("#mission-submit"),
    missionList: $("#mission-list"), missionEmpty: $("#mission-empty"), missionStatusFilter: $("#mission-status-filter"),
    pointsStat: $("#points-stat"), activeMissionsStat: $("#active-missions-stat"), streakStat: $("#streak-stat"),
    reviewSection: $("#review-section"), reviewList: $("#review-list"), classroomForm: $("#classroom-form"),
    classroomName: $("#classroom-name"), classroomDescription: $("#classroom-description"), joinForm: $("#join-form"),
    inviteCode: $("#invite-code"), classroomList: $("#classroom-list"), classroomEmpty: $("#classroom-empty"), toast: $("#toast")
  };

  let activities = [];
  let classrooms = [];
  let classroomMembers = [];
  let missions = [];
  let currentUser = null;
  let loadedUserId = null;
  let editingId = null;
  let activePeriod = "all";
  let authMode = "signin";
  let pendingVerificationEmail = "";
  let toastTimer;

  function localDayKey(date) { return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; }
  function startOfWeek(date) { const start = new Date(date); const day = (start.getDay() + 6) % 7; start.setDate(start.getDate() - day); start.setHours(0, 0, 0, 0); return start; }
  function isToday(value) { return localDayKey(new Date(value)) === localDayKey(new Date()); }
  function isThisWeek(value) { const date = new Date(value); const start = startOfWeek(new Date()); const end = new Date(start); end.setDate(end.getDate() + 7); return date >= start && date < end; }
  function escapeDate(value) { return value ? new Date(value) : null; }
  function fromActivity(row) { return { id: row.id, text: row.text, category: row.category, completedAt: row.completed_at, important: row.important }; }
  function classroomName(id) { return classrooms.find((item) => item.id === id)?.name || "Classroom"; }
  function isOwner(classroom) { return classroom.owner_id === currentUser?.id; }
  function memberCount(id) { return classroomMembers.filter((member) => member.classroom_id === id).length; }

  async function loadWorkspace() {
    setBusy(true);
    const activityRequest = db.from("activities").select("id,text,category,completed_at,important").order("completed_at", { ascending: false });
    const classroomRequest = db.from("classrooms").select("id,owner_id,name,description,invite_code,created_at").order("created_at", { ascending: false });
    const missionRequest = db.from("missions").select("id,template_id,classroom_id,creator_id,assignee_id,title,description,due_at,status,progress,submission_text,points,awarded_points,submitted_at,completed_at,created_at").order("created_at", { ascending: false });
    const [activityResult, classroomResult, missionResult] = await Promise.all([activityRequest, classroomRequest, missionRequest]);
    if (activityResult.error) showToast(activityResult.error.message); else activities = activityResult.data.map(fromActivity);
    if (classroomResult.error) showToast(classroomResult.error.message); else classrooms = classroomResult.data;
    if (missionResult.error && !missionResult.error.message.includes("missions")) showToast(missionResult.error.message); else missions = missionResult.data || [];
    const ids = classrooms.map((item) => item.id);
    if (ids.length) {
      const memberResult = await db.from("classroom_members").select("classroom_id,user_id,role,joined_at").in("classroom_id", ids);
      classroomMembers = memberResult.error ? [] : memberResult.data;
    } else classroomMembers = [];
    setBusy(false);
    renderAll();
  }

  function setBusy(busy) {
    elements.activitySubmit.disabled = busy;
    elements.missionSubmit.disabled = busy;
  }

  function showToast(message) {
    clearTimeout(toastTimer); elements.toast.textContent = message; elements.toast.classList.add("show");
    toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 3000);
  }

  function visibleActivities() {
    const query = elements.search.value.trim().toLocaleLowerCase();
    const category = elements.categoryFilter.value;
    return activities.filter((item) => !query || item.text.toLocaleLowerCase().includes(query))
      .filter((item) => category === "all" || item.category === category)
      .filter((item) => activePeriod === "all" || (activePeriod === "today" ? isToday(item.completedAt) : isThisWeek(item.completedAt)))
      .sort((a, b) => Number(b.important) - Number(a.important) || new Date(b.completedAt) - new Date(a.completedAt));
  }

  function activityIcon(name) {
    const paths = {
      star: '<path d="m12 2.7 2.8 5.67 6.26.91-4.53 4.42 1.07 6.24L12 18l-5.6 2.94 1.07-6.24-4.53-4.42 6.26-.91L12 2.7Z"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
  }

  function makeButton(action, label, svg, active = false) {
    const button = document.createElement("button"); button.type = "button"; button.className = `card-button ${action}${active ? " active" : ""}`;
    button.dataset.action = action; button.setAttribute("aria-label", label); button.title = label; button.innerHTML = svg; return button;
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
    actions.append(makeButton("important", activity.important ? "Remove important mark" : "Mark important", activityIcon("star"), activity.important), makeButton("edit", "Edit activity", activityIcon("edit")), makeButton("delete", "Delete activity", activityIcon("trash")));
    article.append(mark, content, actions); return article;
  }

  function formatActivityDate(value) {
    const date = new Date(value);
    if (isToday(value)) return `Today at ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)}`;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric", hour: "numeric", minute: "2-digit" }).format(date);
  }

  function renderActivities() {
    const visible = visibleActivities(); elements.activityList.replaceChildren(...visible.map(createActivityCard)); elements.activityEmpty.hidden = visible.length > 0;
    elements.resultCount.textContent = `${visible.length} ${visible.length === 1 ? "activity" : "activities"}`;
    const hasFilters = elements.search.value.trim() || elements.categoryFilter.value !== "all" || activePeriod !== "all";
    elements.emptyTitle.textContent = activities.length ? "No matching activities" : "No activities yet";
    elements.emptyMessage.textContent = activities.length ? (hasFilters ? "Try changing your search or filters." : "Add another completed activity above.") : "Add a completed activity above. Your first small win is waiting.";
    elements.dailyStat.textContent = activities.filter((item) => isToday(item.completedAt)).length;
    const weeklyCount = activities.filter((item) => isThisWeek(item.completedAt)).length;
    const weeklyProgress = Math.min(100, Math.round((weeklyCount / 7) * 100));
    elements.weeklyStat.textContent = weeklyCount;
    elements.weeklyProgressRing.style.setProperty("--progress", `${weeklyProgress}%`);
    elements.weeklyProgressRing.setAttribute("aria-valuenow", String(weeklyProgress));
    elements.weeklyProgressValue.textContent = `${weeklyProgress}%`;
    elements.totalStat.textContent = activities.length;
  }

  async function saveActivity(event) {
    event.preventDefault(); const text = elements.activityInput.value.trim(); if (!text) return;
    elements.activitySubmit.disabled = true;
    const result = editingId
      ? await db.from("activities").update({ text, category: elements.categoryInput.value }).eq("id", editingId)
      : await db.from("activities").insert({ text, category: elements.categoryInput.value });
    elements.activitySubmit.disabled = false;
    if (result.error) return showToast(result.error.message);
    showToast(editingId ? "Activity updated" : "Activity added — nice work!"); resetActivityForm(); await loadWorkspace();
  }

  async function handleActivityAction(event) {
    const button = event.target.closest("[data-action]"); const card = event.target.closest("[data-id]"); if (!button || !card) return;
    const activity = activities.find((item) => item.id === card.dataset.id); if (!activity) return;
    if (button.dataset.action === "important") {
      const { error } = await db.from("activities").update({ important: !activity.important }).eq("id", activity.id);
      if (error) return showToast(error.message); activity.important = !activity.important; renderActivities();
    } else if (button.dataset.action === "edit") {
      editingId = activity.id; elements.activityInput.value = activity.text; elements.categoryInput.value = activity.category;
      elements.activitySubmit.innerHTML = '<span aria-hidden="true">✓</span> Save changes'; elements.editActions.hidden = false; elements.activityInput.focus();
    } else if (button.dataset.action === "delete") {
      const { error } = await db.from("activities").delete().eq("id", activity.id); if (error) return showToast(error.message);
      if (editingId === activity.id) resetActivityForm(); await loadWorkspace(); showToast("Activity deleted");
    }
  }

  function resetActivityForm() { editingId = null; elements.activityForm.reset(); elements.activitySubmit.innerHTML = '<span aria-hidden="true">＋</span> Add activity'; elements.editActions.hidden = true; }

  function missionStatusLabel(status) { return ({ todo: "To do", in_progress: "In progress", submitted: "Submitted", completed: "Completed" })[status] || status; }
  function dueLabel(value) { if (!value) return "No deadline"; return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }

  function makeMissionCard(mission, review = false) {
    const card = document.createElement("article"); card.className = "mission-card"; card.dataset.missionId = mission.id; card.dataset.templateId = mission.template_id;
    if (mission.due_at && new Date(mission.due_at) < new Date() && mission.status !== "completed") card.classList.add("overdue");
    const head = document.createElement("div"); head.className = "mission-card-head";
    const summary = document.createElement("div"); const title = document.createElement("h3"); title.textContent = mission.title;
    const description = document.createElement("p"); description.textContent = mission.description || "No description"; summary.append(title, description);
    const points = document.createElement("strong"); points.textContent = `${mission.awarded_points || mission.points} pts`;
    head.append(summary, points);
    const badges = document.createElement("div"); badges.className = "mission-badges";
    [[missionStatusLabel(mission.status), `status-${mission.status}`], [dueLabel(mission.due_at), ""], [mission.classroom_id ? classroomName(mission.classroom_id) : "Personal", ""]].forEach(([text, extra]) => {
      const badge = document.createElement("span"); badge.className = `mission-badge ${extra}`; badge.textContent = text; badges.append(badge);
    });
    const progress = document.createElement("div"); progress.className = "mission-progress"; const fill = document.createElement("span"); fill.style.width = `${mission.progress}%`; progress.append(fill);
    card.append(head, badges, progress);

    if (review) {
      const submission = document.createElement("p"); submission.textContent = mission.submission_text ? `Submission: ${mission.submission_text}` : "Submitted without a note.";
      const who = document.createElement("p"); who.textContent = `Member ${mission.assignee_id.slice(0, 8)} · ${mission.progress}% progress`;
      const actions = document.createElement("div"); actions.className = "review-actions";
      actions.append(actionButton("approve", "Approve & award points", "primary-button"), actionButton("return", "Return for changes", "secondary-button"));
      card.append(submission, who, actions); return card;
    }

    const isAssignee = mission.assignee_id === currentUser?.id;
    if (isAssignee && !["completed", "submitted"].includes(mission.status)) {
      const controls = document.createElement("div"); controls.className = "mission-controls";
      const progressField = document.createElement("div"); const progressLabel = document.createElement("label"); progressLabel.textContent = "Progress";
      const progressSelect = document.createElement("select"); progressSelect.className = "mission-progress-input";
      [0, 25, 50, 75, 100].forEach((value) => { const option = document.createElement("option"); option.value = value; option.textContent = `${value}%`; option.selected = value === mission.progress; progressSelect.append(option); });
      progressField.append(progressLabel, progressSelect);
      const noteField = document.createElement("div"); const noteLabel = document.createElement("label"); noteLabel.textContent = "Progress note / submission";
      const note = document.createElement("input"); note.className = "mission-note-input"; note.maxLength = 1000; note.placeholder = "What did you complete?"; note.value = mission.submission_text || ""; noteField.append(noteLabel, note);
      controls.append(progressField, noteField, actionButton("save-progress", "Save progress", "secondary-button"), actionButton("submit-mission", mission.classroom_id ? "Submit" : "Complete", "primary-button"));
      card.append(controls);
    }
    if (mission.creator_id === currentUser?.id) {
      const deleteButton = actionButton("delete-mission", "Delete mission", "text-button danger-button"); deleteButton.style.marginTop = "12px"; card.append(deleteButton);
    }
    return card;
  }

  function actionButton(action, text, className) { const button = document.createElement("button"); button.type = "button"; button.dataset.missionAction = action; button.className = className; button.textContent = text; return button; }

  function calculateStreak() {
    const days = new Set([...activities.map((item) => localDayKey(new Date(item.completedAt))), ...missions.filter((item) => item.assignee_id === currentUser?.id && item.completed_at).map((item) => localDayKey(new Date(item.completed_at)))]);
    let cursor = new Date(); cursor.setHours(12, 0, 0, 0); if (!days.has(localDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0; while (days.has(localDayKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); } return streak;
  }

  function renderMissions() {
    const ownedClassrooms = classrooms.filter(isOwner);
    elements.missionScope.replaceChildren(new Option("Just me", "personal"), ...ownedClassrooms.map((room) => new Option(`Classroom: ${room.name}`, room.id)));
    const own = missions.filter((item) => item.assignee_id === currentUser?.id);
    const seenTemplates = new Set();
    const created = missions.filter((item) => item.creator_id === currentUser?.id && item.assignee_id !== currentUser?.id && !seenTemplates.has(item.template_id) && seenTemplates.add(item.template_id));
    const boardMissions = [...own, ...created];
    const filter = elements.missionStatusFilter.value;
    const visible = boardMissions.filter((item) => filter === "all" || item.status === filter).sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed") || (escapeDate(a.due_at) || new Date(8640000000000000)) - (escapeDate(b.due_at) || new Date(8640000000000000)));
    elements.missionList.replaceChildren(...visible.map((item) => makeMissionCard(item))); elements.missionEmpty.hidden = visible.length > 0;
    elements.pointsStat.textContent = own.reduce((sum, item) => sum + item.awarded_points, 0);
    elements.activeMissionsStat.textContent = own.filter((item) => item.status !== "completed").length;
    elements.streakStat.textContent = calculateStreak();
    const reviews = missions.filter((item) => item.creator_id === currentUser?.id && item.assignee_id !== currentUser?.id && item.status === "submitted");
    elements.reviewSection.hidden = reviews.length === 0; elements.reviewList.replaceChildren(...reviews.map((item) => makeMissionCard(item, true)));
  }

  async function createMission(event) {
    event.preventDefault(); const due = elements.missionDue.value ? new Date(elements.missionDue.value).toISOString() : null;
    const scope = elements.missionScope.value;
    const common = { mission_title: elements.missionTitle.value.trim(), mission_description: elements.missionDescription.value.trim(), mission_due_at: due, mission_points: Number(elements.missionPoints.value) };
    elements.missionSubmit.disabled = true;
    const result = scope === "personal"
      ? await db.rpc("create_personal_mission", common)
      : await db.rpc("create_classroom_mission", { target_classroom: scope, ...common });
    elements.missionSubmit.disabled = false; if (result.error) return showToast(result.error.message);
    elements.missionForm.reset(); elements.missionPoints.value = 10; await loadWorkspace(); showToast(scope === "personal" ? "Personal mission created" : `Mission assigned to ${result.data} members`);
  }

  async function handleMissionAction(event) {
    const button = event.target.closest("[data-mission-action]"); const card = event.target.closest("[data-mission-id]"); if (!button || !card) return;
    const mission = missions.find((item) => item.id === card.dataset.missionId); if (!mission) return;
    let result;
    if (["save-progress", "submit-mission"].includes(button.dataset.missionAction)) {
      result = await db.rpc("save_mission_progress", { target_mission: mission.id, new_progress: Number(card.querySelector(".mission-progress-input").value), new_submission: card.querySelector(".mission-note-input").value.trim(), submit_now: button.dataset.missionAction === "submit-mission" });
    } else if (["approve", "return"].includes(button.dataset.missionAction)) {
      result = await db.rpc("review_mission", { target_mission: mission.id, approve: button.dataset.missionAction === "approve" });
    } else if (button.dataset.missionAction === "delete-mission") {
      result = await db.rpc("delete_mission_batch", { target_template: mission.template_id });
    }
    if (result?.error) return showToast(result.error.message); await loadWorkspace(); showToast("Mission updated");
  }

  function renderClassrooms() {
    elements.classroomList.replaceChildren(...classrooms.map((room) => {
      const card = document.createElement("article"); card.className = "classroom-card"; card.dataset.classroomId = room.id;
      const title = document.createElement("h3"); title.textContent = room.name; const description = document.createElement("p"); description.textContent = room.description || "No description";
      const meta = document.createElement("div"); meta.className = "classroom-meta"; const role = document.createElement("span"); role.textContent = isOwner(room) ? "Owner" : "Member"; const count = document.createElement("span"); count.textContent = `${memberCount(room.id)} members`; meta.append(role, count);
      card.append(title, description, meta);
      if (isOwner(room)) {
        const invite = document.createElement("div"); invite.className = "invite-box"; const code = document.createElement("code"); code.textContent = room.invite_code;
        const copy = document.createElement("button"); copy.type = "button"; copy.className = "text-button"; copy.dataset.classroomAction = "copy"; copy.textContent = "Copy code"; invite.append(code, copy); card.append(invite);
      } else { const leave = document.createElement("button"); leave.type = "button"; leave.className = "text-button danger-button"; leave.dataset.classroomAction = "leave"; leave.textContent = "Leave classroom"; leave.style.marginTop = "15px"; card.append(leave); }
      return card;
    }));
    elements.classroomEmpty.hidden = classrooms.length > 0;
  }

  async function createClassroom(event) {
    event.preventDefault(); const result = await db.rpc("create_classroom", { classroom_name: elements.classroomName.value.trim(), classroom_description: elements.classroomDescription.value.trim() });
    if (result.error) return showToast(result.error.message); elements.classroomForm.reset(); await loadWorkspace(); showToast("Classroom created — share its invite code");
  }

  async function joinClassroom(event) {
    event.preventDefault(); const result = await db.rpc("join_classroom", { classroom_code: elements.inviteCode.value.trim().toUpperCase() });
    if (result.error) return showToast(result.error.message); elements.joinForm.reset(); await loadWorkspace(); showToast("Joined classroom");
  }

  async function handleClassroomAction(event) {
    const button = event.target.closest("[data-classroom-action]"); const card = event.target.closest("[data-classroom-id]"); if (!button || !card) return;
    const room = classrooms.find((item) => item.id === card.dataset.classroomId); if (!room) return;
    if (button.dataset.classroomAction === "copy") { await navigator.clipboard.writeText(room.invite_code); showToast("Invite code copied"); }
    if (button.dataset.classroomAction === "leave") { const { error } = await db.rpc("leave_classroom", { target_classroom: room.id }); if (error) return showToast(error.message); await loadWorkspace(); showToast("Left classroom"); }
  }

  function renderAll() { renderActivities(); renderMissions(); renderClassrooms(); }

  function setTheme(theme) { document.documentElement.dataset.theme = theme; localStorage.setItem(THEME_KEY, theme); elements.themeToggle.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} mode`); }
  function initTheme() { const saved = localStorage.getItem(THEME_KEY); const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; setTheme(saved === "dark" || saved === "light" ? saved : preferred); }
  function switchView(name) { elements.workspaceButtons.forEach((button) => { const active = button.dataset.view === name; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); }); elements.workspaceViews.forEach((view) => { view.hidden = view.id !== `${name}-view`; }); window.scrollTo({ top: 0, behavior: "smooth" }); }

  function updateAuthMode() {
    const signup = authMode === "signup"; elements.authTitle.textContent = signup ? "Create your account" : "Welcome back";
    elements.authSubtitle.textContent = signup ? "Your activities and missions will sync privately across devices." : "Sign in to see your private workspace.";
    elements.authSubmit.textContent = signup ? "Create account" : "Sign in"; elements.authSwitchCopy.textContent = signup ? "Already have an account?" : "New here?";
    elements.authSwitch.textContent = signup ? "Sign in" : "Create an account"; elements.authPassword.autocomplete = signup ? "new-password" : "current-password";
    elements.authMessage.textContent = ""; elements.authMessage.classList.remove("error"); elements.resendVerification.hidden = true;
  }

  async function handleAuth(event) {
    event.preventDefault(); elements.authSubmit.disabled = true; elements.authMessage.textContent = "Working…"; elements.authMessage.classList.remove("error");
    const email = elements.authEmail.value.trim();
    const credentials = { email, password: elements.authPassword.value };
    const result = authMode === "signup"
      ? await db.auth.signUp({ ...credentials, options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` } })
      : await db.auth.signInWithPassword(credentials);
    elements.authSubmit.disabled = false;
    if (result.error) { elements.authMessage.textContent = result.error.message; elements.authMessage.classList.add("error"); return; }
    if (authMode === "signup" && !result.data.session) {
      pendingVerificationEmail = email;
      elements.authMessage.textContent = "Verification email sent. Check your inbox and spam folder, then open the link.";
      elements.resendVerification.hidden = false;
    }
  }

  async function resendVerification() {
    const email = pendingVerificationEmail || elements.authEmail.value.trim();
    if (!email) { elements.authMessage.textContent = "Enter your email address first."; elements.authMessage.classList.add("error"); return; }
    elements.resendVerification.disabled = true;
    const { error } = await db.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` } });
    elements.resendVerification.disabled = false;
    elements.authMessage.textContent = error ? error.message : "A new verification email was sent. Check your inbox and spam folder.";
    elements.authMessage.classList.toggle("error", Boolean(error));
  }

  async function showSession(user) {
    currentUser = user || null; elements.authView.hidden = Boolean(user); elements.appView.hidden = !user; elements.userControls.hidden = !user; elements.userEmail.textContent = user?.email || "";
    if (user && loadedUserId !== user.id) { loadedUserId = user.id; await loadWorkspace(); }
    if (!user) { loadedUserId = null; activities = []; classrooms = []; classroomMembers = []; missions = []; renderAll(); resetActivityForm(); }
  }

  elements.activityForm.addEventListener("submit", saveActivity); elements.cancelEdit.addEventListener("click", resetActivityForm); elements.activityList.addEventListener("click", handleActivityAction);
  elements.search.addEventListener("input", renderActivities); elements.categoryFilter.addEventListener("change", renderActivities);
  elements.periodButtons.forEach((button) => button.addEventListener("click", () => { activePeriod = button.dataset.period; elements.periodButtons.forEach((item) => { const active = item === button; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); }); renderActivities(); }));
  elements.workspaceButtons.forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  elements.missionForm.addEventListener("submit", createMission); elements.missionStatusFilter.addEventListener("change", renderMissions); elements.missionList.addEventListener("click", handleMissionAction); elements.reviewList.addEventListener("click", handleMissionAction);
  elements.classroomForm.addEventListener("submit", createClassroom); elements.joinForm.addEventListener("submit", joinClassroom); elements.classroomList.addEventListener("click", handleClassroomAction);
  elements.themeToggle.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  elements.authSwitch.addEventListener("click", () => { authMode = authMode === "signin" ? "signup" : "signin"; elements.authForm.reset(); updateAuthMode(); });
  elements.resendVerification.addEventListener("click", resendVerification);
  elements.authForm.addEventListener("submit", handleAuth); elements.signOut.addEventListener("click", async () => { await db.auth.signOut(); showToast("Signed out"); });

  elements.workspaceButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.classList.contains("active"))));
  elements.periodButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.classList.contains("active"))));
  elements.dateLabel.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  initTheme(); updateAuthMode(); renderAll();
  db.auth.onAuthStateChange((_event, session) => setTimeout(() => showSession(session?.user), 0));
  db.auth.getSession().then(({ data }) => showSession(data.session?.user));
})();
