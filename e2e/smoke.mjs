// Prueba de punta a punta: crea un librito A6, coloca fotos, exporta el PDF con marcas.
// Uso: node e2e/smoke.mjs <carpeta-de-fotos> <carpeta-de-salida> [url]
import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const [photosDir, outDir, url = 'http://localhost:5199/'] = process.argv.slice(2);
const files = readdirSync(photosDir).map((f) => join(photosDir, f));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const shot = (name) => page.screenshot({ path: join(outDir, `${name}.png`) });

/** dnd-kit con MouseSensor: pulsar, moverse unos px, ir al destino y soltar */
async function drag(from, to) {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

const tray = (name) => page.locator(`[title^="${name}"]`).first();
const frames = () => page.locator('main .group.absolute');

await page.goto(url);
await page.getByPlaceholder('Verano en la costa').fill('Prueba A6');
await page.getByRole('button', { name: 'Crear' }).click();
await page.locator('input[type=file]').setInputFiles(files);
await page.waitForFunction((n) => document.querySelectorAll('aside img').length >= n, files.length, { timeout: 30000 });

// portada
await drag(tray('playa.jpg'), frames().first());
await shot('01-cubierta');

// tres dobles: la central es la 2
await page.getByTitle('Añadir una doble después de la seleccionada').click();
await page.getByTitle('Añadir una doble después de la seleccionada').click();
await shot('02-dos-dobles-anadidas');

const stripItems = page.locator('.border-t button:has(> div.rounded-sm)');
await stripItems.nth(1).click(); // doble 1
await page.locator('aside').getByRole('button', { name: 'Rejilla 2×2' }).click().catch(() => {});
await page.getByTitle('Rejilla 2×2').click();
const f = frames();
await drag(tray('paisaje.jpg'), f.nth(0));
await drag(tray('retrato.jpg'), f.nth(1));
await drag(tray('pequena.jpg'), f.nth(2));
await shot('03-doble1');

// encuadrar: arrastrar dentro del recuadro
const box = await f.nth(1).boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 8 });
await page.mouse.up();

// la central (doble 3 en la tira = índice 2... la tira es Cubierta, 1, 2, 3)
const order = await stripItems.allInnerTexts();
console.log('tira:', order.map((t) => t.replace(/\s+/g, ' ')));
await stripItems.nth(2).click();
await page.getByRole('button', { name: 'Doble página' }).click();
await drag(tray('pano.jpg'), frames().first());
await shot('04-central-pano');

// añadir otra doble deja la pano fuera de la central
await page.getByTitle('Añadir una doble después de la seleccionada').click();
await shot('05-falta-doble');
await page.keyboard.press('Control+z');
await page.waitForTimeout(500);
await shot('06-deshacer');
const afterUndo = await stripItems.count();
if (afterUndo !== 4) throw new Error(`Deshacer debía quitar solo la doble añadida; quedan ${afterUndo} miniaturas`);

// exportar con marcas de corte
await page.getByRole('button', { name: 'Exportar PDF' }).click();
await shot('07-export');
const dlP = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
await page.getByRole('button', { name: 'Descargar PDF' }).click();
await page.waitForTimeout(3000);
await shot('07b-export-progreso');
const dl = await dlP;
if (!dl) {
  await shot('07c-export-fallo');
  console.log('errores:', errors);
  process.exit(1);
}
await dl.saveAs(join(outDir, 'librito.pdf'));
const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Hoja de prueba' }).click()]);
await dl2.saveAs(join(outDir, 'prueba.pdf'));
await page.getByRole('button', { name: 'Cerrar' }).click();

// recargar: se conserva
await page.reload();
await page.waitForTimeout(1500);
await shot('08-recargado');
await page.getByRole('button', { name: 'Hojear' }).click();
await shot('09-hojear');

console.log('errores:', errors);
await browser.close();
