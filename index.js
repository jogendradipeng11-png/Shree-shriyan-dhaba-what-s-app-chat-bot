const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const express = require('express');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🍛 Shree Shriyan Dhaba WhatsApp Bot is running!');
});

app.listen(PORT, () => {
  console.log(`🌐 Express web server listening on port ${PORT}`);
});

// Firebase initialization
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

// Custom Firestore Auth State Adapter for Baileys to persist login on Render
const useFirestoreAuthState = async (database) => {
  const writeData = async (data, id) => {
    try {
      await database.collection('whatsapp_sessions').doc(id).set({ data: JSON.stringify(data) });
    } catch (error) {
      console.error(`Error saving auth data for ${id}:`, error);
    }
  };

  const readData = async (id) => {
    try {
      const doc = await database.collection('whatsapp_sessions').doc(id).get();
      if (doc.exists) {
        return JSON.parse(doc.data().data);
      }
      return null;
    } catch (error) {
      console.error(`Error reading auth data for ${id}:`, error);
      return null;
    }
  };

  const creds = (await readData('creds')) || (await useMultiFileAuthState('./temp_auth')).state.creds;

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            let value = await readData(`${type}-${id}`);
            if (type === 'app-state-sync-key' && value) {
              value = Buffer.from(value);
            }
            data[id] = value;
          }
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const value = data[category][id];
              tasks.push(writeData(value, `${category}-${id}`));
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: () => {
      return writeData(state.creds, 'creds');
    }
  };
};

async function startDhabaBot() {
  if (!db) {
    console.log("❌ Database not ready, waiting for Firebase...");
    setTimeout(startDhabaBot, 5000);
    return;
  }

  const { state, saveCreds } = await useFirestoreAuthState(db);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.macOS('Desktop')
  });

  sock.ev.on('creds.update', saveCreds);

  if (!sock.authState.creds.registered) {
    const phoneNumber = process.env.WHATSAPP_NUMBER;
    if (!phoneNumber) {
      console.log("❌ ERROR: WHATSAPP_NUMBER environment variable is not set!");
      return;
    }

    setTimeout(async () => {
      try {
        let code = await sock.requestPairingCode(phoneNumber.trim());
        code = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log(`\n==================================================`);
        console.log(`🔑 YOUR PAIRING CODE IS: \x1b[32m${code}\x1b[0m`);
        console.log(`==================================================\n`);
      } catch (err) {
        console.error("Failed to request pairing code:", err);
      }
    }, 4000);
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Connection closed. Reconnecting:', shouldReconnect);
      
      if (shouldReconnect) {
        startDhabaBot();
      }
    } else if (connection === 'open') {
      console.log('✅ Shree Shriyan Dhaba Baileys Bot is ONLINE and Linked! 🍛');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    const messageType = Object.keys(m.message)[0];
    const text = (
      m.message.conversation || 
      m.message.extendedTextMessage?.text || 
      m.message.imageMessage?.caption || 
      ''
    ).toLowerCase().trim();

    const isImage = messageType === 'imageMessage';

    if (text === 'hi' || text === 'hello' || text === 'namaste' || text === 'menu') {
      await sock.sendMessage(from, {
        text: `👋 *Welcome to Shree Shriyan Dhaba!* 🍛\n\nChoose from our special menu below or send a photo of your custom order/list:\n\n1️⃣ Butter Chicken + 2 Roti - ₹180\n2️⃣ Dal Makhani + Jeera Rice - ₹150\n3️⃣ Paneer Butter Masala - ₹200\n4️⃣ Special Veg Thali - ₹220\n5️⃣ Chicken Biryani (Full) - ₹250\n6️⃣ Gulab Jamun (2 pcs) - ₹80\n\n👉 *Reply with the number to order (e.g., type "order 1") or send a photo!*`
      });
    } 
    else if (text.startsWith('order') || isImage) {
      let orderDescription = "";

      if (isImage) {
        orderDescription = `[Image Order] ${text ? 'Caption: ' + text : 'No caption provided'}`;
      } else {
        const itemNum = text.replace('order', '').trim();
        const menuItems = {
          "1": "Butter Chicken + 2 Roti (₹180)",
          "2": "Dal Makhani + Jeera Rice (₹150)",
          "3": "Paneer Butter Masala (₹200)",
          "4": "Special Veg Thali (₹220)",
          "5": "Chicken Biryani (Full) - ₹250",
          "6": "Gulab Jamun (2 pcs) - ₹80"
        };
        orderDescription = menuItems[itemNum];
      }

      if (!orderDescription && !isImage) {
        await sock.sendMessage(from, { text: `❌ Invalid choice! Please type *menu* to see valid item numbers.` });
        return;
      }

      if (db) {
        try {
          await db.collection('orders').add({
            phone: from,
            orderItem: orderDescription || "Custom Image Order",
            type: isImage ? 'image' : 'text',
            status: 'Received',
            time: new Date().toISOString()
          });
          console.log("🔥 Order saved to Firestore successfully!");
        } catch (err) {
          console.error("Error saving order to Firestore:", err);
        }
      }

      await sock.sendMessage(from, {
        text: `✅ *Order Received Successfully!*\n\n🍽️ *Details:* ${orderDescription || 'Custom Image Menu'}\n📍 *Status:* Being prepared at Shree Shriyan Dhaba.\n\nThank you for ordering with us! 🙏`
      });
    } 
    else if (text.length > 0) {
      await sock.sendMessage(from, {
        text: `🤖 Sorry, I didn't understand that.\n\nType *menu* to see our dishes, or send a photo of your order!`
      });
    }
  });
}

startDhabaBot();
