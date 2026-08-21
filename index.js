const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
require('dotenv').config();

// Keep bot alive heartbeat log every 5 minutes
setInterval(() => {
  console.log(`[${new Date().toLocaleString()}] Shree Shriyan Dhaba Bot is alive 🍛`);
}, 300000);

// Firebase initialization (Supports local file or Render Environment Variable)
let db;
try {
  let serviceAccount;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // If running on Render, parse the JSON string from the environment variable
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // If running locally, fall back to the local file
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

// Puppeteer configuration optimized for cloud environments (Render / Docker)
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

client.on('qr', (qr) => {
  console.log('\n🔥 Scan this QR code with WhatsApp (Linked Devices):');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('\n✅ Shree Shriyan Dhaba WhatsApp Bot is ONLINE and Ready! 🍛');
});

// Handle incoming messages
client.on('message', async (msg) => {
  const text = msg.body.toLowerCase().trim();
  const from = msg.from;

  if (text === 'hi' || text === 'hello' || text === 'namaste' || text === 'menu') {
    await msg.reply(`👋 *Welcome to Shree Shriyan Dhaba!* 🍛\n\nChoose from our special menu below:\n\n1️⃣ Butter Chicken + 2 Roti - ₹180\n2️⃣ Dal Makhani + Jeera Rice - ₹150\n3️⃣ Paneer Butter Masala - ₹200\n4️⃣ Special Veg Thali - ₹220\n5️⃣ Chicken Biryani (Full) - ₹250\n6️⃣ Gulab Jamun (2 pcs) - ₹80\n\n👉 *Reply with the number to order (e.g., type "order 1")*`);
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
      await msg.reply(`❌ Invalid choice! Please type *menu* to see valid item numbers.`);
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

    await msg.reply(`✅ *Order Received Successfully!*\n\n🍽️ *Item:* ${selectedItem}\n📍 *Status:* Being prepared at Shree Shriyan Dhaba.\n\nThank you for ordering with us! 🙏`);
  } 
  else {
    await msg.reply(`🤖 Sorry, I didn't understand that.\n\nType *menu* to see our dishes or *hi* to restart.`);
  }
});

client.initialize();
