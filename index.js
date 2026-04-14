const express = require('express');
const admin = require('firebase-admin');
require('dotenv').config();

// Import your existing firebase config
const db = require('./firebase.js');   // Make sure firebase.js exports the Firestore db

const app = express();
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
  res.send('✅ Shree Shriyan Dhaba WhatsApp Bot Webhook is Running!');
});

// AiSensy Webhook Endpoint
app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    console.log('📥 Received from AiSensy:', JSON.stringify(payload, null, 2));

    // Save incoming message to Firebase
    if (payload.from || payload.phone) {
      await db.collection('whatsapp_messages').add({
        from: payload.from || payload.phone,
        message: payload.text || payload.message || payload.body || 'Media message',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        messageId: payload.id || payload.messageId,
        status: 'received',
        rawPayload: payload,
        createdAt: new Date()
      });

      console.log('✅ Message saved to Firestore');
    }

    // Send success response back to AiSensy (Very Important)
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
