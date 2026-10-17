# Libritos

Editor de libritos de fotos cosidos a caballete y de fanzines de una sola hoja A4. Todo ocurre en el navegador: las fotos se guardan en IndexedDB y el PDF impuesto se genera en un Web Worker. Cada librito o fanzine se puede guardar como archivo `.librito` (ZIP con la maqueta y las fotos originales) y abrirlo en otro navegador.

Publicado en https://unoriginal02.github.io/booklets/ (cada push a `main` se publica solo).

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # imposición y geometría (Vitest)
npm run e2e -- <carpeta-fotos> <carpeta-salida> http://localhost:5173/   # punta a punta con Chrome
npm run build
```

- `src/model/` — tipos, catálogo de composiciones, geometría (`resolveSpacing`, `pageRects`, `layoutToRects`, `placePhoto`; cada página guarda su plantilla y, aparte, su tamaño —a sangre o un % de los márgenes— y su posición) e imposición (`impose`, `centerIndex`). Funciones puras con tests.
- `src/store/editor.ts` — estado (Zustand + Immer) con deshacer/rehacer (zundo).
- `src/lib/pdf.worker.ts` — rasteriza cada recuadro a 300 ppp y monta las hojas con pdf-lib; marcas de corte y sangrado opcionales.
- `src/model/zine.ts` — plegados de fanzine. Los que son dobleces sucesivos se calculan con un simulador de papel (`simulate`); el minizine se describe a mano. Tests en `zine.test.ts`, incluida la imposición clásica de 16 páginas.
- `src/lib/archive.ts` — exportar e importar `.librito`.
- `src/components/` — editor de libritos, editor de fanzines, bandeja, inspector, hojeo y exportación.

