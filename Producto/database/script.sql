CREATE DATABASE IF NOT EXISTS viajes_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE viajes_app;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vuelos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  aerolinea VARCHAR(100) NOT NULL,
  origen VARCHAR(100) NOT NULL,
  destino VARCHAR(100) NOT NULL,
  codigo_origen VARCHAR(10),
  codigo_destino VARCHAR(10),
  fecha_salida DATE NOT NULL,
  hora_salida TIME,
  fecha_regreso DATE NOT NULL,
  hora_regreso TIME,
  precio DECIMAL(10,2) NOT NULL,
  escalas INT DEFAULT 0,
  puntuacion DECIMAL(3,2) DEFAULT 4.0,
  disponible BOOLEAN DEFAULT TRUE,
  UNIQUE KEY uq_vuelo_base (aerolinea, origen, destino, fecha_salida, fecha_regreso, hora_salida),
  INDEX idx_busqueda (origen, destino, fecha_salida, fecha_regreso),
  INDEX idx_precio (precio),
  INDEX idx_puntuacion (puntuacion)
);

CREATE TABLE IF NOT EXISTS hoteles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  ciudad VARCHAR(100) NOT NULL,
  direccion VARCHAR(255),
  estrellas INT DEFAULT 3,
  puntuacion DECIMAL(3,2) DEFAULT 4.0,
  precio_noche DECIMAL(10,2) NOT NULL,
  imagen VARCHAR(500),
  disponible BOOLEAN DEFAULT TRUE,
  UNIQUE KEY uq_hotel_ciudad (nombre, ciudad),
  INDEX idx_ciudad (ciudad),
  INDEX idx_hotel_precio (precio_noche),
  INDEX idx_hotel_puntuacion (puntuacion)
);

CREATE TABLE IF NOT EXISTS viajes_guardados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  vuelo_id INT NOT NULL,
  hotel_id INT NOT NULL,
  estado VARCHAR(30) DEFAULT 'planificado',
  notas VARCHAR(500),
  fecha_guardado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_viaje_usuario (usuario_id, vuelo_id, hotel_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (vuelo_id) REFERENCES vuelos(id) ON DELETE CASCADE,
  FOREIGN KEY (hotel_id) REFERENCES hoteles(id) ON DELETE CASCADE
);
