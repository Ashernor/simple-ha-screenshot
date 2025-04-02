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
  await page.setViewport({ width: 1000, height: 950 });

  // 1) Login
  await page.goto(HA_BASE_URL, { waitUntil: 'domcontentloaded' });

  // Champ username
  await page.waitForSelector('input[name="username"]', { timeout: 20000 });
  await page.type('input[name="username"]', HA_USER);

  // Champ password
  await page.waitForSelector('input[name="password"]', { timeout: 20000 });
  await page.type('input[name="password"]', HA_PASS);

  // Bouton "Se connecter"
  await page.waitForSelector('mwc-button[raised]', { timeout: 20000 });
  await page.click('mwc-button[raised]');

  // On attend un peu que la session soit prise en compte
  await delay(5000);

  // 2) Aller sur la page voulue
  const finalUrl = `${HA_BASE_URL}${HA_PATH}?kiosk`;
  await page.goto(finalUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  // 3) Screenshot en PNG
  await page.screenshot({ path: SCREENSHOT_PNG });
  await browser.close();

  // 4) Grayscale + resize
  await sharp(SCREENSHOT_PNG)
    .grayscale()
    .resize(1000, 950)
    .toFile(SCREENSHOT_PROCESSED);

  // 5) Convertir en BMP
  exec(`convert ${SCREENSHOT_PROCESSED} BMP3:${SCREENSHOT_BMP}`, (err) => {
    if (err) {
      console.error(`❌ Échec de la conversion : ${err.message}`);
    } else {
      console.log(`✅ Screenshot BMP créé : ${SCREENSHOT_BMP} // http://localhost:${PORT}/screenshot.bmp`);
    }
  });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});
