require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const db = require('./firebase');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "shree_shriyan_dhaba_2026";

let userSessions = {};

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    if (body.object) {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const value = change.value;
          if (value.messages) {
            const msg = value.messages[0];
            const from = msg.from;
            const text = msg.text ? msg.text.body.toLowerCase().trim() : '';
            await handleMessage(from, text);
          }
        }
      }
      res.sendStatus(200);
    }
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

async function handleMessage(from, text) {
  let session = userSessions[from] || { step: 'welcome', cart: [], table: null, name: null };

  if (text === 'hi' || text === 'hello') {
    await sendText(from, `👋 Welcome to *Shree & Shriyan Dhaba*!\n\nSend your details like:\nTable 5 - Jogendra`);
    session.step = 'ask_details';
  } 
  else if (session.step === 'ask_details') {
    const parts = text.split('-').map(p => p.trim());
    if (parts.length >= 2) {
      session.table = parts[0].replace(/table/gi, '').trim();
      session.name = parts.slice(1).join(' ');
      await sendText(from, `✅ Hello ${session.name}!\nTable ${session.table} saved.\n\nReply *menu* to see our menu.`);
      session.step = 'menu';
    } else {
      await sendText(from, "Please send in this format:\nTable X - Your Name");
    }
  } 
  else if (text === 'menu') {
    await showMenu(from);
  } 
  else if (text === 'confirm' || text === 'place order') {
    await placeOrder(from, session);
    delete userSessions[from];
  } 
  else {
    await sendText(from, "Available commands:\n• hi\n• menu\n• confirm");
  }

  userSessions[from] = session;
}

async function showMenu(to) {
  const snap = await db.ref('menu').once('value');
  const menuItems = Object.values(snap.val() || {});

  if (menuItems.length === 0) {
    return sendText(to, "Menu is empty. Please add items from your POS.");
  }

  const rows = menuItems.slice(0, 10).map((item, i) => ({
    id: `item_${i}`,
    title: item.name_en ? item.name_en.substring(0, 24) : "Item",
    description: `₹${item.price || 0}`
  }));

  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: "🍛 Shree & Shriyan Dhaba Menu" },
      body: { text: "Tap to choose an item:" },
      footer: { text: "Durlaga, Jharsuguda" },
      action: {
        button: "View Menu",
        sections: [{ title: "Available Items", rows }]
      }
    }
  };

  await sendWhatsApp(to, payload);
}

async function placeOrder(from, session) {
  if (!session.cart || session.cart.length === 0) {
    return sendText(from, "Your cart is empty! Add items first.");
  }

  const total = session.cart.reduce((sum, item) => sum + (item.qty * item.price), 0);

  const orderData = {
    id: Date.now(),
    table: session.table || "Walk-in",
    name: session.name || "WhatsApp Guest",
    items: session.cart,
    total: total,
    timestamp: new Date().toLocaleString(),
    status: "pending",
    type: "order",
    source: "whatsapp"
  };

  await db.ref('tableOrders/' + orderData.id).set(orderData);

  await sendText(from, `🎉 Order Placed Successfully!\nTable: ${orderData.table}\nTotal: ₹${total}\n\nKitchen has been notified. Thank you!`);
}

async function sendText(to, text) {
  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: { body: text }
  };
  await sendWhatsApp(to, payload);
}

async function sendWhatsApp(to, payload) {
  try {
    await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, payload, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
  } catch (err) {
    console.error("WhatsApp send error:", err.response ? err.response.data : err.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Shree & Shriyan Dhaba WhatsApp Bot is running on port ${PORT}`);
});