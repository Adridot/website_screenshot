app.get('/capture', async (req, res) => {
    const { url, elementSelector } = req.query;

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
        await page.goto(url);
        const element = await page.$(elementSelector);
        if (!element) {
            console.error(`Element not found with selector ${elementSelector}`);
            return res.status(500).send('Element not found');
        }
        const screenshot = await element.screenshot();
        await browser.close();

        fs.writeFileSync('screenshot.png', screenshot);
        res.sendFile('screenshot.png', { root: __dirname });
    } catch (error) {
        console.error(`Error capturing screenshot: ${error}`);
        res.status(500).send('Error capturing screenshot');
    }
});