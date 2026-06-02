const API = '';
const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  lastResults: []
};

const $ = (id) => document.getElementById(id);

function money(value) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3200);
}

function updateSessionUI() {
  const logged = Boolean(state.token && state.user);
  $('sessionActions').classList.toggle('hidden', logged);
  $('userPill').classList.toggle('hidden', !logged);
  if (logged) $('userName').textContent = state.user.nombre;
  loadTrips();
}

async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(API + url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'No se pudo completar la operación.');
  return data;
}

function openModal(id) { $(id).classList.add('open'); }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('open')); }

document.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.open)));
document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeModals));

$('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  state.token = null;
  state.user = null;
  updateSessionUI();
  toast('Sesión cerrada.');
});

$('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    const data = await request('/api/auth/registro', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    saveSession(data);
    closeModals();
    toast('Cuenta creada correctamente.');
  } catch (err) { toast(err.message); }
});

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    saveSession(data);
    closeModals();
    toast('Bienvenido de vuelta.');
  } catch (err) { toast(err.message); }
});

function saveSession(data) {
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  updateSessionUI();
}

$('searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    texto: $('texto').value,
    origen: $('origen').value,
    destino: $('destino').value,
    fechaIda: $('fechaIda').value,
    fechaVuelta: $('fechaVuelta').value,
    personas: $('personas').value
  };

  $('searchStatus').textContent = 'Buscando opciones...';
  $('featuredGrid').innerHTML = '';
  $('resultsGrid').innerHTML = '';

  try {
    const data = await request('/api/buscar', { method: 'POST', body: JSON.stringify(payload) });
    state.lastResults = data.resultados || [];
    $('searchStatus').textContent = data.encontrados ? `${data.encontrados} opciones encontradas` : 'Sin resultados disponibles';
    renderFeatured(data.destacados);
    renderResults(data.resultados, data.mensaje);
  } catch (err) {
    $('searchStatus').textContent = 'No se pudo buscar';
    renderResults([], 'No se encontraron viajes disponibles en este momento.');
  }
});

function renderFeatured(destacados = {}) {
  const cards = [];
  if (destacados.economico) {
    const v = destacados.economico;
    cards.push(`
      <article class="featured-card">
        <span class="badge">Mejor precio</span>
        <h3>${v.origen} → ${v.destino}</h3>
        <p class="muted">${v.aerolinea} · Ida ${v.fecha_salida} · Vuelta ${v.fecha_regreso}</p>
        <div class="price">${money(v.precio)}</div>
      </article>`);
  }
  if (destacados.mejorValorado) {
    const h = destacados.mejorValorado;
    cards.push(`
      <article class="featured-card">
        <span class="badge">Mejor valoración</span>
        <h3>${h.nombre}</h3>
        <p class="muted">${h.ciudad} · ${h.estrellas} estrellas</p>
        <div class="price">${h.puntuacion} ★</div>
      </article>`);
  }
  $('featuredGrid').innerHTML = cards.join('');
}

function renderResults(resultados = [], emptyMessage = 'No se encontraron viajes disponibles.') {
  if (!resultados.length) {
    $('resultsGrid').innerHTML = `<div class="featured-card"><h3>${emptyMessage}</h3><p class="muted">Intenta con otro destino o modifica las fechas de ida y vuelta.</p></div>`;
    return;
  }
  $('resultsGrid').innerHTML = resultados.map((r, index) => `
    <article class="trip-card">
      <img src="${r.hotel.imagen || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80'}" alt="${r.hotel.nombre}">
      <div class="trip-body">
        <h3>${r.vuelo.destino}</h3>
        <p class="muted">${r.hotel.nombre}</p>
        <div class="meta">
          <span>Vuelo: ${r.vuelo.aerolinea}</span>
          <span>Ida: ${r.vuelo.fecha_salida} ${r.vuelo.hora_salida || ''}</span>
          <span>Vuelta: ${r.vuelo.fecha_regreso} ${r.vuelo.hora_regreso || ''}</span>
          <span class="rating">${r.hotel.puntuacion} ★ · ${r.hotel.estrellas} estrellas</span>
        </div>
        <div class="card-actions">
          <strong>${money(r.total_estimado)}</strong>
          <button class="primary small" onclick="saveTrip(${index})">Guardar</button>
        </div>
      </div>
    </article>
  `).join('');
}

window.saveTrip = async function(index) {
  if (!state.token) {
    openModal('loginModal');
    toast('Inicia sesión para guardar el viaje.');
    return;
  }
  const item = state.lastResults[index];
  try {
    await request('/api/mis-viajes', {
      method: 'POST',
      body: JSON.stringify({ vuelo_id: item.vuelo.id, hotel_id: item.hotel.id })
    });
    toast('Viaje guardado en tu cuenta.');
    loadTrips();
  } catch (err) { toast(err.message); }
};

async function loadTrips() {
  if (!state.token) {
    $('savedTrips').innerHTML = '<p class="muted">Inicia sesión para ver tus viajes guardados.</p>';
    return;
  }
  try {
    const data = await request('/api/mis-viajes');
    const viajes = data.viajes || [];
    if (!viajes.length) {
      $('savedTrips').innerHTML = '<p class="muted">Aún no tienes viajes guardados.</p>';
      return;
    }
    $('savedTrips').innerHTML = viajes.map(v => `
      <div class="saved-item">
        <div>
          <h3>${v.origen} → ${v.destino}</h3>
          <p class="muted">${v.aerolinea} · ${v.fecha_salida} a ${v.fecha_regreso} · ${v.hotel} · ${v.puntuacion} ★</p>
        </div>
        <button class="secondary" onclick="deleteTrip(${v.id})">Quitar</button>
      </div>
    `).join('');
  } catch (err) {
    $('savedTrips').innerHTML = '<p class="muted">No se pudieron cargar tus viajes.</p>';
  }
}

window.deleteTrip = async function(id) {
  try {
    await request(`/api/mis-viajes/${id}`, { method: 'DELETE' });
    toast('Viaje eliminado.');
    loadTrips();
  } catch (err) { toast(err.message); }
};

$('refreshTrips').addEventListener('click', loadTrips);
updateSessionUI();
