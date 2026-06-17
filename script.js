// --- Supabase istemcisi ---
const cfg = window.SUPABASE_CONFIG || {};
if (!cfg.url || cfg.url.includes("BURAYA") || !cfg.anonKey || cfg.anonKey.includes("BURAYA")) {
  alert("config.js içindeki Supabase URL ve anon key değerlerini doldurman gerekiyor.");
}
const db = window.supabase.createClient(cfg.url, cfg.anonKey);

// --- DOM ---
const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");
const loadingView = document.getElementById("loading-view");

const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const authSubmit = document.getElementById("auth-submit");
const authSubtitle = document.getElementById("auth-subtitle");
const authToggleText = document.getElementById("auth-toggle-text");
const authToggleBtn = document.getElementById("auth-toggle-btn");
const authMessage = document.getElementById("auth-message");

const logoutBtn = document.getElementById("logout");
const userEmailEl = document.getElementById("user-email");
const board = document.getElementById("board");
const filterBtns = document.querySelectorAll(".filter");

// --- Durum ---
let categories = [];
let todos = [];
let filter = "all";
let mode = "login"; // "login" | "signup"

// --- Ekran yönetimi ---
function showView(view) {
  for (const v of [authView, appView, loadingView]) v.hidden = v !== view;
}

function setMode(next) {
  mode = next;
  authMessage.textContent = "";
  if (mode === "login") {
    authSubtitle.textContent = "Devam etmek için giriş yap";
    authSubmit.textContent = "Giriş yap";
    authToggleText.textContent = "Hesabın yok mu?";
    authToggleBtn.textContent = "Kayıt ol";
    passwordInput.autocomplete = "current-password";
  } else {
    authSubtitle.textContent = "Yeni bir hesap oluştur";
    authSubmit.textContent = "Kayıt ol";
    authToggleText.textContent = "Zaten hesabın var mı?";
    authToggleBtn.textContent = "Giriş yap";
    passwordInput.autocomplete = "new-password";
  }
}

function showMessage(text, isError = true) {
  authMessage.textContent = text;
  authMessage.classList.toggle("error", isError);
  authMessage.classList.toggle("ok", !isError);
}

// --- Kimlik doğrulama ---
authToggleBtn.addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  authSubmit.disabled = true;
  showMessage("", false);

  try {
    if (mode === "signup") {
      const { data, error } = await db.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        showMessage("Kayıt başarılı. E-postandaki onay bağlantısına tıkla, sonra giriş yap.", false);
        setMode("login");
      }
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    showMessage(translateError(err.message));
  } finally {
    authSubmit.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await db.auth.signOut();
});

function translateError(msg) {
  if (/Invalid login credentials/i.test(msg)) return "E-posta veya parola hatalı.";
  if (/already registered/i.test(msg)) return "Bu e-posta zaten kayıtlı.";
  if (/Password should be/i.test(msg)) return "Parola en az 6 karakter olmalı.";
  return msg;
}

// --- Veri yükleme ---
async function loadData() {
  const [catRes, todoRes] = await Promise.all([
    db.from("categories").select("*").order("position", { ascending: true }).order("created_at", { ascending: true }),
    db.from("todos").select("*").order("created_at", { ascending: true }),
  ]);
  if (catRes.error) return console.error(catRes.error);
  if (todoRes.error) return console.error(todoRes.error);
  categories = catRes.data;
  todos = todoRes.data;
  render();
}

// --- Kategori işlemleri ---
async function addCategory(name) {
  const position = categories.length;
  const { data, error } = await db
    .from("categories")
    .insert({ name, position })
    .select()
    .single();
  if (error) return console.error(error);
  categories.push(data);
  render();
}

async function removeCategory(id) {
  const cat = categories.find((c) => c.id === id);
  const count = todos.filter((t) => t.category_id === id).length;
  const msg = count > 0
    ? `"${cat.name}" kategorisini ve içindeki ${count} görevi silmek istediğine emin misin?`
    : `"${cat.name}" kategorisini silmek istediğine emin misin?`;
  if (!confirm(msg)) return;
  const { error } = await db.from("categories").delete().eq("id", id);
  if (error) return console.error(error);
  categories = categories.filter((c) => c.id !== id);
  todos = todos.filter((t) => t.category_id !== id); // cascade ile DB'de de silindi
  render();
}

// --- Görev işlemleri ---
async function addTodo(categoryId, text) {
  const { data, error } = await db
    .from("todos")
    .insert({ text, category_id: categoryId })
    .select()
    .single();
  if (error) return console.error(error);
  todos.push(data);
  render();
}

async function toggleTodo(id, completed) {
  const { error } = await db.from("todos").update({ completed }).eq("id", id);
  if (error) return console.error(error);
  todos = todos.map((t) => (t.id === id ? { ...t, completed } : t));
  render();
}

async function removeTodo(id) {
  const { error } = await db.from("todos").delete().eq("id", id);
  if (error) return console.error(error);
  todos = todos.filter((t) => t.id !== id);
  render();
}

async function moveTodo(id, categoryId) {
  const todo = todos.find((t) => t.id === id);
  if (!todo || todo.category_id === categoryId) return;
  // İyimser güncelleme
  todos = todos.map((t) => (t.id === id ? { ...t, category_id: categoryId } : t));
  render();
  const { error } = await db.from("todos").update({ category_id: categoryId }).eq("id", id);
  if (error) {
    console.error(error);
    loadData(); // hata olursa sunucudan tazele
  }
}

// --- Render ---
function matchesFilter(todo) {
  if (filter === "active") return !todo.completed;
  if (filter === "completed") return todo.completed;
  return true;
}

function render() {
  board.innerHTML = "";

  categories.forEach((cat) => board.appendChild(renderColumn(cat)));

  // "Kategori ekle" sütunu
  board.appendChild(renderAddColumn());
}

function renderColumn(cat) {
  const col = document.createElement("section");
  col.className = "column";
  col.dataset.categoryId = cat.id;

  const catTodos = todos.filter((t) => t.category_id === cat.id);
  const shown = catTodos.filter(matchesFilter);

  // Başlık
  const header = document.createElement("div");
  header.className = "column-header";
  const title = document.createElement("span");
  title.className = "column-title";
  title.textContent = cat.name;
  const count = document.createElement("span");
  count.className = "column-count";
  count.textContent = catTodos.length;
  const del = document.createElement("button");
  del.className = "column-delete";
  del.textContent = "×";
  del.title = "Kategoriyi sil";
  del.addEventListener("click", () => removeCategory(cat.id));
  header.append(title, count, del);

  // Kart listesi (bırakma hedefi)
  const listEl = document.createElement("div");
  listEl.className = "card-list";
  listEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    col.classList.add("drag-over");
  });
  listEl.addEventListener("dragleave", (e) => {
    if (!col.contains(e.relatedTarget)) col.classList.remove("drag-over");
  });
  listEl.addEventListener("drop", (e) => {
    e.preventDefault();
    col.classList.remove("drag-over");
    const id = Number(e.dataTransfer.getData("text/plain"));
    moveTodo(id, cat.id);
  });

  if (shown.length === 0) {
    const empty = document.createElement("div");
    empty.className = "card-empty";
    empty.textContent = "Görev yok";
    listEl.appendChild(empty);
  } else {
    shown.forEach((todo) => listEl.appendChild(renderCard(todo)));
  }

  // Görev ekleme formu
  const addForm = document.createElement("form");
  addForm.className = "add-card";
  const inp = document.createElement("input");
  inp.type = "text";
  inp.placeholder = "+ Görev ekle";
  inp.autocomplete = "off";
  addForm.appendChild(inp);
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = inp.value.trim();
    if (!text) return;
    addTodo(cat.id, text);
    inp.value = "";
    inp.focus();
  });

  col.append(header, listEl, addForm);
  return col;
}

function renderCard(todo) {
  const card = document.createElement("div");
  card.className = "card" + (todo.completed ? " completed" : "");
  card.draggable = true;
  card.dataset.id = todo.id;

  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", String(todo.id));
    e.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = todo.completed;
  checkbox.addEventListener("change", () => toggleTodo(todo.id, checkbox.checked));

  const text = document.createElement("span");
  text.className = "card-text";
  text.textContent = todo.text;

  const del = document.createElement("button");
  del.className = "card-delete";
  del.textContent = "×";
  del.title = "Sil";
  del.addEventListener("click", () => removeTodo(todo.id));

  card.append(checkbox, text, del);
  return card;
}

function renderAddColumn() {
  const col = document.createElement("section");
  col.className = "column add-column";

  const form = document.createElement("form");
  form.className = "add-category";
  const inp = document.createElement("input");
  inp.type = "text";
  inp.placeholder = "Yeni kategori";
  inp.autocomplete = "off";
  const btn = document.createElement("button");
  btn.type = "submit";
  btn.textContent = "+ Kategori ekle";
  form.append(inp, btn);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = inp.value.trim();
    if (!name) return;
    addCategory(name);
    inp.value = "";
  });

  col.appendChild(form);
  return col;
}

// --- Filtre olayları ---
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    filter = btn.dataset.filter;
    render();
  });
});

// --- Oturum yönetimi ---
db.auth.onAuthStateChange((_event, session) => {
  if (session) {
    userEmailEl.textContent = session.user.email;
    authForm.reset();
    showView(appView);
    loadData();
  } else {
    categories = [];
    todos = [];
    showView(authView);
  }
});

setMode("login");
(async () => {
  const { data } = await db.auth.getSession();
  if (data.session) {
    userEmailEl.textContent = data.session.user.email;
    showView(appView);
    loadData();
  } else {
    showView(authView);
  }
})();
