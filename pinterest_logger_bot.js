const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch'); // HTTP istekleri için
const express = require('express');  // Keep-alive için
const fs = require('fs');

const BOT_TOKEN = process.env.TOKEN;
if (!BOT_TOKEN) throw new Error("Bot tokeni bulunamadı! Railway ortam değişkenini kontrol et.");

const CHANNEL_ID = "1431017351272333424";
const CHECK_INTERVAL = 60 * 1000; // 1 dakika
const USERS_FILE = './users.json';

// Kullanıcı listesi
let USERS = [];
if (fs.existsSync(USERS_FILE)) {
    USERS = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
} else {
    USERS = ["ankaxrd"];
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
        GatewayIntentBits.MessageContent
    ]
});

// Kullanıcı ekleme / silme
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

// Pinterest'ten en son pin (JSON API ile)
async function getLatestPin(username) {
    try {
        const res = await fetch(`https://api.pinterest.com/v3/pidgets/users/${username}/pins/`);
        const data = await res.json();
        if (!data || !data.data || !data.data.pins || data.data.pins.length === 0) return null;
        return data.data.pins[0].images.orig.url;
    } catch (err) {
        console.error("Pinterest pin çekme hatası:", err);
        return null;
    }
}

// Pinleri kontrol et ve gönder
async function checkPins() {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        for (const user of USERS) {
            const pinURL = await getLatestPin(user);
            if (!pinURL) continue;

            if (!sentPins[user]) sentPins[user] = new Set();
            if (sentPins[user].has(pinURL)) continue;

            sentPins[user].add(pinURL);
            await channel.send({ content: `Yeni pin: ${user}`, files: [pinURL] });
            console.log(`Pin gönderildi: ${pinURL}`);
        }
    } catch (err) {
        console.error("checkPins hatası:", err);
    }
}

// Komutlar
client.on('messageCreate', message => {
    if (!message.content.startsWith('!') || message.author.bot) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'adduser') {
        const newUser = args[0];
        if (!newUser) return message.reply('Kullanıcı adı belirtmelisin!');
        if (addUser(newUser)) message.reply(`Kullanıcı eklendi: ${newUser}`);
        else message.reply('Bu kullanıcı zaten listede.');
    }

    if (command === 'removeuser') {
        const removeUserName = args[0];
        if (!removeUserName) return message.reply('Kullanıcı adı belirtmelisin!');
        if (removeUser(removeUserName)) message.reply(`Kullanıcı kaldırıldı: ${removeUserName}`);
        else message.reply('Bu kullanıcı listede yok.');
    }

    if (command === 'listusers') {
        message.reply(`Mevcut kullanıcılar: ${USERS.join(', ')}`);
    }
});

// Bot hazır
client.once('ready', () => {
    console.log(`Bot hazır: ${client.user.tag}`);
    checkPins();
    setInterval(checkPins, CHECK_INTERVAL);
});

// Discord login
client.login(BOT_TOKEN);

// Keep-alive için express
const app = express();
app.get("/", (req, res) => res.send("Pinterest Bot Çalışıyor ✅"));
app.listen(3000, () => console.log("Keep-alive aktif!"));


