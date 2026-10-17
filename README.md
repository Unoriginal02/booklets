# Libritos

Editor de libritos de fotos cosidos a caballete. Todo ocurre en el navegador: las fotos se guardan en IndexedDB y el PDF impuesto se genera en un Web Worker.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # imposición y geometría (Vitest)
npm run e2e -- <carpeta-fotos> <carpeta-salida> http://localhost:5173/   # punta a punta con Chrome
npm run build
```

- `src/model/` — tipos, catálogo de composiciones, geometría (`resolveSpacing`, `layoutToRects`, `placePhoto`) e imposición (`impose`, `centerIndex`). Funciones puras con tests.
- `src/store/editor.ts` — estado (Zustand + Immer) con deshacer/rehacer (zundo).
- `src/lib/pdf.worker.ts` — rasteriza cada recuadro a 300 ppp y monta las hojas con pdf-lib; marcas de corte y sangrado opcionales.
- `src/components/` — editor, bandeja, tira de dobles, inspector, hojeo y exportación.

