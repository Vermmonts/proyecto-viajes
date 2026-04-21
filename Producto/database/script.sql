CREATE TABLE vuelos (
  id INT PRIMARY KEY,
  origen VARCHAR(50),
  destino VARCHAR(50),
  precio INT
);

CREATE TABLE hoteles (
  id INT PRIMARY KEY,
  nombre VARCHAR(100),
  ciudad VARCHAR(50),
  precio INT,
  rating FLOAT
);