// ====================== Shree & Shriyan Dhaba - GOAT WhatsApp Bot (Final Stable) ======================
require('dotenv').config();
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
const path = require('path');

const app = express();
app.use(express.static('public'));
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ====================== FIREBASE ======================
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
  databaseURL: "https://dhaba-bills-default-rtdb.firebaseio.com"
});

const db = admin.database();

// ====================== WHATSAPP CLIENT ======================
const client = new Client({
  authStrategy: new LocalAuth({ 
    dataPath: './.wwebjs_auth' 
  }),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
    timeout: 0
  }
});

client.on('qr', (qr) => {
  console.log('\n\n🔥 === SCAN THIS QR CODE TO CONNECT WHATSAPP ===');
  console.log('1. Open WhatsApp on your phone');
  console.log('2. Go to Settings > Linked Devices');
  console.log('3. Tap "Link a Device"');
  console.log('4. Scan the QR code below\n');
  qrcode.generate(qr, { small: true });
  console.log('\n==================================================\n');
});

client.on('ready', () => {
  console.log('🚀 GOAT WhatsApp Bot is LIVE and Connected!');
});

client.on('message', async (msg) => {
  const text = msg.body.toLowerCase().trim();
  const from = msg.from;

  if (text === 'menu' || text === 'मेनू') {
    const snap = await db.ref('menu').once('value');
    let reply = '🍛 *Shree & Shriyan Dhaba Menu*\n\n';
    Object.values(snap.val() || {}).forEach(i => {
      reply += `• ${i.name_en} - ₹${i.price}\n`;
    });
    reply += '\nReply: ORDER Dal Tadka 2';
    msg.reply(reply);
  } 
  else if (text.startsWith('order ')) {
    const orderId = Date.now();
    const orderData = {
      id: orderId,
      customer: from,
      name: "WhatsApp Customer",
      table: "WhatsApp",
      items: [{ name_en: text.replace('order ', ''), qty: 1, price: 150 }],
      total: 150,
      timestamp: new Date().toLocaleString(),
      status: "pending",
      type: "whatsapp_order"
    };
    await db.ref('tableOrders/' + orderId).set(orderData);
    msg.reply(`✅ Order Placed! ID: ${orderId}\nKitchen notified.`);
  } 
  else if (text === 'cash' || text === 'कैश') {
    msg.reply('💵 Cash request sent to staff. Please wait.');
  }
});

client.initialize();

// ====================== ROUTES ======================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/admin', (req, res) => {
  res.send(`
    <h1 style="text-align:center;color:#d84315;">🔥 Shree & Shriyan Dhaba - GOAT Admin Panel</h1>
    <h2>Live Orders</h2>
    <div id="orders" style="padding:20px;"></div>
    <script>
      setInterval(async () => {
        const res = await fetch('/api/orders');
        const data = await res.json();
        let html = '';
        Object.keys(data).forEach(k => {
          const o = data[k];
          html += '<div style="background:#fff3e0;padding:15px;margin:10px;border-radius:12px;">' +
                  '<strong>Table: ' + (o.table || 'WhatsApp') + '</strong> | ' + (o.name || '') +
                  ' | ₹' + (o.total || 0) + '<br>Status: ' + (o.status || 'pending') + '</div>';
        });
        document.getElementById('orders').innerHTML = html || '<p>No orders yet</p>';
      }, 3000);
    </script>
  `);
});

app.get('/api/orders', async (req, res) => {
  const snap = await db.ref('tableOrders').once('value');
  res.json(snap.val() || {});
});

app.listen(PORT, () => {
  console.log('✅ Server running on port ' + PORT);
});
