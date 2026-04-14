const express = require('express');
const admin = require('firebase-admin');
require('dotenv').config();

const db = require('./firebase.js');

const app = express();
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.send('✅ Shree Shriyan Dhaba WhatsApp Bot Webhook is Running!');
});

// AiSensy Webhook
app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    console.log('📥 Received from AiSensy:', JSON.stringify(payload, null, 2));

    const fromNumber = payload.from || payload.phone;
    const messageText = payload.text || payload.message || payload.body || '';

    if (fromNumber) {
      await db.collection('whatsapp_messages').add({
        from: fromNumber,
        message: messageText,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        messageId: payload.id || payload.messageId,
        status: 'received',
        createdAt: new Date()
      });

      console.log(`✅ Message saved from ${fromNumber}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).send('Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
