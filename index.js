import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(express.json());

// Set up a route to capture a specific element from a website
app.get('/capture', async (req, res) => {
    const { url, elementSelector } = req.query;

    if (!url) {
        return res.status(400).send('URL is required');
    }

    try {
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.goto(url);
        const element = await page.$(elementSelector);
        const screenshot = await element.screenshot();
        await browser.close();

        fs.writeFileSync('screenshot.png', screenshot);
        res.sendFile('screenshot.png', { root: __dirname });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error capturing screenshot');
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});