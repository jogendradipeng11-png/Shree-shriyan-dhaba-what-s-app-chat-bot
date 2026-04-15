require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Firebase Setup
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
  databaseURL: "https://dhaba-bills-default-rtdb.firebaseio.com"
});

const db = admin.database();

// Webhook to receive orders from Evolution API
app.post('/webhook/order', async (req, res) => {
  try {
    const data = req.body;

    const orderData = {
      id: Date.now(),
      table: data.table || "WhatsApp",
      name: data.name || "Customer",
      items: data.items || [],
      total: data.total || 0,
      timestamp: new Date().toLocaleString(),
      status: "pending",
      type: "whatsapp_order",
      source: "evolution-api"
    };

    await db.ref('tableOrders/' + orderData.id).set(orderData);

    console.log('✅ Order saved from WhatsApp:', orderData);

    res.json({ success: true, message: "Order saved to kitchen" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/webhook/cash', async (req, res) => {
  try {
    const data = req.body;
    const cashData = {
      id: Date.now(),
      table: data.table || "WhatsApp",
      name: data.name || "Customer",
      items: data.items || [],
      total: data.total || 0,
      timestamp: new Date().toLocaleString(),
      type: "cash_payment_notification",
      status: "cash_pending"
    };

    await db.ref('tableOrders/' + cashData.id).set(cashData);

    console.log('💵 Cash request saved');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Webhook server running on port ${PORT}`);
});
