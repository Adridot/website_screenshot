import express from 'express';
import puppeteer from 'puppeteer-core';
import dns from 'dns';
import net from 'net';

const app = express();
app.use(express.json());

// --- Garde SSRF (audit A1) ------------------------------------------------
// Bloque les cibles internes : loopback, RFC1918, link-local (169.254.169.254
// = métadonnée cloud), CGNAT, ULA/link-local IPv6, et IPv4 mappées IPv6.
function isBlockedIp(ip) {
  if (!ip) return true;
  if (ip.startsWith('::ffff:')) ip = ip.slice(7); // IPv4-mapped IPv6
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 127 || a === 10 || a === 0) return true;             // loopback / RFC1918 / "this host"
    if (a === 172 && b >= 16 && b <= 31) return true;              // RFC1918
    if (a === 192 && b === 168) return true;                       // RFC1918
    if (a === 169 && b === 254) return true;                       // link-local + métadonnée cloud
    if (a === 100 && b >= 64 && b <= 127) return true;             // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;                    // loopback / unspecified
    if (v.startsWith('fc') || v.startsWith('fd')) return true;     // ULA fc00::/7
    if (v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb')) return true; // link-local fe80::/10
    return false;
  }
  return true; // format inconnu -> on bloque
}

// Résout un hôte et renvoie true si TOUTES/une des résolutions sont internes.
async function hostIsBlocked(hostname) {
  if (net.isIP(hostname)) return isBlockedIp(hostname);
  let addrs;
  try {
    addrs = await dns.promises.lookup(hostname, { all: true });
  } catch {
    return true; // non résolvable -> on bloque
  }
  return addrs.length === 0 || addrs.some(a => isBlockedIp(a.address));
}

function parseAndCheckScheme(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  return u;
}
// -------------------------------------------------------------------------

app.get('/capture', async (req, res) => {
  const { url, elementSelector } = req.query;

  // Auth optionnelle : n'est exigée QUE si SCREENSHOT_TOKEN est défini (n'impacte
  // pas les appelants existants tant que la variable n'est pas configurée).
  const expected = process.env.SCREENSHOT_TOKEN;
  if (expected && req.get('x-screenshot-token') !== expected) {
    return res.status(401).send('Unauthorized');
  }

  if (!url) return res.status(400).send('URL is required');

  const target = parseAndCheckScheme(url);
  if (!target) return res.status(400).send('Invalid or unsupported URL');
  if (await hostIsBlocked(target.hostname)) {
    console.error(`Blocked SSRF attempt to ${target.hostname}`);
    return res.status(403).send('Forbidden target');
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Interception : revalide CHAQUE requête (redirections + sous-ressources)
    // pour empêcher un rebond vers une cible interne.
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      try {
        const ru = new URL(request.url());
        if (ru.protocol !== 'http:' && ru.protocol !== 'https:') return request.abort();
        if (await hostIsBlocked(ru.hostname)) return request.abort();
        return request.continue();
      } catch {
        return request.abort();
      }
    });

    await page.emulateTimezone('Europe/Paris');
    await page.goto(url, { timeout: 30000 });
    const element = await page.$(elementSelector);
    if (!element) {
      console.error(`Element not found with selector ${elementSelector}`);
      return res.status(500).send('Element not found');
    }
    const screenshot = await element.screenshot();
    await browser.close();
    browser = null;

    // On renvoie le buffer directement. L'ancien code ecrivait TOUTES les captures
    // dans le meme fichier `screenshot.png` avant de le renvoyer : deux requetes
    // simultanees (le portail devis en declenche justement deux) s'ecrasaient
    // mutuellement et pouvaient repartir avec l'image de l'autre.
    //
    // Cache franc : la capture depend entierement de l'URL demandee (les donnees
    // du devis sont dans ses parametres, une modification change l'URL donc la
    // cle de cache). Seule l'horloge du telephone est volatile, personne ne la
    // relit. Sans ce header, chaque affichage de devis relancait un Chromium
    // (~1,4 s par image, deux images par page).
    res.set('Cache-Control', 'public, max-age=86400');
    res.type('png').send(screenshot);
  } catch (error) {
    console.error(`Error capturing screenshot: ${error}`);
    res.status(500).send('Error capturing screenshot');
  } finally {
    if (browser) { try { await browser.close(); } catch {} }
  }
});

// Audit A1 : exposition restreinte à la loopback de l'HÔTE via le mapping Docker
// (compose: 127.0.0.1:3001:3001). Dans le conteneur on écoute 0.0.0.0, sinon le
// port-forward Docker (vers eth0) ne peut pas joindre la loopback du conteneur.
const PORT = process.env.PORT || 3001;
const HOST = process.env.BIND_HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server is running on ${HOST}:${PORT}`);
});
