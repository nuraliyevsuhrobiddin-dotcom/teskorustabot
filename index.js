require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID || 123456789);
const CHANNEL_ID = process.env.CHANNEL_ID;
const CHANNEL_URL = process.env.CHANNEL_URL || (CHANNEL_ID?.startsWith("@") ? `https://t.me/${CHANNEL_ID.slice(1)}` : "");
const SITE_URL = process.env.SITE_URL || "https://teskorusta.uz";

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN topilmadi. .env faylga BOT_TOKEN qo'shing.");
  process.exit(1);
}

if (!ADMIN_ID || Number.isNaN(ADMIN_ID)) {
  console.error("ADMIN_ID noto'g'ri. .env faylda ADMIN_ID raqam bo'lishi kerak.");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const userStates = new Map();
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const USER_COMMANDS = [
  { command: "start", description: "Botni qayta boshlash" },
  { command: "menu", description: "Asosiy menyuni ochish" },
];

const ADMIN_COMMANDS = [
  ...USER_COMMANDS,
  { command: "admin", description: "Admin panel" },
  { command: "elon", description: "Kanalga e'lon joylash" },
  { command: "broadcast", description: "Userlarga xabar yuborish" },
];

const ACTIONS = {
  CREATE_ORDER: "create_order",
  URGENT_ORDER: "urgent_order",
  BECOME_MASTER: "become_master",
  CONTACT_ADMIN: "contact_admin",
  REPORT_PROBLEM: "report_problem",
  CONFIRM_MASTER: "confirm_master",
  CONFIRM_ORDER: "confirm_order",
  CHECK_SUBSCRIPTION: "check_subscription",
  ADMIN_ANNOUNCE: "admin_announce",
  ADMIN_BROADCAST: "admin_broadcast",
  ADMIN_STATS: "admin_stats",
  OPEN_SITE: "open_site",
  CANCEL: "cancel",
};

const STEPS = {
  ORDER_SERVICE: "order_service",
  ORDER_REGION: "order_region",
  ORDER_DISTRICT: "order_district",
  ORDER_TIME: "order_time",
  ORDER_PHONE: "order_phone",
  ORDER_DETAILS: "order_details",
  ORDER_MEDIA: "order_media",
  ORDER_CONFIRM: "order_confirm",
  MASTER_NAME: "master_name",
  MASTER_PHONE: "master_phone",
  MASTER_SERVICE: "master_service",
  MASTER_REGION: "master_region",
  MASTER_DISTRICT: "master_district",
  MASTER_CONFIRM: "master_confirm",
  ADMIN_ANNOUNCE: "admin_announce",
  ADMIN_BROADCAST: "admin_broadcast",
  CONTACT_MESSAGE: "contact_message",
  PROBLEM_MESSAGE: "problem_message",
};

const serviceTypes = [
  "Elektrik",
  "Santexnik",
  "Konditsioner",
  "Gaz ustasi",
  "Maishiy texnika ustasi",
  "Remont (uy ta’miri)",
  "Plitka ustasi",
  "Malyar (bo‘yoqchi)",
  "Shtukaturka ustasi",
  "Pol (laminat, parket)",
  "Gipsokarton ustasi",
  "Deraza-eshik ustasi",
  "Temirchi / payvandchi",
  "Tom ustasi",
  "Isitish tizimi",
  "Kanalizatsiya",
  "Suv nasos ustasi",
  "Mebel ustasi",
  "Santexnika o‘rnatish",
  "Usta xizmatlari (boshqa)",
  "Kunlikchi ishchi",
  "Yuk tashuvchi (gruzchik)",
  "Tozalovchi (cleaning)",
  "Bog‘bon",
  "Qor tozalash",
  "Qurilish ishchisi",
];

const SERVICE_BACK = "⬅️ Orqaga";
const SKIP_MEDIA = "⏭ O'tkazib yuborish";

const orderTimeTypes = [
  "🚨 Hozir",
  "Bugun",
  "Ertaga",
  "Dam olish kuni",
];

const regionTypes = [
  "Toshkent",
  "Qashqadaryo",
];

const districtTypes = {
  Toshkent: [
    "Chilonzor",
    "Yunusobod",
    "Sergeli",
    "Olmazor",
    "Shayxontohur",
    "Uchtepa",
    "Yakkasaroy",
    "Mirzo Ulug‘bek",
    "Mirobod",
    "Yashnobod",
    "Bektemir",
    "Yangihayot",
  ],
  Qashqadaryo: [
    "Qarshi",
    "Shahrisabz",
    "Kitob",
    "Koson",
    "G‘uzor",
    "Dehqonobod",
  ],
};

const serviceOptions = serviceTypes.map((service) => ({
  label: service,
  value: service,
}));

function keyboardRows(items, perRow = 2) {
  return items.reduce((rows, item, index) => {
    if (index % perRow === 0) {
      rows.push([]);
    }

    rows[rows.length - 1].push(item);
    return rows;
  }, []);
}

const mainMenu = Markup.inlineKeyboard([
  [Markup.button.callback("🧰 Usta chaqirish", ACTIONS.CREATE_ORDER)],
  [Markup.button.callback("🚨 Shoshilinch chaqiruv", ACTIONS.URGENT_ORDER)],
  [Markup.button.callback("🧰 Usta bo'lish", ACTIONS.BECOME_MASTER)],
  [Markup.button.callback("💬 Admin bilan bog'lanish", ACTIONS.CONTACT_ADMIN)],
  [Markup.button.callback("🚨 Muammo yozish", ACTIONS.REPORT_PROBLEM)],
  [Markup.button.url("🌐 TeskorUsta.uz", SITE_URL)],
]);

const cancelKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("❌ Bekor qilish", ACTIONS.CANCEL)],
]);

const confirmKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("✅ Tasdiqlash", ACTIONS.CONFIRM_MASTER)],
  [Markup.button.callback("❌ Bekor qilish", ACTIONS.CANCEL)],
]);

const orderConfirmKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("✅ Buyurtmani yuborish", ACTIONS.CONFIRM_ORDER)],
  [Markup.button.callback("❌ Bekor qilish", ACTIONS.CANCEL)],
]);

const subscriptionKeyboard = Markup.inlineKeyboard([
  ...(CHANNEL_URL ? [[Markup.button.url("📢 Kanalga o'tish", CHANNEL_URL)]] : []),
  [Markup.button.url("🌐 Saytga o'tish", SITE_URL)],
  [Markup.button.callback("✅ Obunani tekshirish", ACTIONS.CHECK_SUBSCRIPTION)],
]);

const adminKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("📢 E'lon joylash", ACTIONS.ADMIN_ANNOUNCE)],
  [Markup.button.callback("📣 Broadcast", ACTIONS.ADMIN_BROADCAST)],
  [Markup.button.callback("📊 Statistika", ACTIONS.ADMIN_STATS)],
]);

const serviceKeyboard = Markup.keyboard([
  ...keyboardRows(serviceOptions.map((service) => service.label)),
  [SERVICE_BACK],
])
  .oneTime()
  .resize();

const regionKeyboard = Markup.keyboard([
  ...keyboardRows(regionTypes),
  [SERVICE_BACK],
])
  .oneTime()
  .resize();

const orderTimeKeyboard = Markup.keyboard([
  ...keyboardRows(orderTimeTypes),
  [SERVICE_BACK],
])
  .oneTime()
  .resize();

const mediaKeyboard = Markup.keyboard([
  [SKIP_MEDIA],
  [SERVICE_BACK],
])
  .oneTime()
  .resize();

function districtKeyboard(region) {
  return Markup.keyboard([
    ...keyboardRows(districtTypes[region] || []),
    [SERVICE_BACK],
  ])
    .oneTime()
    .resize();
}

const phoneKeyboard = Markup.keyboard([
  [Markup.button.contactRequest("📱 Telefon raqamni yuborish")],
])
  .oneTime()
  .resize();

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function username(ctx) {
  return ctx.from?.username ? `@${ctx.from.username}` : "username yo'q";
}

function setState(userId, step, data = {}) {
  userStates.set(userId, { step, data });
}

function clearState(userId) {
  userStates.delete(userId);
}

function createDefaultDb() {
  return {
    users: {},
    masters: [],
    orders: [],
    nextMasterId: 1,
    nextOrderId: 1,
  };
}

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return createDefaultDb();
    }

    return {
      ...createDefaultDb(),
      ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")),
    };
  } catch (error) {
    console.error("Bazani o'qishda xatolik:", error);
    return createDefaultDb();
  }
}

function writeDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function saveUser(from) {
  if (!from?.id) return;

  const db = readDb();
  db.users[from.id] = {
    id: from.id,
    firstName: from.first_name || "",
    username: from.username || "",
    updatedAt: new Date().toISOString(),
  };
  writeDb(db);
}

function saveMasterRequest(data, ctx) {
  const db = readDb();
  const master = {
    id: db.nextMasterId,
    status: "pending",
    userId: ctx.from.id,
    username: username(ctx),
    ...data,
    createdAt: new Date().toISOString(),
  };

  db.nextMasterId += 1;
  db.masters.push(master);
  writeDb(db);
  return master;
}

function updateMasterStatus(masterId, status) {
  const db = readDb();
  const master = db.masters.find((item) => item.id === masterId);
  if (!master) return null;

  master.status = status;
  master.updatedAt = new Date().toISOString();
  writeDb(db);
  return master;
}

function saveOrderRequest(data, ctx) {
  const db = readDb();
  const order = {
    id: db.nextOrderId,
    status: "new",
    userId: ctx.from.id,
    username: username(ctx),
    ...data,
    createdAt: new Date().toISOString(),
  };

  db.nextOrderId += 1;
  db.orders.push(order);
  writeDb(db);
  return order;
}

function updateOrderStatus(orderId, status) {
  const db = readDb();
  const order = db.orders.find((item) => item.id === orderId);
  if (!order) return null;

  order.status = status;
  order.updatedAt = new Date().toISOString();
  writeDb(db);
  return order;
}

function isAdmin(ctx) {
  return ctx.from?.id === ADMIN_ID;
}

function normalizePhone(input) {
  return String(input || "").replace(/[^\d+]/g, "");
}

function isValidPhone(phone) {
  const normalized = normalizePhone(phone);
  return /^(\+998|998)?\d{9}$/.test(normalized) || /^\+\d{10,15}$/.test(normalized);
}

function getServiceValue(input) {
  const option = serviceOptions.find((service) => service.label === input || service.value === input);
  return option?.value;
}

async function showMainMenu(ctx, text = "✨ Assalomu alaykum!\n\nTeskorUsta24 botiga xush kelibsiz.\nKerakli bo'limni tanlang:") {
  await ctx.reply(text, mainMenu);
}

async function resetAndShowMainMenu(ctx, text) {
  clearState(ctx.from.id);
  await ctx.reply("Eski ma'lumotlar tozalandi.", Markup.removeKeyboard());
  await showMainMenu(ctx, text);
}

async function isSubscribed(userId) {
  if (!CHANNEL_ID) return true;

  try {
    const member = await bot.telegram.getChatMember(CHANNEL_ID, userId);
    return ["creator", "administrator", "member"].includes(member.status);
  } catch (error) {
    console.error("Kanal obunasini tekshirishda xatolik:", error);
    return false;
  }
}

async function showSubscriptionMessage(ctx) {
  await ctx.reply(
    "📢 Botdan foydalanish uchun avval kanalimizga obuna bo'ling.\n\nObuna bo'lgach, \"✅ Obunani tekshirish\" tugmasini bosing.",
    subscriptionKeyboard
  );
}

async function safeSendToAdmin(message, extra = {}) {
  try {
    await bot.telegram.sendMessage(ADMIN_ID, message, {
      parse_mode: "HTML",
      ...extra,
    });
    return true;
  } catch (error) {
    console.error("Admin ga xabar yuborishda xatolik:", error);
    return false;
  }
}

async function safeForwardToAdmin(ctx) {
  try {
    await ctx.forwardMessage(ADMIN_ID);
    return true;
  } catch (error) {
    console.error("Admin ga forward qilishda xatolik:", error);
    return false;
  }
}

async function safeSendToChannel(message, extra = {}) {
  if (!CHANNEL_ID) {
    return false;
  }

  try {
    await bot.telegram.sendMessage(CHANNEL_ID, message, {
      parse_mode: "HTML",
      ...extra,
    });
    return true;
  } catch (error) {
    console.error("Kanalga xabar yuborishda xatolik:", error);
    return false;
  }
}

function buildMasterSummary(data) {
  return (
    "📋 Arizangizni tekshiring:\n\n" +
    `👤 Ism: ${data.name}\n` +
    `📞 Telefon: ${data.phone}\n` +
    `🧰 Xizmat turi: ${data.service}\n` +
    `📍 Hudud: ${data.region}, ${data.district}\n\n` +
    "Ma'lumotlar to'g'ri bo'lsa tasdiqlang:"
  );
}

function buildOrderSummary(data) {
  return (
    "📋 Buyurtmangizni tekshiring:\n\n" +
    `🔧 Xizmat: ${data.service}\n` +
    `📍 Hudud: ${data.region}, ${data.district}\n` +
    `⏰ Vaqt: ${data.time}\n` +
    `📞 Telefon: ${data.phone}\n` +
    `📝 Muammo: ${data.details}\n` +
    `📎 Media: ${data.media ? "bor" : "yo'q"}\n\n` +
    "Ma'lumotlar to'g'ri bo'lsa yuboring:"
  );
}

function buildMasterAdminMessage(data, ctx) {
  return (
    "🛠 <b>Yangi usta arizasi</b>\n\n" +
    `👤 <b>Ism:</b> ${escapeHtml(data.name)}\n` +
    `📞 <b>Telefon:</b> ${escapeHtml(data.phone)}\n` +
    `🔧 <b>Xizmat turi:</b> ${escapeHtml(data.service)}\n` +
    `📍 <b>Hudud:</b> ${escapeHtml(data.region)}, ${escapeHtml(data.district)}\n` +
    `💬 <b>Telegram:</b> ${escapeHtml(username(ctx))}\n` +
    `🆔 <b>User ID:</b> <code>${ctx.from.id}</code>`
  );
}

function buildOrderAdminMessage(order) {
  return (
    `${order.urgent ? "🚨 <b>SHOSHILINCH BUYURTMA</b>" : "🧰 <b>Yangi buyurtma</b>"}\n\n` +
    `🆔 <b>Buyurtma:</b> #${order.id}\n` +
    `🔧 <b>Xizmat:</b> ${escapeHtml(order.service)}\n` +
    `📍 <b>Hudud:</b> ${escapeHtml(order.region)}, ${escapeHtml(order.district)}\n` +
    `⏰ <b>Vaqt:</b> ${escapeHtml(order.time)}\n` +
    `📞 <b>Telefon:</b> ${escapeHtml(order.phone)}\n` +
    `📝 <b>Muammo:</b> ${escapeHtml(order.details)}\n` +
    `💬 <b>Telegram:</b> ${escapeHtml(order.username)}\n` +
    `🆔 <b>User ID:</b> <code>${order.userId}</code>`
  );
}

function orderAdminKeyboard(orderId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("👀 Ko'rilmoqda", `order:status:${orderId}:reviewing`),
      Markup.button.callback("🧰 Usta topildi", `order:status:${orderId}:assigned`),
    ],
    [
      Markup.button.callback("✅ Yakunlandi", `order:status:${orderId}:done`),
      Markup.button.callback("❌ Bekor", `order:status:${orderId}:cancelled`),
    ],
  ]);
}

function orderStatusText(status) {
  const labels = {
    reviewing: "Admin buyurtmangizni ko'rib chiqyapti.",
    assigned: "Buyurtmangiz uchun usta topildi. Tez orada bog'lanamiz.",
    done: "Buyurtmangiz yakunlandi. Ishonchingiz uchun rahmat!",
    cancelled: "Buyurtmangiz bekor qilindi.",
  };

  return labels[status] || "Buyurtma holati yangilandi.";
}

function buildPromoFooter() {
  const lines = [];

  if (SITE_URL) {
    lines.push(`🌐 Sayt: ${SITE_URL}`);
  }

  if (CHANNEL_URL) {
    lines.push(`📢 Kanal: ${CHANNEL_URL}`);
  }

  return lines.length ? `\n\n${lines.join("\n")}` : "";
}

function buildAnnouncementPost(text) {
  return `📢 <b>E'lon</b>\n\n${escapeHtml(text)}${buildPromoFooter()}`;
}

function buildMasterChannelPost(master) {
  return (
    "🧰 <b>Yangi tasdiqlangan usta</b>\n\n" +
    `👤 <b>Ism:</b> ${escapeHtml(master.name)}\n` +
    `📞 <b>Telefon:</b> ${escapeHtml(master.phone)}\n` +
    `🔧 <b>Xizmat:</b> ${escapeHtml(master.service)}\n` +
    `📍 <b>Hudud:</b> ${escapeHtml(master.region)}, ${escapeHtml(master.district)}\n` +
    `💬 <b>Telegram:</b> ${escapeHtml(master.username)}` +
    buildPromoFooter()
  );
}

function masterAdminKeyboard(masterId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("✅ Kanalga chiqarish", `master:approve:${masterId}`),
      Markup.button.callback("❌ Rad etish", `master:reject:${masterId}`),
    ],
  ]);
}

bot.use(async (ctx, next) => {
  if (!ctx.from) {
    return next();
  }

  saveUser(ctx.from);

  if (isAdmin(ctx) || !CHANNEL_ID || ctx.callbackQuery?.data === ACTIONS.CHECK_SUBSCRIPTION) {
    return next();
  }

  const subscribed = await isSubscribed(ctx.from.id);
  if (!subscribed) {
    if (ctx.message?.text === "/start" || ctx.message?.text === "/menu") {
      clearState(ctx.from.id);
      await ctx.reply("Eski ma'lumotlar tozalandi.", Markup.removeKeyboard());
    }

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery().catch(() => {});
    }

    await showSubscriptionMessage(ctx);
    return;
  }

  return next();
});

bot.start(async (ctx) => {
  await resetAndShowMainMenu(ctx);
});

bot.command("menu", async (ctx) => {
  await resetAndShowMainMenu(ctx);
});

bot.command("admin", async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply("Bu bo'lim faqat admin uchun.");
    return;
  }

  clearState(ctx.from.id);
  await ctx.reply("Admin panel:", adminKeyboard);
});

bot.command("elon", async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply("Bu komanda faqat admin uchun.");
    return;
  }

  const text = ctx.message.text.replace(/^\/elon(@\w+)?\s*/i, "").trim();
  if (!text) {
    setState(ctx.from.id, STEPS.ADMIN_ANNOUNCE, {});
    await ctx.reply("Kanalga joylanadigan e'lon matnini yuboring:", cancelKeyboard);
    return;
  }

  const sent = await safeSendToChannel(buildAnnouncementPost(text));
  await ctx.reply(sent ? "E'lon kanalga joylandi." : "E'lon yuborilmadi. CHANNEL_ID va bot adminligini tekshiring.");
});

bot.command("broadcast", async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply("Bu komanda faqat admin uchun.");
    return;
  }

  const text = ctx.message.text.replace(/^\/broadcast(@\w+)?\s*/i, "").trim();
  if (!text) {
    setState(ctx.from.id, STEPS.ADMIN_BROADCAST, {});
    await ctx.reply("Userlarga yuboriladigan xabar matnini yuboring:", cancelKeyboard);
    return;
  }

  const db = readDb();
  let sentCount = 0;
  for (const userId of Object.keys(db.users)) {
    try {
      await bot.telegram.sendMessage(userId, text);
      sentCount += 1;
    } catch (error) {
      console.error(`Broadcast yuborilmadi. User ID: ${userId}`, error);
    }
  }

  await ctx.reply(`Broadcast tugadi. Yuborildi: ${sentCount} ta user.`);
});

bot.action(ACTIONS.CHECK_SUBSCRIPTION, async (ctx) => {
  await ctx.answerCbQuery();

  const subscribed = await isSubscribed(ctx.from.id);
  if (!subscribed) {
    await showSubscriptionMessage(ctx);
    return;
  }

  await resetAndShowMainMenu(ctx, "✅ Obuna tasdiqlandi. Kerakli bo'limni tanlang:");
});

bot.action(ACTIONS.ADMIN_ANNOUNCE, async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx)) return;

  setState(ctx.from.id, STEPS.ADMIN_ANNOUNCE, {});
  await ctx.reply("Kanalga joylanadigan e'lon matnini yuboring:", cancelKeyboard);
});

bot.action(ACTIONS.ADMIN_BROADCAST, async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx)) return;

  setState(ctx.from.id, STEPS.ADMIN_BROADCAST, {});
  await ctx.reply("Userlarga yuboriladigan xabar matnini yuboring:", cancelKeyboard);
});

bot.action(ACTIONS.ADMIN_STATS, async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx)) return;

  const db = readDb();
  const masters = db.masters || [];
  const orders = db.orders || [];
  const pending = masters.filter((item) => item.status === "pending").length;
  const approved = masters.filter((item) => item.status === "approved").length;
  const rejected = masters.filter((item) => item.status === "rejected").length;
  const newOrders = orders.filter((item) => item.status === "new").length;
  const urgentOrders = orders.filter((item) => item.urgent && item.status !== "done" && item.status !== "cancelled").length;

  await ctx.reply(
    "📊 Statistika\n\n" +
    `👥 Userlar: ${Object.keys(db.users || {}).length}\n` +
    `🧰 Jami arizalar: ${masters.length}\n` +
    `⏳ Kutilmoqda: ${pending}\n` +
    `✅ Tasdiqlangan: ${approved}\n` +
    `❌ Rad etilgan: ${rejected}\n\n` +
    `📦 Buyurtmalar: ${orders.length}\n` +
    `🆕 Yangi buyurtmalar: ${newOrders}\n` +
    `🚨 Aktiv shoshilinch: ${urgentOrders}`
  );
});

bot.action(ACTIONS.CANCEL, async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("Bekor qilindi.", Markup.removeKeyboard());
  clearState(ctx.from.id);
  await showMainMenu(ctx);
});

bot.action(ACTIONS.CREATE_ORDER, async (ctx) => {
  await ctx.answerCbQuery();
  clearState(ctx.from.id);
  setState(ctx.from.id, STEPS.ORDER_SERVICE, { urgent: false });
  await ctx.reply("🧰 Qanday xizmat kerak?", serviceKeyboard);
});

bot.action(ACTIONS.URGENT_ORDER, async (ctx) => {
  await ctx.answerCbQuery();
  clearState(ctx.from.id);
  setState(ctx.from.id, STEPS.ORDER_SERVICE, {
    urgent: true,
    time: "🚨 Hozir",
  });
  await ctx.reply("🚨 Shoshilinch chaqiruv. Qanday xizmat kerak?", serviceKeyboard);
});

bot.action(ACTIONS.CONFIRM_MASTER, async (ctx) => {
  await ctx.answerCbQuery();

  const state = userStates.get(ctx.from.id);
  if (!state || state.step !== STEPS.MASTER_CONFIRM) {
    await showMainMenu(ctx, "Iltimos, menyudan qayta boshlang:");
    return;
  }

  const master = saveMasterRequest(state.data, ctx);
  const sent = await safeSendToAdmin(buildMasterAdminMessage(master, ctx), masterAdminKeyboard(master.id));
  clearState(ctx.from.id);

  if (!sent) {
    await ctx.reply("Kechirasiz, so'rovingizni adminga yuborishda xatolik bo'ldi. Keyinroq urinib ko'ring.", Markup.removeKeyboard());
    return;
  }

  await ctx.reply("👉 Rahmat! Sizning so'rovingiz yuborildi", Markup.removeKeyboard());
  await showMainMenu(ctx, "Yana qanday yordam bera olamiz?");
});

bot.action(ACTIONS.CONFIRM_ORDER, async (ctx) => {
  await ctx.answerCbQuery();

  const state = userStates.get(ctx.from.id);
  if (!state || state.step !== STEPS.ORDER_CONFIRM) {
    await showMainMenu(ctx, "Iltimos, buyurtmani menyudan qayta boshlang:");
    return;
  }

  const order = saveOrderRequest(state.data, ctx);
  const sent = await safeSendToAdmin(buildOrderAdminMessage(order), orderAdminKeyboard(order.id));
  clearState(ctx.from.id);

  if (!sent) {
    await ctx.reply("Kechirasiz, buyurtmani adminga yuborishda xatolik bo'ldi. Keyinroq urinib ko'ring.", Markup.removeKeyboard());
    return;
  }

  if (order.media) {
    await bot.telegram.forwardMessage(ADMIN_ID, order.userId, order.media.messageId).catch((error) => {
      console.error("Buyurtma mediasini adminga forward qilishda xatolik:", error);
    });
  }

  await ctx.reply(`✅ Buyurtmangiz qabul qilindi. Raqam: #${order.id}`, Markup.removeKeyboard());
  await showMainMenu(ctx, "Yana qanday yordam bera olamiz?");
});

bot.action(/^order:status:(\d+):(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx)) return;

  const order = updateOrderStatus(Number(ctx.match[1]), ctx.match[2]);
  if (!order) {
    await ctx.reply("Buyurtma topilmadi.");
    return;
  }

  await ctx.reply(`Buyurtma #${order.id} holati yangilandi: ${order.status}`);
  await bot.telegram.sendMessage(order.userId, `📌 Buyurtma #${order.id}: ${orderStatusText(order.status)}`).catch((error) => {
    console.error("Buyurtma statusini userga yuborishda xatolik:", error);
  });
});

bot.action(/^master:approve:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx)) return;

  const master = updateMasterStatus(Number(ctx.match[1]), "approved");
  if (!master) {
    await ctx.reply("Ariza topilmadi.");
    return;
  }

  const posted = await safeSendToChannel(buildMasterChannelPost(master));
  await ctx.reply(posted ? "Usta kanalga chiqarildi." : "Usta tasdiqlandi, lekin kanalga chiqarilmadi. CHANNEL_ID va bot adminligini tekshiring.");
});

bot.action(/^master:reject:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx)) return;

  const master = updateMasterStatus(Number(ctx.match[1]), "rejected");
  await ctx.reply(master ? "Ariza rad etildi." : "Ariza topilmadi.");
});

bot.action(ACTIONS.BECOME_MASTER, async (ctx) => {
  await ctx.answerCbQuery();
  clearState(ctx.from.id);
  setState(ctx.from.id, STEPS.MASTER_NAME, {});
  await ctx.reply("Ismingizni yozing:", cancelKeyboard);
});

bot.action(ACTIONS.CONTACT_ADMIN, async (ctx) => {
  await ctx.answerCbQuery();
  clearState(ctx.from.id);
  setState(ctx.from.id, STEPS.CONTACT_MESSAGE, {});
  await ctx.reply("Adminga yubormoqchi bo'lgan xabaringizni yozing:", cancelKeyboard);
});

bot.action(ACTIONS.REPORT_PROBLEM, async (ctx) => {
  await ctx.answerCbQuery();
  clearState(ctx.from.id);
  setState(ctx.from.id, STEPS.PROBLEM_MESSAGE, {});
  await ctx.reply("Muammo haqida yozing. Iloji boricha batafsil tushuntiring:", cancelKeyboard);
});

bot.action(/^service:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const state = userStates.get(ctx.from.id);
  if (!state || state.step !== STEPS.MASTER_SERVICE) {
    await showMainMenu(ctx, "Iltimos, menyudan qayta tanlang:");
    return;
  }

  const service = getServiceValue(ctx.match[1]);
  if (!serviceTypes.includes(service)) {
    await ctx.reply("Iltimos, xizmat turini faqat tugmalardan tanlang.", serviceKeyboard);
    return;
  }

  setState(ctx.from.id, STEPS.MASTER_REGION, {
    ...state.data,
    service,
  });

  await ctx.reply("📍 Qaysi hududda ishlaysiz?", regionKeyboard);
});

bot.on("contact", async (ctx) => {
  const state = userStates.get(ctx.from.id);

  if (!state || (state.step !== STEPS.MASTER_PHONE && state.step !== STEPS.ORDER_PHONE)) {
    await ctx.reply("Telefon raqam qabul qilindi, ammo hozir ro'yxatdan o'tish jarayoni aktiv emas.");
    return;
  }

  const contact = ctx.message.contact;
  if (contact.user_id !== ctx.from.id) {
    await ctx.reply("Iltimos, faqat o'zingizning Telegram raqamingizni yuboring.", phoneKeyboard);
    return;
  }

  const phone = contact.phone_number;
  if (state.step === STEPS.ORDER_PHONE) {
    setState(ctx.from.id, STEPS.ORDER_DETAILS, {
      ...state.data,
      phone,
    });

    await ctx.reply("Telefon raqamingiz qabul qilindi.", Markup.removeKeyboard());
    await ctx.reply("📝 Muammo haqida qisqacha yozing. Masalan: kran oqyapti, svet yo'q, konditsioner ishlamayapti.", cancelKeyboard);
    return;
  }

  setState(ctx.from.id, STEPS.MASTER_SERVICE, {
    ...state.data,
    phone,
  });

  await ctx.reply("Telefon raqamingiz qabul qilindi.", Markup.removeKeyboard());
  await ctx.reply("🧰 Qaysi xizmat turini ko'rsatasiz?", serviceKeyboard);
});

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();
  const state = userStates.get(userId);

  if (!state) {
    await showMainMenu(ctx, "Menyudan birini tanlang:");
    return;
  }

  if (text === "/start" || text === "/menu") {
    await resetAndShowMainMenu(ctx);
    return;
  }

  switch (state.step) {
    case STEPS.ORDER_SERVICE: {
      if (text === SERVICE_BACK) {
        clearState(userId);
        await ctx.reply("Asosiy menyuga qaytdingiz.", Markup.removeKeyboard());
        await showMainMenu(ctx);
        return;
      }

      const service = getServiceValue(text);
      if (!serviceTypes.includes(service)) {
        await ctx.reply("Iltimos, xizmat turini faqat tugmalardan tanlang.", serviceKeyboard);
        return;
      }

      setState(userId, STEPS.ORDER_REGION, {
        ...state.data,
        service,
      });

      await ctx.reply("📍 Qaysi hududga usta kerak?", regionKeyboard);
      break;
    }

    case STEPS.ORDER_REGION: {
      if (text === SERVICE_BACK) {
        setState(userId, STEPS.ORDER_SERVICE, {
          urgent: state.data.urgent,
          time: state.data.time,
        });
        await ctx.reply("🧰 Xizmat turini tanlang:", serviceKeyboard);
        return;
      }

      if (!regionTypes.includes(text)) {
        await ctx.reply("Iltimos, hududni faqat tugmalardan tanlang.", regionKeyboard);
        return;
      }

      setState(userId, STEPS.ORDER_DISTRICT, {
        ...state.data,
        region: text,
      });

      await ctx.reply(`📍 ${text} bo'yicha tuman/shaharni tanlang:`, districtKeyboard(text));
      break;
    }

    case STEPS.ORDER_DISTRICT: {
      if (text === SERVICE_BACK) {
        setState(userId, STEPS.ORDER_REGION, {
          urgent: state.data.urgent,
          time: state.data.time,
          service: state.data.service,
        });
        await ctx.reply("📍 Hududni qayta tanlang:", regionKeyboard);
        return;
      }

      const districts = districtTypes[state.data.region] || [];
      if (!districts.includes(text)) {
        await ctx.reply("Iltimos, tuman/shaharni faqat tugmalardan tanlang.", districtKeyboard(state.data.region));
        return;
      }

      const nextData = {
        ...state.data,
        district: text,
      };

      if (nextData.urgent) {
        setState(userId, STEPS.ORDER_PHONE, nextData);
        await ctx.reply("Telefon raqamingizni yuboring. Masalan: +998901234567", phoneKeyboard);
      } else {
        setState(userId, STEPS.ORDER_TIME, nextData);
        await ctx.reply("⏰ Qachon usta kerak?", orderTimeKeyboard);
      }
      break;
    }

    case STEPS.ORDER_TIME: {
      if (text === SERVICE_BACK) {
        setState(userId, STEPS.ORDER_DISTRICT, {
          urgent: state.data.urgent,
          service: state.data.service,
          region: state.data.region,
        });
        await ctx.reply(`📍 ${state.data.region} bo'yicha tuman/shaharni tanlang:`, districtKeyboard(state.data.region));
        return;
      }

      if (!orderTimeTypes.includes(text)) {
        await ctx.reply("Iltimos, vaqtni tugmalardan tanlang.", orderTimeKeyboard);
        return;
      }

      setState(userId, STEPS.ORDER_PHONE, {
        ...state.data,
        time: text,
      });

      await ctx.reply("Telefon raqamingizni yuboring. Masalan: +998901234567", phoneKeyboard);
      break;
    }

    case STEPS.ORDER_PHONE: {
      if (!isValidPhone(text)) {
        await ctx.reply("Telefon raqam noto'g'ri. Masalan: +998901234567 ko'rinishida yuboring.");
        return;
      }

      setState(userId, STEPS.ORDER_DETAILS, {
        ...state.data,
        phone: normalizePhone(text),
      });

      await ctx.reply("Telefon raqamingiz qabul qilindi.", Markup.removeKeyboard());
      await ctx.reply("📝 Muammo haqida qisqacha yozing. Masalan: kran oqyapti, svet yo'q, konditsioner ishlamayapti.", cancelKeyboard);
      break;
    }

    case STEPS.ORDER_DETAILS: {
      if (text.length < 5) {
        await ctx.reply("Iltimos, muammoni biroz batafsilroq yozing:");
        return;
      }

      setState(userId, STEPS.ORDER_MEDIA, {
        ...state.data,
        details: text,
      });

      await ctx.reply("📸 Muammo rasmini yoki videosini yuboring. Xohlamasangiz, o'tkazib yuboring.", mediaKeyboard);
      break;
    }

    case STEPS.ORDER_MEDIA: {
      if (text === SERVICE_BACK) {
        setState(userId, STEPS.ORDER_DETAILS, {
          urgent: state.data.urgent,
          service: state.data.service,
          region: state.data.region,
          district: state.data.district,
          time: state.data.time,
          phone: state.data.phone,
        });
        await ctx.reply("📝 Muammo haqida qayta yozing:", cancelKeyboard);
        return;
      }

      if (text !== SKIP_MEDIA) {
        await ctx.reply("Iltimos, rasm/video yuboring yoki o'tkazib yuborish tugmasini bosing.", mediaKeyboard);
        return;
      }

      const data = {
        ...state.data,
        media: null,
      };

      setState(userId, STEPS.ORDER_CONFIRM, data);
      await ctx.reply("Media o'tkazib yuborildi.", Markup.removeKeyboard());
      await ctx.reply(buildOrderSummary(data), orderConfirmKeyboard);
      break;
    }

    case STEPS.ORDER_CONFIRM: {
      await ctx.reply("Iltimos, buyurtmani yuborish uchun tasdiqlash tugmasini bosing.", orderConfirmKeyboard);
      break;
    }

    case STEPS.ADMIN_ANNOUNCE: {
      if (!isAdmin(ctx)) {
        clearState(userId);
        await showMainMenu(ctx);
        return;
      }

      const sent = await safeSendToChannel(buildAnnouncementPost(text));
      clearState(userId);
      await ctx.reply(sent ? "E'lon kanalga joylandi." : "E'lon yuborilmadi. CHANNEL_ID va bot adminligini tekshiring.", Markup.removeKeyboard());
      await ctx.reply("Admin panel:", adminKeyboard);
      break;
    }

    case STEPS.ADMIN_BROADCAST: {
      if (!isAdmin(ctx)) {
        clearState(userId);
        await showMainMenu(ctx);
        return;
      }

      const db = readDb();
      let sentCount = 0;
      for (const savedUserId of Object.keys(db.users)) {
        try {
          await bot.telegram.sendMessage(savedUserId, text);
          sentCount += 1;
        } catch (error) {
          console.error(`Broadcast yuborilmadi. User ID: ${savedUserId}`, error);
        }
      }

      clearState(userId);
      await ctx.reply(`Broadcast tugadi. Yuborildi: ${sentCount} ta user.`, Markup.removeKeyboard());
      await ctx.reply("Admin panel:", adminKeyboard);
      break;
    }

    case STEPS.MASTER_NAME: {
      if (text.length < 2) {
        await ctx.reply("Iltimos, ismingizni to'g'ri kiriting:");
        return;
      }

      setState(userId, STEPS.MASTER_PHONE, {
        ...state.data,
        name: text,
      });

      await ctx.reply("Telefon raqamingizni yuboring. Masalan: +998901234567", phoneKeyboard);
      break;
    }

    case STEPS.MASTER_PHONE: {
      if (!isValidPhone(text)) {
        await ctx.reply("Telefon raqam noto'g'ri. Masalan: +998901234567 ko'rinishida yuboring.");
        return;
      }

      setState(userId, STEPS.MASTER_SERVICE, {
        ...state.data,
        phone: normalizePhone(text),
      });

      await ctx.reply("Telefon raqamingiz qabul qilindi.", Markup.removeKeyboard());
      await ctx.reply("🧰 Qaysi xizmat turini ko'rsatasiz?", serviceKeyboard);
      break;
    }

    case STEPS.MASTER_SERVICE: {
      if (text === SERVICE_BACK) {
        clearState(userId);
        await ctx.reply("Asosiy menyuga qaytdingiz.", Markup.removeKeyboard());
        await showMainMenu(ctx);
        return;
      }

      const service = getServiceValue(text);
      if (!serviceTypes.includes(service)) {
        await ctx.reply("Iltimos, xizmat turini faqat tugmalardan tanlang.", serviceKeyboard);
        return;
      }

      setState(userId, STEPS.MASTER_REGION, {
        ...state.data,
        service,
      });

      await ctx.reply("📍 Qaysi hududda ishlaysiz?", regionKeyboard);
      break;
    }

    case STEPS.MASTER_REGION: {
      if (text === SERVICE_BACK) {
        setState(userId, STEPS.MASTER_SERVICE, state.data);
        await ctx.reply("🧰 Xizmat turini tanlang:", serviceKeyboard);
        return;
      }

      if (!regionTypes.includes(text)) {
        await ctx.reply("Iltimos, hududni faqat tugmalardan tanlang.", regionKeyboard);
        return;
      }

      setState(userId, STEPS.MASTER_DISTRICT, {
        ...state.data,
        region: text,
      });

      await ctx.reply(`📍 ${text} bo'yicha tuman/shaharni tanlang:`, districtKeyboard(text));
      break;
    }

    case STEPS.MASTER_DISTRICT: {
      if (text === SERVICE_BACK) {
        setState(userId, STEPS.MASTER_REGION, {
          name: state.data.name,
          phone: state.data.phone,
          service: state.data.service,
        });
        await ctx.reply("📍 Hududni qayta tanlang:", regionKeyboard);
        return;
      }

      const districts = districtTypes[state.data.region] || [];
      if (!districts.includes(text)) {
        await ctx.reply("Iltimos, tuman/shaharni faqat tugmalardan tanlang.", districtKeyboard(state.data.region));
        return;
      }

      const data = {
        ...state.data,
        district: text,
      };

      setState(userId, STEPS.MASTER_CONFIRM, data);
      await ctx.reply("Hudud tanlandi.", Markup.removeKeyboard());
      await ctx.reply(buildMasterSummary(data), confirmKeyboard);
      break;
    }

    case STEPS.MASTER_CONFIRM: {
      await ctx.reply("Iltimos, arizani yuborish uchun tasdiqlash tugmasini bosing.", confirmKeyboard);
      break;
    }

    case STEPS.CONTACT_MESSAGE: {
      const header =
        "👨‍💼 <b>Admin bilan bog'lanish</b>\n\n" +
        `👤 <b>User:</b> ${escapeHtml(ctx.from.first_name || "Noma'lum")}\n` +
        `💬 <b>Telegram:</b> ${escapeHtml(username(ctx))}\n` +
        `🆔 <b>User ID:</b> <code>${userId}</code>\n\n` +
        `<b>Xabar:</b>\n${escapeHtml(text)}`;

      const sent = await safeSendToAdmin(header);
      clearState(userId);

      await ctx.reply(
        sent ? "Xabaringiz adminga yuborildi. Tez orada javob beramiz." : "Kechirasiz, xabar yuborilmadi. Keyinroq urinib ko'ring.",
        Markup.removeKeyboard()
      );
      await showMainMenu(ctx, "Yana qanday yordam bera olamiz?");
      break;
    }

    case STEPS.PROBLEM_MESSAGE: {
      const header =
        "⚠️ <b>Yangi muammo xabari</b>\n\n" +
        `👤 <b>User:</b> ${escapeHtml(ctx.from.first_name || "Noma'lum")}\n` +
        `💬 <b>Telegram:</b> ${escapeHtml(username(ctx))}\n` +
        `🆔 <b>User ID:</b> <code>${userId}</code>\n\n` +
        `<b>Muammo:</b>\n${escapeHtml(text)}`;

      const sent = await safeSendToAdmin(header);
      clearState(userId);

      await ctx.reply(
        sent ? "Muammo xabaringiz adminga yuborildi. Rahmat!" : "Kechirasiz, muammo xabari yuborilmadi. Keyinroq urinib ko'ring.",
        Markup.removeKeyboard()
      );
      await showMainMenu(ctx, "Yana qanday yordam bera olamiz?");
      break;
    }

    default:
      clearState(userId);
      await showMainMenu(ctx, "Jarayon qayta boshlandi. Kerakli bo'limni tanlang:");
  }
});

bot.on("message", async (ctx) => {
  const state = userStates.get(ctx.from.id);

  if (!state) {
    await showMainMenu(ctx, "Iltimos, menyudan birini tanlang:");
    return;
  }

  if (state.step === STEPS.ORDER_MEDIA) {
    const hasMedia = Boolean(ctx.message.photo || ctx.message.video);
    if (!hasMedia) {
      await ctx.reply("Iltimos, rasm/video yuboring yoki o'tkazib yuborish tugmasini bosing.", mediaKeyboard);
      return;
    }

    const data = {
      ...state.data,
      media: {
        messageId: ctx.message.message_id,
        type: ctx.message.photo ? "photo" : "video",
      },
    };

    setState(ctx.from.id, STEPS.ORDER_CONFIRM, data);
    await ctx.reply("Media qabul qilindi.", Markup.removeKeyboard());
    await ctx.reply(buildOrderSummary(data), orderConfirmKeyboard);
    return;
  }

  if (state.step === STEPS.ORDER_DETAILS) {
    await ctx.reply("Iltimos, muammo haqida matn ko'rinishida yozing.");
    return;
  }

  if (state.step === STEPS.CONTACT_MESSAGE) {
    const sent = await safeForwardToAdmin(ctx);
    clearState(ctx.from.id);
    await ctx.reply(sent ? "Xabaringiz adminga forward qilindi." : "Kechirasiz, xabar yuborilmadi.", Markup.removeKeyboard());
    await showMainMenu(ctx, "Yana qanday yordam bera olamiz?");
    return;
  }

  if (state.step === STEPS.PROBLEM_MESSAGE) {
    const sent = await safeForwardToAdmin(ctx);
    clearState(ctx.from.id);
    await ctx.reply(sent ? "Muammo xabaringiz adminga yuborildi." : "Kechirasiz, xabar yuborilmadi.", Markup.removeKeyboard());
    await showMainMenu(ctx, "Yana qanday yordam bera olamiz?");
    return;
  }

  await ctx.reply("Iltimos, matn ko'rinishida javob yuboring.");
});

bot.catch((error, ctx) => {
  console.error(`Bot xatoligi. Update ID: ${ctx.update?.update_id}`, error);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

async function configureBotCommands() {
  await bot.telegram.setMyCommands(USER_COMMANDS);
  await bot.telegram.setMyCommands(ADMIN_COMMANDS, {
    scope: {
      type: "chat",
      chat_id: ADMIN_ID,
    },
  });
}

configureBotCommands()
  .then(() => bot.launch(() => {
    console.log("TeskorUsta24 bot ishga tushdi.");
  }))
  .catch((error) => {
    console.error("Bot menyusini sozlashda xatolik:", error);
    process.exit(1);
  });
