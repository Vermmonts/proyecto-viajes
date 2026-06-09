USE viajes_app;

INSERT IGNORE INTO vuelos (aerolinea, origen, destino, codigo_origen, codigo_destino, fecha_salida, hora_salida, fecha_regreso, hora_regreso, precio, escalas, puntuacion) VALUES
('LATAM Airlines', 'Santiago', 'Buenos Aires', 'SCL', 'EZE', '2026-07-10', '08:15:00', '2026-07-17', '19:30:00', 145000, 0, 4.7),
('Sky Airline', 'Santiago', 'Buenos Aires', 'SCL', 'EZE', '2026-07-10', '11:40:00', '2026-07-17', '21:15:00', 118000, 0, 4.3),
('JetSMART', 'Santiago', 'Buenos Aires', 'SCL', 'AEP', '2026-07-10', '06:50:00', '2026-07-17', '22:05:00', 99000, 0, 4.0),
('LATAM Airlines', 'Santiago', 'Rio de Janeiro', 'SCL', 'GIG', '2026-07-10', '09:20:00', '2026-07-17', '18:10:00', 239000, 0, 4.8),
('Sky Airline', 'Santiago', 'Rio de Janeiro', 'SCL', 'GIG', '2026-07-10', '13:10:00', '2026-07-17', '20:40:00', 198000, 1, 4.2),
('Copa Airlines', 'Santiago', 'Cancún', 'SCL', 'CUN', '2026-07-10', '04:35:00', '2026-07-17', '17:25:00', 420000, 1, 4.5),
('Avianca', 'Santiago', 'Bogotá', 'SCL', 'BOG', '2026-07-10', '07:00:00', '2026-07-17', '16:10:00', 255000, 0, 4.4),
('LATAM Airlines', 'Santiago', 'Lima', 'SCL', 'LIM', '2026-07-10', '10:00:00', '2026-07-17', '15:20:00', 175000, 0, 4.6),
('Iberia', 'Santiago', 'Madrid', 'SCL', 'MAD', '2026-07-10', '12:10:00', '2026-07-17', '23:50:00', 720000, 0, 4.7),
('LATAM Airlines', 'Santiago', 'Buenos Aires', 'SCL', 'EZE', '2026-08-05', '08:15:00', '2026-08-12', '19:30:00', 132000, 0, 4.7),
('Sky Airline', 'Santiago', 'Rio de Janeiro', 'SCL', 'GIG', '2026-08-05', '13:10:00', '2026-08-12', '20:40:00', 210000, 1, 4.2),
('LATAM Airlines', 'Santiago', 'Lima', 'SCL', 'LIM', '2026-08-05', '10:00:00', '2026-08-12', '15:20:00', 160000, 0, 4.6);

INSERT IGNORE INTO hoteles (nombre, ciudad, direccion, estrellas, puntuacion, precio_noche, imagen) VALUES
('Hotel Madero Buenos Aires', 'Buenos Aires', 'Puerto Madero', 5, 4.8, 92000, 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=900&q=80'),
('NH Buenos Aires City', 'Buenos Aires', 'Centro Histórico', 4, 4.5, 68000, 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=900&q=80'),
('Ibis Buenos Aires Obelisco', 'Buenos Aires', 'Av. Corrientes', 3, 4.1, 42000, 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80'),
('Hilton Copacabana Rio', 'Rio de Janeiro', 'Copacabana', 5, 4.9, 118000, 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=900&q=80'),
('Windsor Plaza Copacabana', 'Rio de Janeiro', 'Copacabana', 4, 4.6, 79000, 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&q=80'),
('Ibis Rio de Janeiro Centro', 'Rio de Janeiro', 'Centro', 3, 4.0, 46000, 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=900&q=80'),
('Grand Fiesta Americana Coral Beach', 'Cancún', 'Zona Hotelera', 5, 4.8, 180000, 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=80'),
('Hotel Estelar Parque 93', 'Bogotá', 'Parque 93', 4, 4.6, 72000, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=80'),
('Costa del Sol Wyndham Lima', 'Lima', 'Miraflores', 4, 4.5, 70000, 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=900&q=80'),
('Hotel Riu Plaza España', 'Madrid', 'Gran Vía', 4, 4.7, 130000, 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=900&q=80');
