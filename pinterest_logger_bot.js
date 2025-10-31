const { Client, GatewayIntentBits } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');

const CHANNEL_ID = "1431017351272333424";   // Discord kanal ID
const CHECK_INTERVAL = 10 * 1000;           // 10 saniye aralıkla kontrol
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
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
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

// ✅ Pinterest'ten en son pin alma fonksiyonu (DÜZGÜN HALİ)
async function getLatestPin(username) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    try {
        await page.goto(`https://www.pinterest.com/${username}/_created/`, { waitUntil: 'networkidle2' });

        const pins = await page.$$eval('div[data-test-id="pin"] img', imgs => {
            const seen = new Set();
            for (const i of imgs) {
                if (!seen.has(i.src)) {
                    seen.add(i.src);
                    return [i.src]; // sadece ilk benzersiz pin
                }
            }
            return [];
        });

        await browser.close();

        if (pins.length === 0) return null;
        return pins[0];

    } catch (err) {
        console.error("Pinterest pin çekme hatası:", err);
        await browser.close();
        return null;
    }
}

// ✅ Pinleri kontrol et ve gönder
async function checkPins() {
    const channel = await client.channels.fetch(CHANNEL_ID);

    for (const user of USERS) {
        const pinURL = await getLatestPin(user);
        if (!pinURL) continue;

        if (!sentPins[user]) sentPins[user] = new Set();
        if (sentPins[user].has(pinURL)) continue;

        sentPins[user].add(pinURL);

        try {
            await channel.send({ content: `Yeni pin: ${user}`, files: [pinURL] });
            console.log(`Pin gönderildi: ${pinURL}`);
        } catch (err) {
            console.error("Pin gönderme hatası:", err);
        }
    }
}

// ✅ Komutlar
client.on('messageCreate', message => {
    if (!message.content.startsWith('!') || message.author.bot) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'adduser') {
        const newUser = args[0];
        if (!newUser) return message.reply('Kullanıcı adı belirtmelisin!');
        if (addUser(newUser)) {
            message.reply(`Kullanıcı eklendi: ${newUser}`);
        } else {
            message.reply('Bu kullanıcı zaten listede.');
        }
    }

    if (command === 'removeuser') {
        const removeUserName = args[0];
        if (!removeUserName) return message.reply('Kullanıcı adı belirtmelisin!');
        if (removeUser(removeUserName)) {
            message.reply(`Kullanıcı kaldırıldı: ${removeUserName}`);
        } else {
            message.reply('Bu kullanıcı listede yok.');
        }
    }

    if (command === 'listusers') {
        message.reply(`Mevcut kullanıcılar: ${USERS.join(', ')}`);
    }
});

// ✅ Botu başlat
client.once('ready', () => {
    console.log(`Bot hazır: ${client.user.tag}`);
    checkPins();
    setInterval(checkPins, CHECK_INTERVAL);
});

// ✅ Login
client.login(process.env.TOKEN);



