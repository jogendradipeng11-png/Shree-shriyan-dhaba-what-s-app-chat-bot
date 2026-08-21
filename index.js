const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const express = require('express');
const admin = require('firebase-admin');
require('dotenv').config();

// 1. Create a minimal Express server so Render detects an open port and stays alive
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🍛 Shree Shriyan Dhaba WhatsApp Bot is running!');
});

app.listen(PORT, () => {
  console.log(`🌐 Express web server listening on port ${PORT}`);
});

// 2. Firebase initialization
let db;
try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    serviceAccount = require('./serviceAccountKey.json');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log("🔥 Firebase connected successfully!");
} catch (e) {
  console.log("⚠️ Firebase initialization error:", e.message);
}

// 3. Start WhatsApp Bot using Baileys
async function startDhabaBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }), // Suppress noisy logs
  });

  sock.ev.on('creds.update', saveCreds);

  // Manually handle and display the QR code in Render terminal logs
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('\n🔥 Scan this QR code with WhatsApp (Linked Devices):');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Connection closed. Reconnecting:', shouldReconnect);
      
      if (shouldReconnect) {
        startDhabaBot();
      }
    } else if (connection === 'open') {
      console.log('✅ Shree Shriyan Dhaba Baileys Bot is ONLINE and Ready! 🍛');
    }
  });

  // Handle Incoming Messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').toLowerCase().trim();

    if (text === 'hi' || text === 'hello' || text === 'namaste' || text === 'menu') {
      await sock.sendMessage(from, {
        text: `👋 *Welcome to Shree Shriyan Dhaba!* 🍛\n\nChoose from our special menu below:\n\n1️⃣ Butter Chicken + 2 Roti - ₹180\n2️⃣ Dal Makhani + Jeera Rice - ₹150\n3️⃣ Paneer Butter Masala - ₹200\n4️⃣ Special Veg Thali - ₹220\n5️⃣ Chicken Biryani (Full) - ₹250\n6️⃣ Gulab Jamun (2 pcs) - ₹80\n\n👉 *Reply with the number to order (e.g., type "order 1")*`
      });
    } 
    else if (text.startsWith('order')) {
      const itemNum = text.replace('order', '').trim();
      
      const menuItems = {
        "1": "Butter Chicken + 2 Roti (₹180)",
        "2": "Dal Makhani + Jeera Rice (₹150)",
        "3": "Paneer Butter Masala (₹200)",
        "4": "Special Veg Thali (₹220)",
        "5": "Chicken Biryani (Full) - ₹250",
        "6": "Gulab Jamun (2 pcs) - ₹80"
      };

      const selectedItem = menuItems[itemNum];

      if (!selectedItem) {
        await sock.sendMessage(from, { text: `❌ Invalid choice! Please type *menu* to see valid item numbers.` });
        return;
      }

      // Save Order to Firebase Firestore
      if (db) {
        try {
          await db.collection('orders').add({
            phone: from,
            item: selectedItem,
            status: 'Received',
            time: new Date().toISOString()
          });
        } catch (err) {
          console.error("Error saving order to Firestore:", err);
        }
      }

      await sock.sendMessage(from, {
        text: `✅ *Order Received Successfully!*\n\n🍽️ *Item:* ${selectedItem}\n📍 *Status:* Being prepared at Shree Shriyan Dhaba.\n\nThank you for ordering with us! 🙏`
      });
    } 
    else if (text.length > 0) {
      await sock.sendMessage(from, {
        text: `🤖 Sorry, I didn't understand that.\n\nType *menu* to see our dishes or *hi* to restart.`
      });
    }
  });
}

startDhabaBot();
