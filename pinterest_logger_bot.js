// index.js
const { Client, GatewayIntentBits } = require('discord.js');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');

// Railway ortam değişkeninden token al
const BOT_TOKEN = process.env.TOKEN;
if (!BOT_TOKEN) throw new Error("Bot tokeni bulunamadı! Railway ortam değişkenini kontrol et.");

const CHANNEL_ID = "1431017351272333424";   // Discord kanal ID
const CHECK_INTERVAL = 60 * 1000;           // 1 dakika aralıkla kontrol
const USERS_FILE = './users.json';          // Kullanıcıları kaydedeceğimiz dosya

// Başlangıçta users.json varsa oku, yoksa boş liste oluştur
let USERS = [];
if (fs.existsSync(USERS_FILE)) {
    USERS = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
} else {
    USERS = ["ankaxrd"]; // default kullanıcı
    fs.writeFileSync(USERS_FILE, JSON.stringify(USERS, null, 2));
}

// Gönderilen pinleri kullanıcı bazlı tut
let sentPins = {};
USERS.forEach(u => sentPins[u] = new Set());

// Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Kullanıcı ekleme / silme fonksiyonları
function addUser(username) {
    if (!USERS.includes(username)) {
        USERS.push(username);
        sentPins[username] = new Set();
        fs.writeFileSync(USERS_FILE, JSON.stringify(USERS, null, 2));
        return true;
    }
    return false;
}

function removeUser(username) {
    if (USERS.includes(username)) {
        USERS = USERS.filter(u => u !== username);
        delete sentPins[username];
        fs.writeFileSync(USERS_FILE, JSON.stringify(USERS, null, 2));
        return true;
    }
    return false;
}

// Pinterest'ten en son pin
async function getLatestPin(username) {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.goto(`https://www.pinterest.com/${username}/_created/`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('div[data-test-id="pin"] img', { timeout: 15000 });

        const pins = await page.$$eval('div[data-test-id="pin"] img', imgs => {
            for (const i of imgs) {
                if (i.src) return [i.src]; // sadece ilk pin
            }
            return [];
        });

        if (pins.length === 0) return null;
        return pins[0];
    } catch (err) {
        console.error("Pinterest pin çekme hatası:", err);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}

// Pinleri kontrol et ve gönder
async function checkPins() {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);

        for (const user of USERS) {
            const pinURL = await getLatestPin(user);
            if




