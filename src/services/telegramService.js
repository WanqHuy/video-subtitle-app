const Order = require('../models/Order');
const User = require('../models/User');

const TELEGRAM_BOT_TOKEN = '8896123518:AAFhIXg4Jjx4dcQpjR0i8mk1KffRSXkjcqk';
const ADMIN_CHAT_ID = '6071789564';

let lastUpdateId = 0;
let pollingTimer = null;

const callTelegramApi = async (method, body = {}) => {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.includes('dien_token')) {
    return null;
  }
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await response.json();
  } catch (err) {
    console.error(`Lỗi Telegram API (${method}):`, err.message);
    return null;
  }
};

const pollTelegramUpdates = async () => {
  try {
    const data = await callTelegramApi('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 10
    });

    if (data && data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;

        if (update.callback_query) {
          const cb = update.callback_query;
          const dataText = cb.data;

          if (dataText && dataText.startsWith('approve_')) {
            const orderId = dataText.replace('approve_', '');

            try {
              const order = await Order.findById(orderId);
              if (!order) {
                await callTelegramApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Không tìm thấy đơn!' });
                continue;
              }

              if (order.status === 'Completed') {
                await callTelegramApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Đơn đã duyệt trước đó!' });
                continue;
              }

              order.status = 'Completed';
              await order.save();

              // Tính toán bậc Tier nâng cấp
              let newTier = 'basic';
              if (order.total >= 140000) {
                newTier = 'enterprise';
              } else if (order.total >= 70000) {
                newTier = 'pro';
              }

              if (order.user) {
                await User.findByIdAndUpdate(order.user, {
                  $inc: { remainingMinutes: order.addedMinutes },
                  $set: { tier: newTier }
                });
              }

              await callTelegramApi('answerCallbackQuery', {
                callback_query_id: cb.id,
                text: `Đã duyệt đơn và nâng tài khoản lên hạng: ${newTier.toUpperCase()}`
              });

              const oldText = cb.message ? cb.message.text : '';
              await callTelegramApi('editMessageText', {
                chat_id: cb.message.chat.id,
                message_id: cb.message.message_id,
                text: `${oldText}\n\n✅ ĐÃ DUYỆT & NÂNG HẠNG [${newTier.toUpperCase()}] LÚC ${new Date().toLocaleTimeString('vi-VN')}`
              });
            } catch (err) {
              console.error('Lỗi khi duyệt đơn qua Telegram:', err.message);
            }
          }
        }
      }
    }
  } catch (e) {
  } finally {
    pollingTimer = setTimeout(pollTelegramUpdates, 2000);
  }
};

const initTelegramBot = () => {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.includes('dien_token')) {
    console.warn('⚠️ Telegram Bot: Chưa điền Token.');
    return;
  }
  console.log('✓ Telegram Bot Service đã kích hoạt');
  pollTelegramUpdates();
};

const sendNewOrderAlert = async (order) => {
  const priceFormatted = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.total);
  const text = 
`🔔 CÓ ĐƠN THANH TOÁN MỚI!
━━━━━━━━━━━━━━━━━
👤 Khách hàng: ${order.userEmail}
💰 Số tiền: ${priceFormatted}
⏱ Thời lượng: +${order.addedMinutes} phút
🏷 Mã CK: ${order.paymentCode}
━━━━━━━━━━━━━━━━━
Bấm duyệt để nạp phút & tự động nâng hạng gói:`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: `✅ Duyệt & Cấp +${order.addedMinutes} Phút`,
          callback_data: `approve_${order._id}`
        }
      ]
    ]
  };

  await callTelegramApi('sendMessage', {
    chat_id: ADMIN_CHAT_ID,
    text: text,
    reply_markup: inlineKeyboard
  });
};

module.exports = {
  initTelegramBot,
  sendNewOrderAlert
};