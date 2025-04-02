// server.js
require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const HA_BASE_URL = process.env.HA_BASE_URL || 'http://192.168.1.100:8123';
const HA_USER = process.env.HA_USER || 'MonUtilisateur';
const HA_PASS = process.env.HA_PASS || 'MonMotDePasse';
const HA_PATH = process.env.HA_PATH || '/map/0';

const OUTPUT_DIR = './output';
const SCREENSHOT_PNG = path.join(OUTPUT_DIR, 'screenshot.png');
const SCREENSHOT_PROCESSED = path.join(OUTPUT_DIR, 'processed.png');
const SCREENSHOT_BMP = path.join(OUTPUT_DIR, 'screenshot.bmp');

const app = express();
const PORT = process.env.PORT || 3000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot() {
  console.log('[CAPTURE] Puppeteer screenshot...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 480 });

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
  await page.screenshot({ path: SCREENSHOT_PNG });
  await browser.close();

  // Process image: resize to 800x480, grayscale, dithering (Floyd-Steinberg), save BMP 1-bit
  console.log('[CONVERT] Processing BMP image...');
  await sharp(SCREENSHOT_PNG)
    .resize(800, 480)
    .grayscale()
    .threshold(128) // Converts to black/white
    .toFile(SCREENSHOT_PROCESSED);

  exec(`convert ${SCREENSHOT_PROCESSED} -type bilevel BMP3:${SCREENSHOT_BMP}`, (err) => {
    if (err) {
      console.error(`❌ BMP conversion failed: ${err.message}`);
    } else {
      console.log(`✅ BMP ready: ${SCREENSHOT_BMP}`);
    }
  });
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

takeScreenshot();
setInterval(() => takeScreenshot(), 5 * 60 * 1000);

app.use(express.static(OUTPUT_DIR));

app.get('/image.bmp', (req, res) => {
  res.sendFile(path.resolve(SCREENSHOT_BMP));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur actif sur http://localhost:${PORT}`);
});
