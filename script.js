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

const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const countEl = document.getElementById("count");
const clearBtn = document.getElementById("clear-completed");
const filterBtns = document.querySelectorAll(".filter");

// --- Durum ---
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
      // E-posta onayı açıksa session gelmez.
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

// --- Görev işlemleri (Supabase) ---
async function loadTodos() {
  const { data, error } = await db
    .from("todos")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error(error);
    return;
  }
  todos = data;
  render();
}

async function addTodo(text) {
  const { data, error } = await db.from("todos").insert({ text }).select().single();
  if (error) return console.error(error);
  todos.push(data);
  render();
}

async function toggle(id, completed) {
  const { error } = await db.from("todos").update({ completed }).eq("id", id);
  if (error) return console.error(error);
  todos = todos.map((t) => (t.id === id ? { ...t, completed } : t));
  render();
}

async function remove(id) {
  const { error } = await db.from("todos").delete().eq("id", id);
  if (error) return console.error(error);
  todos = todos.filter((t) => t.id !== id);
  render();
}

async function clearCompleted() {
  const { error } = await db.from("todos").delete().eq("completed", true);
  if (error) return console.error(error);
  todos = todos.filter((t) => !t.completed);
  render();
}

// --- Render ---
function render() {
  list.innerHTML = "";

  const filtered = todos.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  if (filtered.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Henüz görev yok.";
    list.appendChild(empty);
  }

  filtered.forEach((todo) => {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.completed ? " completed" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.addEventListener("change", () => toggle(todo.id, checkbox.checked));

    const text = document.createElement("span");
    text.className = "text";
    text.textContent = todo.text;

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "×";
    del.title = "Sil";
    del.addEventListener("click", () => remove(todo.id));

    li.append(checkbox, text, del);
    list.appendChild(li);
  });

  const remaining = todos.filter((t) => !t.completed).length;
  countEl.textContent = `${remaining} görev kaldı`;
}

// --- Görev formu olayları ---
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addTodo(text);
  input.value = "";
  input.focus();
});

clearBtn.addEventListener("click", clearCompleted);

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    filter = btn.dataset.filter;
    render();
  });
});

// --- Oturum değişimlerini dinle ---
db.auth.onAuthStateChange((_event, session) => {
  if (session) {
    userEmailEl.textContent = session.user.email;
    authForm.reset();
    showView(appView);
    loadTodos();
  } else {
    todos = [];
    showView(authView);
  }
});

// --- İlk yükleme: mevcut oturumu kontrol et ---
setMode("login");
(async () => {
  const { data } = await db.auth.getSession();
  if (data.session) {
    userEmailEl.textContent = data.session.user.email;
    showView(appView);
    loadTodos();
  } else {
    showView(authView);
  }
})();
