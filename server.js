require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Variables d'environnement
const HA_BASE_URL = process.env.HA_BASE_URL || 'http://192.168.1.100:8123';
const HA_USER = process.env.HA_USER || 'MonUtilisateur';
const HA_PASS = process.env.HA_PASS || 'MonMotDePasse';
const HA_PATH = process.env.HA_PATH || '/map/0';

// Fichiers pour le screenshot
const OUTPUT_DIR = './output';
const SCREENSHOT_PNG = path.join(OUTPUT_DIR, 'screenshot.png');
const SCREENSHOT_PROCESSED = path.join(OUTPUT_DIR, 'processed.png');
const SCREENSHOT_BMP = path.join(OUTPUT_DIR, 'screenshot.bmp');
const SCREENSHOT_RAW = path.join(OUTPUT_DIR, 'screenshot.raw');

// Vérifie/démarre l'appli Express
const app = express();
const PORT = process.env.PORT || 3000;

// Petite fonction "pause"
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fonction qui fait la capture + conversion
async function takeScreenshot() {
  console.log('[CAPTURE] Lancement de Puppeteer pour screenshot...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 480 });

  // 1) Login
  await page.goto(HA_BASE_URL, { waitUntil: 'domcontentloaded' });

  await page.waitForSelector('input[name="username"]', { timeout: 20000 });
  await page.type('input[name="username"]', HA_USER);

  await page.waitForSelector('input[name="password"]', { timeout: 20000 });
  await page.type('input[name="password"]', HA_PASS);

  await page.waitForSelector('mwc-button[raised]', { timeout: 20000 });
  await page.click('mwc-button[raised]');
  await delay(5000);

  const finalUrl = `${HA_BASE_URL}${HA_PATH}?kiosk`;
  await page.goto(finalUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  // Screenshot PNG
  await page.screenshot({ path: SCREENSHOT_PNG });
  await browser.close();

  // Traitement avec sharp : resize, grayscale, raw output
  const rawBuffer = await sharp(SCREENSHOT_PNG)
    .resize(800, 480)
    .grayscale()
    .raw()
    .toBuffer();

  console.log('[CONVERT] Conversion en 4 niveaux de gris...');
  const grayBuffer = Buffer.alloc((800 * 480) / 2); // 2 pixels par octet (4 niveaux = 2 bits par pixel)
  for (let i = 0; i < rawBuffer.length; i += 2) {
    const p1 = Math.floor((rawBuffer[i] / 256) * 4) & 0x03;
    const p2 = Math.floor((rawBuffer[i + 1] / 256) * 4) & 0x03;
    grayBuffer[i / 2] = (p1 << 6) | (p2 << 4); // encode deux pixels (2 bits chacun)
  }

  fs.writeFileSync(SCREENSHOT_RAW, grayBuffer);
  console.log(`✅ Buffer RAW généré : ${SCREENSHOT_RAW}`);
}

// Crée le dossier output si besoin
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

// 1ere capture au démarrage
takeScreenshot();

// Puis capture toutes les 5 minutes
setInterval(() => {
  takeScreenshot();
}, 5 * 60 * 1000); // 5 minutes

// On sert le dossier output en statique
app.use(express.static(OUTPUT_DIR));

// Ex : l'ESP peut appeler http://ADRESSE_MACHINE:3000/screenshot.bmp
// On peut aussi faire un endpoint direct :
app.get('/image', (req, res) => {
  res.sendFile(path.resolve(SCREENSHOT_BMP));
});

app.get('/image.raw', (req, res) => {
  res.sendFile(path.resolve(SCREENSHOT_RAW));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});
