-- =====================================
-- CREAR BASE DE DATOS
-- =====================================

CREATE DATABASE IF NOT EXISTS proyecto_viajes;

USE proyecto_viajes;

-- =====================================
-- TABLA VUELOS
-- =====================================

CREATE TABLE vuelos (

  id INT PRIMARY KEY AUTO_INCREMENT,

  origen VARCHAR(10) NOT NULL,

  destino VARCHAR(10) NOT NULL,

  aerolinea VARCHAR(100) NOT NULL,

  precio INT NOT NULL,

  duracion VARCHAR(50) NOT NULL

);

-- =====================================
-- TABLA HOTELES
-- =====================================

CREATE TABLE hoteles (

  id INT PRIMARY KEY AUTO_INCREMENT,

  nombre VARCHAR(100) NOT NULL,

  ciudad VARCHAR(50) NOT NULL,

  precio INT NOT NULL,

  rating FLOAT NOT NULL

);