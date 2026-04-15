require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');
const db = require('./firebase-config');
const app = express();
app.use(express.static('public')); // admin panel files
app.use(express.json());

const PORT = process.env.PORT || 3000;

// WhatsApp Client (Multi-device, QR once only)
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }), // session save होता है
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => {
  console.log('Scan this QR with WhatsApp → Linked Devices');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('🚀 GOAT WhatsApp Bot is READY!');
});

// Message Handler (Dhaba Specific)
client.on('message', async message => {
  const text = message.body.toLowerCase().trim();
  const from = message.from;

  if (text === 'menu' || text === 'मेनू') {
    const menuSnap = await db.ref('menu').once('value');
    let reply = '🍛 *Shree & Shriyan Dhaba Menu*\n\n';
    Object.values(menuSnap.val() || {}).forEach(item => {
      reply += `• ${item.name_en} - ₹${item.price}\n`;
    });
    reply += '\nReply: ORDER Dal Tadka 2';
    message.reply(reply);
  }

  else if (text.startsWith('order ')) {
    // Simple order processing (expand as needed)
    const orderId = Date.now();
    const orderData = {
      id: orderId,
      customer: from,
      name: "WhatsApp Guest",
      table: "WhatsApp",
      items: [{ name_en: text.replace('order ', ''), qty: 1, price: 150 }],
      total: 150,
      timestamp: new Date().toLocaleString(),
      status: "pending",
      type: "whatsapp_order"
    };
    await db.ref('tableOrders/' + orderId).set(orderData);
    message.reply(`✅ Order Placed! ID: ${orderId}\nKitchen notified. Staff will come.`);
  }

  else if (text === 'cash' || text === 'कैश') {
    message.reply('💵 Cash request sent to staff. Please wait.');
    // Same cash_notification as your existing POS
    const cashData = { /* same as your notifyCashPaymentToStaff */ };
    await db.ref('tableOrders/' + Date.now()).set(cashData);
  }
});

// ==================== ADMIN PANEL ====================
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});

// Live orders API for admin panel
app.get('/api/orders', async (req, res) => {
  const snap = await db.ref('tableOrders').once('value');
  res.json(snap.val() || {});
});

client.initialize();

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
