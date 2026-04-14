const { db } = require('../utils/firebase');
const { getCart, saveCart, clearCart } = require('../utils/orderState');

module.exports = {
  config: {
    name: "dhaba",
    aliases: ["menu","order","cart","status"],
    category: "orders"
  },

  onCmd: async ({ reply, from, args }) => {
    const phone = from.split('@')[0];
    const text = args.join(" ").toLowerCase().trim();
    let cart = await getCart(phone);

    // 🔹 MENU
    if (text === "menu" || text === "") {
      const snap = await db.ref('menu').once('value');
      let msg = "🍛 *Shree & Shriyan Dhaba Menu*\n\n";

      Object.values(snap.val() || {}).forEach((item, i) => {
        if (item.available !== false) {
          msg += `${i+1}. ${item.name_hi || item.name_en} - ₹${item.price}\n`;
        }
      });

      return reply(msg + "\nReply: add 1 2");
    }

    // 🔹 ADD
    if (text.startsWith("add")) {
      const snap = await db.ref('menu').once('value');
      const menu = Object.values(snap.val() || {});
      const nums = text.replace("add","").trim().split(" ").map(n=>parseInt(n));

      nums.forEach(n => {
        const item = menu[n-1];
        if (item) {
          let exist = cart.items.find(i => i.name_en === item.name_en);
          if (exist) exist.qty += 1;
          else cart.items.push({...item, qty:1});
        }
      });

      cart.total = cart.items.reduce((s,i)=>s + i.qty*i.price, 0);
      await saveCart(phone, cart);

      let msg = "✅ Cart Updated\n\n";
      cart.items.forEach((i,idx)=>{
        msg += `${idx+1}. ${i.name_hi || i.name_en} × ${i.qty} = ₹${i.qty*i.price}\n`;
      });

      return reply(msg + `\nTotal: ₹${cart.total}\nReply: cart | place`);
    }

    // 🔹 CART
    if (text === "cart") {
      if (cart.items.length === 0) return reply("Cart khali hai");

      let msg = "🛒 *Your Cart*\n\n";
      cart.items.forEach((i,idx)=>{
        msg += `${idx+1}. ${i.name_hi || i.name_en} × ${i.qty} = ₹${i.qty*i.price}\n`;
      });

      return reply(msg + `\nTotal: ₹${cart.total}\nReply: place`);
    }

    // 🔹 PLACE ORDER
    if (text === "place") {
      if (cart.items.length === 0) return reply("Cart khali hai!");

      const orderId = Date.now();

      const orderData = {
        id: orderId,
        table: "WHATSAPP",
        items: cart.items,
        total: cart.total,
        status: "pending",
        whatsappNumber: phone,
        timestamp: new Date().toLocaleString()
      };

      await db.ref('tableOrders/' + orderId).set(orderData);
      await clearCart(phone);

      return reply(`🎉 Order Placed!\nOrder ID: ${orderId}`);
    }

    // 🔹 STATUS (NEW IMPROVED)
    if (text === "status") {
      const snap = await db.ref('tableOrders').once('value');
      const orders = snap.val() || {};

      const userOrder = Object.values(orders).find(o => o.whatsappNumber === phone);

      if (!userOrder) return reply("No active order");

      return reply(`📦 Order Status: ${userOrder.status}`);
    }

    reply("Type menu");
  }
};