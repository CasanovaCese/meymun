const puppeteer = require("puppeteer-core");
const { Client, GatewayIntentBits } = require("discord.js");
const chromium = require("@sparticuz/chromium");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CHANNEL_ID = "1431017351272333424";
const USERS = ["pinterest_username1", "pinterest_username2"];
const sentPins = {};

async function getLatestPin(username) {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();

        // Timeout’u artırdık (30sn → 60sn)
        await page.goto(`https://www.pinterest.com/${username}/`, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
        });

        // Sayfanın yüklendiğinden emin ol
        await page.waitForSelector('img', { timeout: 15000 });

        const pinURL = await page.evaluate(() => {
            const img = document.querySelector('img');
            return img ? img.src : null;
        });

        return pinURL || null;
    } catch (err) {
        console.error("Pinterest pin çekme hatası:", err);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}

async function checkPins() {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        for (const user of USERS) {
            const pinURL = await getLatestPin(user);
            if (!pinURL) continue;

            if (!sentPins[user]) sentPins[user] = new Set();
            if (sentPins[user].has(pinURL)) continue;

            sentPins[user].add(pinURL);

            await channel.send({ content: `🖼️ Yeni pin geldi: **${user}**`, files: [pinURL] });
            console.log(`✅ Pin gönderildi: ${pinURL}`);
        }
    } catch (err) {
        console.error("checkPins hatası:", err);
    }
}

// Bot hazır olduğunda başlat
client.once("clientReady", () => {
    console.log(`Bot aktif: ${client.user.tag}`);
    setInterval(checkPins, 5 * 60 * 1000); // her 5 dakikada bir kontrol
});

// Railway için keep-alive
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Pinterest Logger Bot Çalışıyor ✅"));
app.listen(3000, () => console.log("Keep-alive aktif!"));

client.login("BOT_TOKENİNİ_YAZ");



