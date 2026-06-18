const API = '';
const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  lastResults: [],
  vuelos: [],
  hoteles: [],
  selectedVuelo: null,
  selectedHotel: null,
  selectedWebOption: null,
  savedTrips: [],
  aiPlan: null,
  webResults: null
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
  $('vuelosGrid').innerHTML = '';
  $('hotelesGrid').innerHTML = '';
  $('selectionPanel').classList.add('hidden');
  $('selectedVueloText').textContent = 'Ninguna opción seleccionada';
  $('selectedHotelText').textContent = 'Ningún hotel seleccionado';
  state.vuelos = [];
  state.hoteles = [];
  state.selectedVuelo = null;
  state.selectedHotel = null;
  state.selectedWebOption = null;
  $('searchStatus').textContent = 'Ingresa los datos de tu viaje';
  $('texto').value = '';
  $('origen').value = '';
  $('destino').value = '';
  $('fechaIda').value = '';
  $('fechaVuelta').value = '';
  $('personas').value = 1;
  $('aiPlanPanel').classList.add('hidden');
  $('webResultsPanel').classList.add('hidden');
  $('aiPlanGrid').innerHTML = '';
  $('webSources').innerHTML = '';
  $('webAnswer').textContent = '';
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
    personas: $('personas').value,
    buscar_web: true
  };

  if (payload.origen && payload.destino && payload.origen.trim().toLowerCase() === payload.destino.trim().toLowerCase()) {
    toast('El origen y el destino no pueden ser iguales.');
    return;
  }

  $('searchStatus').textContent = 'Comparando alternativas disponibles...';
  $('featuredGrid').innerHTML = '';
  $('resultsGrid').innerHTML = '';
  $('vuelosGrid').innerHTML = '';
  $('hotelesGrid').innerHTML = '';
  $('selectionPanel').classList.add('hidden');
  $('aiPlanPanel').classList.add('hidden');
  state.selectedWebOption = null;

  try {
    const data = await request('/api/buscar', { method: 'POST', body: JSON.stringify(payload) });
    state.webResults = data.web || null;
    state.vuelos = [];
    state.hoteles = [];
    state.lastResults = [];
    $('searchStatus').textContent = data.mejor_opcion
      ? 'Mejor alternativa encontrada'
      : 'Búsqueda completada';
    renderWebResults(data.web, data);
  } catch (err) {
    $('searchStatus').textContent = 'No fue posible completar la búsqueda';
    $('webResultsPanel').classList.remove('hidden');
    $('webAnswer').textContent = err.message || 'No fue posible completar la búsqueda.';
    $('webSources').innerHTML = '';
    toast(err.message || 'No se pudo buscar');
  }
});

function renderAIPlan(plan = {}) {
  state.aiPlan = plan;
  const panel = $('aiPlanPanel');
  const propuestas = plan.propuestas || [];
  if (!plan.generado || !propuestas.length) {
    panel.classList.add('hidden');
    $('aiPlanGrid').innerHTML = '';
    return;
  }
  panel.classList.remove('hidden');
  const presupuesto = plan.presupuesto_total ? money(plan.presupuesto_total) : 'sin límite indicado';
  $('aiPlanSummary').textContent = `Presupuesto: ${presupuesto} · ${plan.noches} noches · ${plan.personas} persona(s). ${plan.hay_opciones_en_presupuesto === false ? 'No hay opciones dentro del monto; se muestran las más cercanas.' : ''}`;
  $('aiPlanGrid').innerHTML = propuestas.map((p, index) => `
    <article class="plan-card ${p.dentro_presupuesto ? 'within-budget' : ''}">
      <span class="badge">${index === 0 ? 'Opción recomendada' : (p.dentro_presupuesto ? 'Dentro del presupuesto' : 'Alternativa cercana')}</span>
      <h3>${escapeHtml(p.vuelo.origen)} → ${escapeHtml(p.vuelo.destino)}</h3>
      <p class="muted">${escapeHtml(p.vuelo.aerolinea)} + ${escapeHtml(p.hotel.nombre)}</p>
      <div class="plan-costs">
        <span>Vuelo: <strong>${money(p.costo_vuelo)}</strong></span>
        <span>Estadía: <strong>${money(p.costo_estadia)}</strong></span>
        <span>Total estimado: <strong>${money(p.total_estimado)}</strong></span>
      </div>
      <button class="secondary small" onclick="selectPlan(${index})">Seleccionar esta propuesta</button>
    </article>
  `).join('');
}

window.selectPlan = function(index) {
  const plan = state.aiPlan?.propuestas?.[index];
  if (!plan) return;
  const vueloIndex = state.vuelos.findIndex(v => Number(v.id) === Number(plan.vuelo.id));
  const hotelIndex = state.hoteles.findIndex(h => Number(h.id) === Number(plan.hotel.id));
  if (vueloIndex >= 0) selectFlight(vueloIndex);
  if (hotelIndex >= 0) selectHotel(hotelIndex);
  $('selectionPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

function renderWebResults(web = {}, data = {}) {
  state.webResults = web;
  const panel = $('webResultsPanel');
  const fuentes = web.fuentes || [];
  const datos = web.datos || {};
  const mejor = data.mejor_opcion || datos.mejor_opcion || null;
  const alternativas = data.alternativas || datos.alternativas || [];
  const aeropuerto = data.aeropuerto_recomendado || datos.aeropuerto_recomendado || null;

  panel.classList.remove('hidden');
  $('webAnswer').textContent = data.resumen || datos.resumen || web.motivo || 'Comparamos distintas fuentes para presentar una alternativa conveniente.';
  const criterios = datos.criterios_interpretados || {};

  const optionCard = (opcion, index, principal = false) => {
    if (!opcion) return '';
    const vuelo = opcion.vuelo || {};
    const hotel = opcion.alojamiento || {};
    const traslado = opcion.traslado_local || {};
    const total = opcion.total_estimado != null ? money(opcion.total_estimado) : 'Precio por confirmar';
    const dentro = opcion.dentro_presupuesto === true ? 'Dentro del presupuesto' : (opcion.dentro_presupuesto === false ? 'Supera el presupuesto' : 'Presupuesto no indicado');
    const url = opcion.url_reserva || vuelo.url || hotel.url || traslado.url || fuentes[0]?.url || '';
    return `
      <article class="plan-card ${principal ? 'within-budget' : ''}">
        <span class="badge">${principal ? 'Mejor opción' : `Alternativa ${index + 1}`}</span>
        <h3>${escapeHtml(opcion.origen || '')} → ${escapeHtml(opcion.destino_final || '')}</h3>
        <p class="muted"><strong>Aeropuerto de llegada:</strong> ${escapeHtml(opcion.aeropuerto_llegada || 'Por confirmar')}</p>
        <p class="muted"><strong>Vuelo:</strong> ${escapeHtml(vuelo.proveedor || 'Proveedor por confirmar')} · ${escapeHtml(vuelo.ruta || '')} · ${vuelo.escalas ?? 'N/D'} escala(s)</p>
        <p class="muted"><strong>Alojamiento:</strong> ${escapeHtml(hotel.nombre || 'Por confirmar')} · ${escapeHtml(hotel.ubicacion || '')}</p>
        ${traslado.descripcion ? `<p class="muted"><strong>Traslado final:</strong> ${escapeHtml(traslado.descripcion)}</p>` : ''}
        <p><strong>Total estimado:</strong> ${total} · ${escapeHtml(dentro)}</p>
        <p>${escapeHtml(opcion.por_que_es_mejor || '')}</p>
        <div class="saved-actions">
          <button class="secondary small" onclick="selectWebOption(${principal ? -1 : index})">Seleccionar para guardar</button>
          ${url ? `<a class="primary small" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Ver proveedor ↗</a>` : ''}
        </div>
      </article>`;
  };

  let airportHtml = '';
  if (aeropuerto) {
    airportHtml = `
      <article class="featured-card">
        <span class="badge">Aeropuerto recomendado</span>
        <h3>${escapeHtml(aeropuerto.nombre || aeropuerto.ciudad || 'Aeropuerto más cercano')} ${aeropuerto.codigo ? `(${escapeHtml(aeropuerto.codigo)})` : ''}</h3>
        <p class="muted">${aeropuerto.es_alternativo ? 'El destino no tiene un aeropuerto práctico; se recomienda esta alternativa.' : 'Aeropuerto recomendado para el destino.'}</p>
        ${aeropuerto.distancia_aprox_km != null ? `<p>Distancia al destino: aprox. ${escapeHtml(aeropuerto.distancia_aprox_km)} km</p>` : ''}
        ${aeropuerto.medio_traslado ? `<p>Traslado: ${escapeHtml(aeropuerto.medio_traslado)} · ${escapeHtml(aeropuerto.duracion_traslado || '')}</p>` : ''}
        <p>${escapeHtml(aeropuerto.motivo || '')}</p>
      </article>`;
  }

  const criteriosHtml = Object.keys(criterios).length ? `
    <article class="featured-card">
      <span class="badge">Resumen del viaje</span>
      <p><strong>Ruta:</strong> ${escapeHtml(criterios.origen || 'Origen por confirmar')} → ${escapeHtml(criterios.destino_o_zona || 'Destino flexible')}</p>
      <p><strong>Fechas:</strong> ${escapeHtml(criterios.fechas_o_flexibilidad || 'Flexibles')} · <strong>Duración:</strong> ${escapeHtml(criterios.duracion || 'Flexible')}</p>
      <p><strong>Viajeros:</strong> ${escapeHtml(criterios.viajeros || 'No especificado')} · <strong>Presupuesto:</strong> ${escapeHtml(criterios.presupuesto || 'No indicado')}</p>
      <p><strong>Tipo de viaje:</strong> ${escapeHtml(criterios.tipo_viaje || 'General')}</p>
      ${(criterios.prioridades || []).length ? `<p><strong>Prioridades:</strong> ${escapeHtml(criterios.prioridades.join(', '))}</p>` : ''}
      ${(criterios.preferencias || []).length ? `<p><strong>Preferencias:</strong> ${escapeHtml(criterios.preferencias.join(', '))}</p>` : ''}
      ${(criterios.supuestos_utilizados || []).length ? `<p class="muted"><strong>Información considerada:</strong> ${escapeHtml(criterios.supuestos_utilizados.join(' · '))}</p>` : ''}
    </article>` : '';

  $('webSources').innerHTML = `
    ${criteriosHtml}
    ${airportHtml}
    <div class="ai-plan-grid">
      ${optionCard(mejor, 0, true)}
      ${alternativas.map((o, i) => optionCard(o, i, false)).join('')}
    </div>
    <h3>Sitios y proveedores consultados</h3>
    ${fuentes.length ? fuentes.map(f => `
      <a class="source-card" href="${escapeHtml(f.url)}" target="_blank" rel="noopener noreferrer">
        <strong>${escapeHtml(f.titulo)}</strong>
        <span>${escapeHtml(f.dominio || f.url)}</span>
        <small>Abrir fuente externa ↗</small>
      </a>`).join('') : '<p class="muted">No se recibieron enlaces verificables.</p>'}`;
}

window.selectWebOption = function(index) {
  const datos = state.webResults?.datos || {};
  const opcion = index === -1 ? datos.mejor_opcion : (datos.alternativas || [])[index];
  if (!opcion) {
    toast('No se pudo seleccionar esa opción.');
    return;
  }
  state.selectedWebOption = opcion;
  $('selectionPanel').classList.remove('hidden');
  $('selectedVueloText').textContent = `${opcion.origen || ''} → ${opcion.destino_final || ''} · ${opcion.titulo || 'Alternativa seleccionada'} · ${opcion.total_estimado != null ? money(opcion.total_estimado) : 'Precio por confirmar'}`;
  $('selectionPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

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

function renderSeparatedResults(vuelos = [], hoteles = [], emptyMessage = 'No se encontraron viajes disponibles.') {
  $('resultsGrid').innerHTML = '';
  $('selectionPanel').classList.toggle('hidden', !(vuelos.length || hoteles.length));
  $('selectedVueloText').textContent = 'Ninguna opción seleccionada';
  $('selectedHotelText').textContent = 'Ningún hotel seleccionado';

  if (!vuelos.length && !hoteles.length) {
    $('vuelosGrid').innerHTML = '';
    $('hotelesGrid').innerHTML = '';
    $('resultsGrid').innerHTML = `<div class="featured-card"><h3>${emptyMessage}</h3><p class="muted">Intenta con otro origen, destino o modifica las fechas de ida y vuelta.</p></div>`;
    return;
  }

  $('vuelosGrid').innerHTML = vuelos.length ? vuelos.map((v, index) => `
    <article class="option-card flight-card" id="vueloCard${v.id}">
      <div class="option-icon">✈</div>
      <div class="option-body">
        <div class="option-title-row">
          <h3>${escapeHtml(v.origen)} → ${escapeHtml(v.destino)}</h3>
          <strong>${money(v.precio)}</strong>
        </div>
        <p class="muted">${escapeHtml(v.aerolinea)} · Ida ${v.fecha_salida} ${v.hora_salida || ''} · Vuelta ${v.fecha_regreso} ${v.hora_regreso || ''}</p>
        <div class="meta compact">
          <span>Escalas: ${v.escalas ?? 0}</span>
          <span>${v.puntuacion || 4.0} ★</span>
        </div>
        <button class="secondary small" onclick="selectFlight(${index})">Seleccionar vuelo</button>
      </div>
    </article>
  `).join('') : `<div class="featured-card"><h3>No hay vuelos disponibles</h3><p class="muted">Prueba con otra fecha, origen o destino.</p></div>`;

  $('hotelesGrid').innerHTML = hoteles.length ? hoteles.map((h, index) => `
    <article class="option-card hotel-card" id="hotelCard${h.id}">
      <img src="${h.imagen || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80'}" alt="${escapeHtml(h.nombre)}">
      <div class="option-body">
        <div class="option-title-row">
          <h3>${escapeHtml(h.nombre)}</h3>
          <strong>${money(h.precio_noche)} / noche</strong>
        </div>
        <p class="muted">${escapeHtml(h.ciudad)} · ${h.estrellas || 3} estrellas</p>
        <div class="meta compact">
          <span class="rating">${h.puntuacion || 4.0} ★</span>
          <span>Disponible</span>
        </div>
        <button class="secondary small" onclick="selectHotel(${index})">Seleccionar hotel</button>
      </div>
    </article>
  `).join('') : `<div class="featured-card"><h3>No hay hoteles disponibles</h3><p class="muted">Prueba con otro destino.</p></div>`;
}

window.selectFlight = function(index) {
  state.selectedVuelo = state.vuelos[index];
  document.querySelectorAll('.flight-card').forEach(card => card.classList.remove('selected'));
  const card = $(`vueloCard${state.selectedVuelo.id}`);
  if (card) card.classList.add('selected');
  $('selectedVueloText').textContent = `${state.selectedVuelo.origen} → ${state.selectedVuelo.destino} · ${state.selectedVuelo.aerolinea} · ${money(state.selectedVuelo.precio)}`;
};

window.selectHotel = function(index) {
  state.selectedHotel = state.hoteles[index];
  document.querySelectorAll('.hotel-card').forEach(card => card.classList.remove('selected'));
  const card = $(`hotelCard${state.selectedHotel.id}`);
  if (card) card.classList.add('selected');
  $('selectedHotelText').textContent = `${state.selectedHotel.nombre} · ${state.selectedHotel.ciudad} · ${money(state.selectedHotel.precio_noche)} / noche`;
};

async function saveSelectedTrip() {
  if (!state.token) {
    openModal('loginModal');
    toast('Inicia sesión para guardar el viaje.');
    return;
  }
  if (!state.selectedWebOption) {
    toast('Selecciona una de las alternativas disponibles.');
    return;
  }
  try {
    await request('/api/mis-viajes', {
      method: 'POST',
      body: JSON.stringify({ opcion_web: state.selectedWebOption })
    });
    toast('Alternativa guardada en tus reservas.');
    loadTrips();
  } catch (err) { toast(err.message); }
}

const saveSelectedTripBtn = $('saveSelectedTrip');
if (saveSelectedTripBtn) saveSelectedTripBtn.addEventListener('click', saveSelectedTrip);

function renderResults(resultados = [], emptyMessage = 'No se encontraron viajes disponibles.') {
  // Compatibilidad con versiones antiguas. La interfaz actual muestra vuelos y hoteles por separado.
  const vuelos = resultados.map(r => r.vuelo).filter(Boolean);
  const hoteles = resultados.map(r => r.hotel).filter(Boolean);
  renderSeparatedResults(vuelos, hoteles, emptyMessage);
}

window.saveTrip = async function(index) {
  const item = state.lastResults[index];
  if (!item) {
    toast('No se encontró el viaje seleccionado.');
    return;
  }
  state.selectedVuelo = item.vuelo;
  state.selectedHotel = item.hotel;
  await saveSelectedTrip();
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
          <h3>${escapeHtml(v.origen || '')} → ${escapeHtml(v.destino || '')}</h3>
          <p class="muted">${escapeHtml(v.aerolinea || 'Vuelo por confirmar')} · ${escapeHtml(v.hotel || 'Alojamiento por confirmar')} · ${escapeHtml(v.fechas || 'Fechas flexibles')}</p>
          ${v.aeropuerto_llegada ? `<p class="muted"><strong>Aeropuerto:</strong> ${escapeHtml(v.aeropuerto_llegada)}</p>` : ''}
          <p class="muted"><strong>Total estimado:</strong> ${v.total_estimado != null ? money(v.total_estimado) : 'Por confirmar'} · <strong>Estado:</strong> ${escapeHtml(v.estado || 'planificado')} ${v.notas ? `· <strong>Nota:</strong> ${escapeHtml(v.notas)}` : ''}</p>
          ${v.url_reserva ? `<a href="${escapeHtml(v.url_reserva)}" target="_blank" rel="noopener noreferrer">Abrir proveedor ↗</a>` : ''}
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
  $('editVueloId').value = '';
  $('editHotelId').value = '';
  $('editEstado').value = viaje.estado || 'planificado';
  $('editNotas').value = viaje.notas || '';
  $('editTripTitle').textContent = `${viaje.origen || ''} → ${viaje.destino || ''}`;
  openModal('editTripModal');
};

$('editTripForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('editTripId').value;
  const payload = {
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
