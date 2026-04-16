const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
require('dotenv').config();

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const client = new Client({
  authStrategy: new LocalAuth()
});

client.on('qr', qr => {
  console.log('Scan this QR with WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ Dhaba WhatsApp Bot is Online!');
});

client.on('message', async msg => {
  const text = msg.body.toLowerCase().trim();

  if (text === 'hi' || text === 'hello' || text === 'namaste') {
    msg.reply(`👋 *Welcome to Dhaba Bot!*\n\nType *menu* to see today's special menu 🍛`);
  } 
  else if (text === 'menu') {
    msg.reply(`🍛 *Dhaba Special Menu Today*

1. Butter Chicken + 2 Roti - ₹180
2. Dal Makhani + Rice - ₹150
3. Paneer Butter Masala - ₹200
4. Special Veg Thali - ₹220
5. Chicken Biryani - ₹250

Reply with: *order 1*  (example)`);
  } 
  else if (text.startsWith('order')) {
    const item = text.replace('order', '').trim();
    await db.collection('orders').add({
      phone: msg.from,
      item: item,
      status: 'Received',
      time: new Date().toISOString()
    });
    msg.reply(`✅ *Order Received!*\nYour order for item ${item} is being prepared.\n\nThank you for ordering from Dhaba! 🙏`);
  } 
  else {
    msg.reply('Sorry, I did not understand.\nType *menu* to see menu or *hi* to start.');
  }
});

client.initialize();
