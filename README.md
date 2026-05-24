# Harmonía 🎵

**Diccionario armónico · Improvisación contextual · Sistema de color tonal**

Aplicación web musical interactiva construida en React + Vite + Tailwind CSS.

## Funcionalidades

- **Acorde** — Analiza cualquier acorde, muestra sus notas con color tonal, funciones armónicas y escala sugerida
- **Progresión** — Detecta la tonalidad probable de una progresión y asigna grados romanos
- **Quintas** — Círculo de quintas interactivo con todas las tonalidades
- **Colores** — Sistema cromático tonal: cada nota tiene un color único

## Sistema de colores tonales

| Nota | Color     | Hex     |
|------|-----------|---------|
| C    | Azul      | #1E50DC |
| D    | Verde     | #28A03C |
| E    | Marrón    | #82501E |
| F    | Beige     | #C8B98C |
| G    | Amarillo  | #E6C814 |
| A    | Rojo      | #D22828 |
| B    | Violeta   | #7828B4 |

## Instalación local

```bash
npm install
npm run dev
```

## Deploy en Vercel

Este proyecto está configurado para deploy automático desde GitHub en Vercel.


# Functional Harmony Lab

Aplicación educativa avanzada de armonía, piano y bandoneón desarrollada con React/Vite.

## Objetivo

Crear un laboratorio armónico interactivo capaz de enseñar:

- armonía funcional
- relaciones acorde/escala
- tensiones
- modos
- conducción de voces
- voicings
- color modal
- improvisación
- análisis funcional

La app está orientada especialmente a:
- tango
- jazz
- música moderna
- piano
- bandoneón

---

# Filosofía del Proyecto

Este proyecto NO funciona como un simple diccionario de acordes.

La prioridad es:
- comprensión musical real
- lógica tonal
- voice leading
- resolución de tensiones
- pensamiento armónico funcional

Toda estructura musical debe derivarse desde:
- intervalos
- grados
- contexto tonal
- función armónica

---

# Características Principales

## Armonía
- análisis funcional
- modos griegos
- tensiones disponibles
- avoid notes
- dominantes secundarios
- intercambio modal
- sustituciones

## Escalas
- mayor
- menor natural
- menor armónica
- menor melódica
- modos
- alteradas
- disminuidas

## Instrumentos
- piano interactivo
- sistema visual de bandoneón
- digitaciones
- visualización armónica

## Audio
- síntesis estilo bandoneón
- microdesafinación
- chorus leve
- audio interactivo

---

# Roadmap

## Próximas funciones

- voicings automáticos
- conducción de voces inteligente
- rootless voicings
- drop 2
- voicings tango
- voicings jazz
- digitación automática
- reconocimiento por micrófono
- MIDI
- exportación MusicXML
- generación de progresiones
- análisis armónico avanzado

---

# Arquitectura

src/
components/
theory/
audio/
data/
hooks/
utils/

Separación estricta entre:
- UI
- teoría musical
- parser armónico
- audio
- lógica funcional

---

# Reglas Armónicas

## Nomenclatura
- C = triada mayor
- Cmaj7 o C△7 = séptima mayor

NO usar:
C△

para triadas mayores simples.

## Jónico
Tensiones:
9, 13

Avoid:
11

La #11 pertenece al Lidio.

---

# Objetivo a Largo Plazo

Construir una plataforma profesional de exploración armónica para:
- estudiantes
- arregladores
- improvisadores
- compositores
- pianistas
- bandoneonistas

Combinando:
- teoría
- visualización
- audio
- interacción
- análisis funcional

*Versión MVP · Mayo 2026*
