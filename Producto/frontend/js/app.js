const API = '';
const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  lastResults: [],
  savedTrips: []
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

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
  let res;
  try {
    res = await fetch(API + url, { ...options, headers });
  } catch (error) {
    throw new Error('No se pudo conectar con el backend. Revisa que hayas iniciado el servidor con npm start en Producto/backend.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.mensaje || 'No se pudo completar la operación.');
  return data;
}

function openModal(id) { $(id).classList.add('open'); }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('open')); }


function resetHomeView() {
  state.lastResults = [];
  $('featuredGrid').innerHTML = '';
  $('resultsGrid').innerHTML = '';
  $('searchStatus').textContent = 'Realiza una búsqueda';
  $('texto').value = '';
  $('origen').value = '';
  $('destino').value = '';
  $('fechaIda').value = '';
  $('fechaVuelta').value = '';
  $('personas').value = 1;
}


document.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.open)));
document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeModals));

document.querySelectorAll('a[href="#inicio"]').forEach(link => {
  link.addEventListener('click', () => {
    resetHomeView();
    closeModals();
  });
});

$('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  state.token = null;
  state.user = null;
  updateSessionUI();
  toast('Sesión cerrada.');
});

$('registroForm').addEventListener('submit', async (e) => {
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

  if (payload.origen && payload.destino && payload.origen.trim().toLowerCase() === payload.destino.trim().toLowerCase()) {
    toast('El origen y el destino no pueden ser iguales. Revisa los campos Desde y Hasta.');
    return;
  }

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
    renderResults([], err.message || 'No se encontraron viajes disponibles en este momento.');
    toast(err.message || 'No se pudo buscar');
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
    state.savedTrips = [];
    $('savedTrips').innerHTML = '<p class="muted">Inicia sesión para ver tus viajes guardados.</p>';
    return;
  }
  try {
    const data = await request('/api/mis-viajes');
    const viajes = data.viajes || [];
    state.savedTrips = viajes;
    if (!viajes.length) {
      $('savedTrips').innerHTML = '<p class="muted">Aún no tienes viajes guardados.</p>';
      return;
    }
    $('savedTrips').innerHTML = viajes.map(v => `
      <div class="saved-item">
        <div>
          <h3>${escapeHtml(v.origen)} → ${escapeHtml(v.destino)}</h3>
          <p class="muted">${escapeHtml(v.aerolinea)} · ${v.fecha_salida} a ${v.fecha_regreso} · ${escapeHtml(v.hotel)} · ${v.puntuacion} ★</p>
          <p class="muted"><strong>Estado:</strong> ${escapeHtml(v.estado || 'planificado')} ${v.notas ? `· <strong>Nota:</strong> ${escapeHtml(v.notas)}` : ''}</p>
        </div>
        <div class="saved-actions">
          <button class="secondary" onclick="openEditTrip(${v.id})">Editar</button>
          <button class="ghost danger" onclick="deleteTrip(${v.id})">Quitar</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    $('savedTrips').innerHTML = '<p class="muted">No se pudieron cargar tus viajes.</p>';
  }
}


window.openEditTrip = function(id) {
  const viaje = state.savedTrips.find(v => Number(v.id) === Number(id));
  if (!viaje) {
    toast('No se encontró el viaje seleccionado.');
    return;
  }
  $('editTripId').value = viaje.id;
  $('editVueloId').value = viaje.vuelo_id;
  $('editHotelId').value = viaje.hotel_id;
  $('editEstado').value = viaje.estado || 'planificado';
  $('editNotas').value = viaje.notas || '';
  $('editTripTitle').textContent = `${viaje.origen} → ${viaje.destino}`;
  openModal('editTripModal');
};

$('editTripForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('editTripId').value;
  const payload = {
    vuelo_id: $('editVueloId').value,
    hotel_id: $('editHotelId').value,
    estado: $('editEstado').value,
    notas: $('editNotas').value
  };
  try {
    await request(`/api/mis-viajes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    closeModals();
    toast('Viaje actualizado.');
    loadTrips();
  } catch (err) { toast(err.message); }
});

window.deleteTrip = async function(id) {
  try {
    await request(`/api/mis-viajes/${id}`, { method: 'DELETE' });
    toast('Viaje eliminado.');
    loadTrips();
  } catch (err) { toast(err.message); }
};

$('refreshTrips').addEventListener('click', loadTrips);
updateSessionUI();
