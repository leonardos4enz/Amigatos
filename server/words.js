'use strict';
// Palabras en español, MAYÚSCULAS, sin acentos (Ñ permitida). Pueden tener espacios.
const CATEGORIES = {
  Animales: [
    'PERRO', 'CABALLO', 'ELEFANTE', 'JIRAFA', 'TORTUGA', 'CONEJO', 'PINGUINO', 'MARIPOSA',
    'COCODRILO', 'DELFIN', 'LEON', 'TIGRE', 'BALLENA', 'ARDILLA', 'CANGURO', 'BUHO',
    'MURCIELAGO', 'HORMIGA', 'CAMELLO', 'PULPO', 'ARAÑA', 'CIGUEÑA',
  ],
  Comida: [
    'MANZANA', 'PLATANO', 'TORTILLA', 'QUESADILLA', 'CHOCOLATE', 'GALLETA', 'HELADO', 'PASTEL',
    'ENSALADA', 'SANDIA', 'NARANJA', 'PIZZA', 'TAMAL', 'ARROZ', 'PALOMITAS', 'ESPAGUETI',
    'PIÑA', 'CHURROS', 'HAMBURGUESA', 'SOPA DE FIDEO',
  ],
  'Cosas de gatos': [
    'BIGOTES', 'RONRONEO', 'MAULLIDO', 'OVILLO', 'ARENERO', 'RASCADOR', 'CROQUETAS', 'GARRAS',
    'COLA', 'ALMOHADILLAS', 'CASCABEL', 'SIESTA', 'PESCADO', 'RATON DE JUGUETE', 'HIERBA GATERA',
    'COLLAR', 'BOLA DE PELO', 'MICHI', 'GATITO', 'ESTAMBRE',
  ],
  Casa: [
    'VENTANA', 'COCINA', 'ALMOHADA', 'SILLON', 'ESCALERA', 'LAMPARA', 'REFRIGERADOR', 'ESPEJO',
    'CORTINA', 'ALFOMBRA', 'TELEVISION', 'REGADERA', 'CAJON', 'ARMARIO', 'MESA', 'COBIJA',
    'LAVADORA', 'JARDIN', 'TECHO', 'PUERTA',
  ],
  Naturaleza: [
    'MONTAÑA', 'VOLCAN', 'CASCADA', 'BOSQUE', 'DESIERTO', 'ARCOIRIS', 'TORMENTA', 'GIRASOL',
    'OCEANO', 'ESTRELLA', 'LUNA', 'NUBE', 'RELAMPAGO', 'PLAYA', 'SELVA', 'LAGUNA', 'ROSAL',
    'HOJA SECA', 'NIEVE', 'ARBOL',
  ],
  Colores: [
    'ROJO', 'AZUL', 'VERDE', 'AMARILLO', 'MORADO', 'NARANJA', 'ROSA', 'NEGRO', 'BLANCO', 'GRIS',
    'TURQUESA', 'VIOLETA', 'CAFE', 'DORADO', 'PLATEADO', 'LILA', 'CELESTE', 'BEIGE', 'MAGENTA',
    'AZUL MARINO',
  ],
  Oficios: [
    'DOCTORA', 'BOMBERO', 'MAESTRA', 'PANADERO', 'CARPINTERO', 'ASTRONAUTA', 'VETERINARIA',
    'COCINERO', 'PINTORA', 'MUSICO', 'PILOTO', 'JARDINERO', 'CARTERO', 'DENTISTA', 'POLICIA',
  ],
};

// Sanidad: sólo A-Z, Ñ y espacios.
for (const [cat, list] of Object.entries(CATEGORIES)) {
  CATEGORIES[cat] = list.filter((w) => /^[A-ZÑ ]+$/.test(w));
}

function randomWord() {
  const cats = Object.keys(CATEGORIES);
  const category = cats[Math.floor(Math.random() * cats.length)];
  const list = CATEGORIES[category];
  return { category, word: list[Math.floor(Math.random() * list.length)] };
}

module.exports = { CATEGORIES, randomWord };
