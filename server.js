const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
require('dotenv').config();

// Keep bot alive log
setInterval(() => {
  console.log(`[${new Date().toLocaleString()}] Dhaba Bot is alive`);
}, 300000); // every 5 minutes

// Firebase setup (use serviceAccountKey.json locally or secret in Render)
let db;
try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log("Firebase connected");
} catch (e) {
  console.log("Firebase not loaded yet (will work if using secret)");
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' })
});

client.on('qr', (qr) => {
  console.log('\n🔥 Scan this QR code with WhatsApp (Linked Devices):');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('\n✅ Dhaba WhatsApp Bot is ONLINE and Ready! 🍛');
});

client.on('message', async (msg) => {
  const text = msg.body.toLowerCase().trim();
  const from = msg.from;

  if (text === 'hi' || text === 'hello' || text === 'namaste') {
    msg.reply(`👋 *Welcome to Dhaba!*\n\nType *menu* to see today's delicious menu 🍛`);
  } 
  else if (text === 'menu') {
    msg.reply(`🍛 *Dhaba Special Menu Today*

1. Butter Chicken + 2 Roti     - ₹180
2. Dal Makhani + Jeera Rice    - ₹150
3. Paneer Butter Masala        - ₹200
4. Special Veg Thali           - ₹220
5. Chicken Biryani (Full)      - ₹250
6. Gulab Jamun (2 pcs)         - ₹80

Reply like: *order 1* or *order 3*`);
  } 
  else if (text.startsWith('order')) {
    const item = text.replace('order', '').trim() || "Unknown";
    if (db) {
      await db.collection('orders').add({
        phone: from,
        item: item,
        status: 'Received',
        time: new Date().toISOString()
      });
    }
    msg.reply(`✅ *Order Received!*\nItem: ${item}\nYour order is being prepared at Dhaba.\nThank you! 🙏`);
  } 
  else {
    msg.reply(`Sorry, I didn't understand.\n\nType *hi* or *menu* to start.`);
  }
});

client.initialize();
