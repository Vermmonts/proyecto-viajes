USE proyecto_viajes;

-- =====================================
-- LIMPIAR TABLAS
-- =====================================

DELETE FROM vuelos;
DELETE FROM hoteles;

-- =====================================
-- DATOS VUELOS CHILE
-- =====================================

INSERT INTO vuelos (
  origen,
  destino,
  aerolinea,
  precio,
  duracion
)
VALUES

('Santiago', 'Antofagasta', 'LATAM', 85000, '2h'),
('Santiago', 'Antofagasta', 'Sky', 70000, '2h 10m'),
('Santiago', 'Antofagasta', 'JetSmart', 65000, '2h'),

('Santiago', 'Concepción', 'LATAM', 50000, '1h'),
('Santiago', 'Concepción', 'Sky', 45000, '1h 5m'),

('Santiago', 'Puerto Montt', 'LATAM', 95000, '2h 15m'),
('Santiago', 'Puerto Montt', 'Sky', 85000, '2h 20m'),

('Santiago', 'Temuco', 'JetSmart', 55000, '1h 30m'),
('Santiago', 'Temuco', 'LATAM', 65000, '1h 25m'),

('Santiago', 'Punta Arenas', 'LATAM', 110000, '3h'),
('Santiago', 'Punta Arenas', 'Sky', 95000, '3h 15m'),

('Santiago', 'Iquique', 'JetSmart', 70000, '2h 20m'),
('Santiago', 'Iquique', 'LATAM', 80000, '2h'),

('Santiago', 'La Serena', 'LATAM', 60000, '1h 20m'),

('Santiago', 'Arica', 'Sky', 95000, '3h'),
('Santiago', 'Arica', 'LATAM', 110000, '3h 10m');

-- =====================================
-- DATOS VUELOS LATINOAMERICA
-- =====================================

INSERT INTO vuelos (
  origen,
  destino,
  aerolinea,
  precio,
  duracion
)
VALUES

('Santiago', 'Lima', 'LATAM', 120000, '3h'),
('Santiago', 'Lima', 'Sky', 95000, '2h 45m'),
('Santiago', 'Lima', 'JetSmart', 85000, '3h'),

('Santiago', 'Buenos Aires', 'LATAM', 140000, '2h'),
('Santiago', 'Buenos Aires', 'Sky', 125000, '2h 10m'),

('Santiago', 'Río de Janeiro', 'LATAM', 250000, '4h'),
('Santiago', 'Río de Janeiro', 'Sky', 220000, '4h 10m'),

('Santiago', 'São Paulo', 'LATAM', 280000, '4h 30m'),

('Santiago', 'Bogotá', 'Avianca', 320000, '6h'),

('Santiago', 'Ciudad de México', 'Aeromexico', 450000, '8h'),

('Santiago', 'Quito', 'LATAM', 350000, '6h'),

('Santiago', 'Cancún', 'Copa Airlines', 520000, '9h');

-- =====================================
-- DATOS VUELOS USA Y EUROPA
-- =====================================

INSERT INTO vuelos (
  origen,
  destino,
  aerolinea,
  precio,
  duracion
)
VALUES

('Santiago', 'Miami', 'American Airlines', 450000, '8h'),
('Santiago', 'Miami', 'LATAM', 430000, '8h 15m'),

('Santiago', 'Nueva York', 'Delta', 680000, '10h'),

('Santiago', 'Los Ángeles', 'LATAM', 750000, '11h'),

('Santiago', 'Madrid', 'Iberia', 780000, '12h'),
('Santiago', 'Madrid', 'LATAM', 820000, '12h 20m'),

('Santiago', 'Barcelona', 'Iberia', 850000, '13h'),

('Santiago', 'París', 'Air France', 980000, '14h'),

('Santiago', 'Roma', 'ITA Airways', 1050000, '15h'),

('Santiago', 'Londres', 'British Airways', 1150000, '16h');

-- =====================================
-- HOTELES CHILE
-- =====================================

INSERT INTO hoteles (
  nombre,
  ciudad,
  precio,
  rating
)
VALUES

('Hotel Santiago Centro', 'Santiago', 65000, 4.5),
('Hotel Plaza Santiago', 'Santiago', 85000, 4.8),
('Hostal Providencia', 'Santiago', 30000, 4.1),

('Hotel Antofagasta', 'Antofagasta', 70000, 4.4),
('Hotel Desierto Norte', 'Antofagasta', 55000, 4.0),

('Hotel Concepción', 'Concepción', 60000, 4.3),

('Hotel Puerto Montt', 'Puerto Montt', 75000, 4.5),

('Hotel Patagonia', 'Punta Arenas', 85000, 4.7),
('Hostal Austral', 'Punta Arenas', 40000, 4.0),

('Hotel Iquique Beach', 'Iquique', 72000, 4.6),

('Hotel La Serena', 'La Serena', 68000, 4.4),

('Hotel Arica Sol', 'Arica', 60000, 4.2),

('Hotel Temuco Plaza', 'Temuco', 58000, 4.1);

-- =====================================
-- HOTELES LATINOAMERICA
-- =====================================

INSERT INTO hoteles (
  nombre,
  ciudad,
  precio,
  rating
)
VALUES

('Hotel Central Lima', 'Lima', 50000, 4.5),
('Hotel Premium Lima', 'Lima', 70000, 4.8),
('Hostal Lima Económico', 'Lima', 25000, 3.9),

('Hotel Buenos Aires', 'Buenos Aires', 65000, 4.7),
('Hotel Obelisco', 'Buenos Aires', 55000, 4.3),

('Rio Beach Hotel', 'Río de Janeiro', 95000, 4.8),

('Sao Paulo Business Hotel', 'São Paulo', 90000, 4.5),

('Bogotá Suites', 'Bogotá', 70000, 4.2),

('Hotel Cancún Resort', 'Cancún', 160000, 4.9),

('Mexico City Hotel', 'Ciudad de México', 85000, 4.4),

('Quito Andes Hotel', 'Quito', 60000, 4.1);

-- =====================================
-- HOTELES USA Y EUROPA
-- =====================================

INSERT INTO hoteles (
  nombre,
  ciudad,
  precio,
  rating
)
VALUES

('Miami Beach Hotel', 'Miami', 120000, 4.9),
('Ocean Miami Resort', 'Miami', 150000, 4.8),

('New York Central Hotel', 'Nueva York', 220000, 4.7),

('Los Angeles Sunset Hotel', 'Los Ángeles', 180000, 4.5),

('Hotel Madrid Centro', 'Madrid', 85000, 4.8),
('Hotel Sol Madrid', 'Madrid', 70000, 4.3),

('Barcelona Sea Hotel', 'Barcelona', 98000, 4.6),

('Paris Luxury Hotel', 'París', 250000, 4.9),

('Roma Imperial Hotel', 'Roma', 180000, 4.7),

('London Bridge Hotel', 'Londres', 260000, 4.8);