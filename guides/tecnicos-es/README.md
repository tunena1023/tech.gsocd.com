# Guía del Portal de Técnicos (GS Tech), en español

Guía para empleados y supervisores, formato **librito** (media carta, 32 páginas).

| Archivo | Para qué |
|---|---|
| `Guia-GS-Tech-LIBRITO-imprimir.pdf` | Para la impresora: 8 hojas carta a doble cara, **volteando por el lado corto**, tamaño real (100%). Se doblan a la mitad y se engrapan. |
| `Guia-GS-Tech-media-carta-para-ver.pdf` | Las mismas 32 páginas en orden, para ver en pantalla o mandar por WhatsApp. |
| `fuente/` | Todo lo necesario para cambiarla y volver a sacarla. |

## Cambios que pidió el dueño (26/09/2026), no regresarlos
- No decir que las fotos se guardan en el teléfono. En su lugar: "si algo se queda guardado en tu teléfono, lo puedes borrar sin problema: no afecta la app".
- No pedir aceptar la ubicación (geolocalización). Eso se ve desde la oficina, no en la guía.
- No agregar nada que no se haya pedido.

## Cómo cambiar el texto y volver a sacar los PDF
En `fuente/` (necesita Node 22 y Playwright con Chromium):
```
npm install
node topdf-libro.js guia-libro.html libro-paginas.pdf     # 32 páginas de media carta
cp libro-paginas.pdf ../Guia-GS-Tech-media-carta-para-ver.pdf
node imponer.js libro-paginas.pdf ../Guia-GS-Tech-LIBRITO-imprimir.pdf   # acomodo para imprimir
```
El texto está en `guia-libro.html`. Las capturas que usa están en `fuente/shotsj/`. Si el total deja de ser múltiplo de 4, `imponer.js` agrega páginas en blanco al final.

## Cómo volver a sacar las capturas (si cambia la app)
Las capturas son de la app REAL (los HTML de este repo, tal cual) con datos de ejemplo. No tocan SharePoint.
1. `node mock-server.js`: sirve la raíz de este repo en http://localhost:8787 y contesta `/api/*` con datos de ejemplo (empleado "Carlos Ramírez", supervisora "Laura Méndez", clientes inventados).
2. `node cap1.js` (entrar, Active Orders, cámara) y `node cap2.js` (Recurring, History, Gallery, español, supervisor). Guardan en `shots/`.
3. `node tojpg.js`: pasa `shots/` a `shotsj/` (JPEG, pesa menos en el PDF).

`make-photos.js` genera las fotos de ejemplo de `photos/`. `photos/cam.mjpeg` es la cámara falsa que usa Chromium.
