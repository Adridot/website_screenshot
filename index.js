import express from 'express';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import https from 'https';
import {fileURLToPath} from 'url';
import {dirname} from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(express.json());

// Set up a route to capture a specific element from a website
app.get('/capture', async (req, res) => {
    const {url, elementSelector} = req.query;

    console.log(`Capturing screenshot from ${url} with selector ${elementSelector}`);

    if (!url) {
        return res.status(400).send('URL is required');
    }

    try {
        const browser = await puppeteer.launch({
            executablePath: '/usr/bin/chromium', // use installed Chromium
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.emulateTimezone('Europe/Paris'); // set timezone to Paris
        await page.goto(url);
        const element = await page.$(elementSelector);
        if (!element) {
            console.error(`Element not found with selector ${elementSelector}`);
            return res.status(500).send('Element not found');
        }
        const screenshot = await element.screenshot();
        await browser.close();

        fs.writeFileSync('screenshot.png', screenshot);
        res.sendFile('screenshot.png', {root: __dirname});
    } catch (error) {
        console.error(`Error capturing screenshot: ${error}`);
        res.status(500).send('Error capturing screenshot');
    }
});

const PORT = process.env.PORT || 3001;

// SSL certificate
const privateKey = fs.readFileSync('certs/privkey1.pem', 'utf8');
const certificate = fs.readFileSync('certs/cert1.pem', 'utf8');
const ca = fs.readFileSync('certs/chain1.pem', 'utf8');

const credentials = {
    key: privateKey,
    cert: certificate,
    ca: ca
};

const httpsServer = https.createServer(credentials, app);

httpsServer.listen(PORT, () => {
    console.log(`HTTPS Server is running on port ${PORT}`);
});