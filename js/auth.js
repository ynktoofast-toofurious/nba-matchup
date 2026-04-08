// ============================================================
// Authentication — Username/Password login
// Validates against USERS array (synced from REMUS.dbo.app_users)
// ============================================================

function signIn() {
  var usernameInput = document.getElementById("username");
  var passwordInput = document.getElementById("password");
  var loginBtn = document.getElementById("loginBtn");
  var errorEl = document.getElementById("loginError");

  var username = usernameInput.value.trim().toLowerCase();
  var password = passwordInput.value;

  // Clear previous errors
  if (errorEl) errorEl.style.display = "none";

  if (!username || !password) {
    showLoginError("Please enter both username and password.");
    return;
  }

  // Disable button
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> Signing in...';
  }

  var user = null;
  for (var i = 0; i < USERS.length; i++) {
    if (USERS[i].username.toLowerCase() === username && USERS[i].password === password) {
      user = USERS[i];
      break;
    }
  }

  if (user) {
    sessionStorage.setItem("user", JSON.stringify({
      id: user.id,
      name: user.displayName,
      email: user.email,
      role: user.role,
      username: user.username
    }));
    window.location.href = "dashboard.html";
  } else {
    showLoginError("Invalid username or password.");
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = "Sign In";
    }
  }
}

function signOut() {
  sessionStorage.removeItem("user");
  sessionStorage.removeItem("selectedFilters");
  window.location.href = "index.html";
}

function requireAuth() {
  var user = sessionStorage.getItem("user");
  if (!user) {
    window.location.href = "index.html";
    return null;
  }
  return JSON.parse(user);
}

function showLoginError(message) {
  var errEl = document.getElementById("loginError");
  if (errEl) {
    errEl.textContent = message;
    errEl.style.display = "block";
  }
}
