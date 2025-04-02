require('dotenv').config();
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const { exec } = require('child_process');

// Variables lues dans .env
const HA_BASE_URL = process.env.HA_BASE_URL || 'http://192.168.1.100:8123';
const HA_USER = process.env.HA_USER || 'MonUtilisateur';
const HA_PASS = process.env.HA_PASS || 'MonMotDePasse';
const HA_PATH = process.env.HA_PATH || '/map/0'; // Chemin du dashboard

// Fichiers de sortie
const outputPng = 'screenshot.png';
const outputProcessedPng = 'processed.png';
const outputBmp = 'screenshot.bmp';

// Petite fonction pour une pause
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  console.log(`▶️ Lancement de Puppeteer...`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  // Taille adaptée à ton écran e-paper, par exemple
  await page.setViewport({ width: 1400, height: 1200 });

  // 1) Va sur l'adresse de Home Assistant (page de login)
  console.log(`🔄 Accès à ${HA_BASE_URL}...`);
  await page.goto(HA_BASE_URL, { waitUntil: 'domcontentloaded' });

  // 2) Renseigne le champ "username"
  console.log(`✏️ Saisie du nom d'utilisateur...`);
  await page.waitForSelector('input[name="username"]', { timeout: 20000 });
  await page.type('input[name="username"]', HA_USER);

  // 3) Renseigne le champ "password"
  console.log(`🔑 Saisie du mot de passe...`);
  await page.waitForSelector('input[name="password"]', { timeout: 20000 });
  await page.type('input[name="password"]', HA_PASS);

  // 4) Clique sur "Se connecter"
  //    Dans ton HTML, le bouton est <mwc-button raised="">Se connecter</mwc-button>
  //    On va le cibler par [raised]
  console.log(`➡️ Clique sur "Se connecter"...`);
  await page.waitForSelector('mwc-button[raised]', { timeout: 20000 });
  await page.click('mwc-button[raised]');

  // 5) On laisse le temps à HA de charger/appliquer la session
  await delay(5000);

  // 6) Aller vers la page finale (dashboard, map, etc.)
  const fullUrl = `${HA_BASE_URL}${HA_PATH}`;
  console.log(`🚀 Navigation vers ${fullUrl}...`);
  await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  // 7) Capture de la page
  console.log('📸 Capture du dashboard...');
  await page.screenshot({ path: outputPng });

  // Ferme le navigateur
  await browser.close();

  // 8) Conversion en niveaux de gris + resize (selon ton besoin)
  console.log('🎨 Traitement de l’image...');
  await sharp(outputPng)
    .grayscale()
    .resize(1500, 1200)
    .toFile(outputProcessedPng);

  // 9) Conversion en BMP via ImageMagick
  console.log('🧙 Conversion en BMP...');
  exec(`convert ${outputProcessedPng} BMP3:${outputBmp}`, (err) => {
    if (err) {
      console.error(`❌ Échec de la conversion : ${err.message}`);
    } else {
      console.log(`✅ BMP créé : ${outputBmp}`);
    }
  });
})();