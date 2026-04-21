require("dotenv").config();

const vuelos = [
  { precio: 120000, duracion: "3h" },
  { precio: 90000, duracion: "1h 30m" }
];

const hoteles = [
  { nombre: "Hotel Central", precio: 50000, rating: 4.5 },
  { nombre: "Hotel Sur", precio: 40000, rating: 4.2 }
];

function mejorVuelo() {
  return vuelos.sort((a, b) => a.precio - b.precio)[0];
}

function mejorHotel() {
  return hoteles.sort((a, b) => b.rating - a.rating)[0];
}

console.log("Mejor vuelo:", mejorVuelo());
console.log("Mejor hotel:", mejorHotel());