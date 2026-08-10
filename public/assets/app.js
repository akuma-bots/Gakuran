async function requireSession() {
  try {
    const res = await fetch('/.netlify/functions/session', { credentials: 'include' });
    const data = await res.json();
    if (!data.authenticated) {
      window.location.href = '/';
      return null;
    }
    renderUser(data.user);
    return data.user;
  } catch (e) {
    window.location.href = '/';
    return null;
  }
}

function renderUser(user) {
  const nameEls = document.querySelectorAll('[data-user-name]');
  const avatarEls = document.querySelectorAll('[data-user-avatar]');
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id) % 6n)}.png`;
  nameEls.forEach((el) => (el.textContent = user.username));
  avatarEls.forEach((el) => (el.src = avatarUrl));
}

function logout() {
  window.location.href = '/.netlify/functions/logout';
}

function toast(message, type) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = 'toast show ' + (type || '');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

async function api(path, options) {
  const res = await fetch('/.netlify/functions/' + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro na requisição.');
  return data;
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return Math.floor(diff / 60) + 'min atrás';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h atrás';
  return Math.floor(diff / 86400) + 'd atrás';
}
