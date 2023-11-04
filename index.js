import express from 'express';
import captureWebsite from 'capture-website';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(express.json());

// Set up a route to capture a specific element from a website
app.post('/capture', async (req, res) => {
    const { url, elementSelector } = req.body;

    if (!url) {
        return res.status(400).send('URL is required');
    }

    try {
        const screenshot = await captureWebsite.buffer(url, {
            element: elementSelector
        });
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
