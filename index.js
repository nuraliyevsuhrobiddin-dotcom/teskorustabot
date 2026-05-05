require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID || 123456789);

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

const BOT_COMMANDS = [
  { command: "start", description: "Botni qayta boshlash" },
  { command: "menu", description: "Asosiy menyuni ochish" },
];

const ACTIONS = {
  BECOME_MASTER: "become_master",
  CONTACT_ADMIN: "contact_admin",
  REPORT_PROBLEM: "report_problem",
  CONFIRM_MASTER: "confirm_master",
  CANCEL: "cancel",
};

const STEPS = {
  MASTER_NAME: "master_name",
  MASTER_PHONE: "master_phone",
  MASTER_SERVICE: "master_service",
  MASTER_REGION: "master_region",
  MASTER_CONFIRM: "master_confirm",
  CONTACT_MESSAGE: "contact_message",
  PROBLEM_MESSAGE: "problem_message",
};

const serviceTypes = [
  "Elektrik",
  "Santexnik",
  "Konditsioner",
];

const serviceOptions = [
  { label: "⚡ Elektrik", value: "Elektrik" },
  { label: "🚿 Santexnik", value: "Santexnik" },
  { label: "❄️ Konditsioner", value: "Konditsioner" },
];

const mainMenu = Markup.inlineKeyboard([
  [Markup.button.callback("🧰 Usta bo'lish", ACTIONS.BECOME_MASTER)],
  [Markup.button.callback("💬 Admin bilan bog'lanish", ACTIONS.CONTACT_ADMIN)],
  [Markup.button.callback("🚨 Muammo yozish", ACTIONS.REPORT_PROBLEM)],
]);

const cancelKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("❌ Bekor qilish", ACTIONS.CANCEL)],
]);

const confirmKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("✅ Tasdiqlash", ACTIONS.CONFIRM_MASTER)],
  [Markup.button.callback("❌ Bekor qilish", ACTIONS.CANCEL)],
]);

const serviceKeyboard = Markup.keyboard([
  [serviceOptions[0].label, serviceOptions[1].label],
  [serviceOptions[2].label],
])
  .oneTime()
  .resize();

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

function buildMasterSummary(data) {
  return (
    "📋 Arizangizni tekshiring:\n\n" +
    `👤 Ism: ${data.name}\n` +
    `📞 Telefon: ${data.phone}\n` +
    `🧰 Xizmat turi: ${data.service}\n` +
    `📍 Hudud: ${data.region}\n\n` +
    "Ma'lumotlar to'g'ri bo'lsa tasdiqlang:"
  );
}

function buildMasterAdminMessage(data, ctx) {
  return (
    "🛠 <b>Yangi usta arizasi</b>\n\n" +
    `👤 <b>Ism:</b> ${escapeHtml(data.name)}\n` +
    `📞 <b>Telefon:</b> ${escapeHtml(data.phone)}\n` +
    `🔧 <b>Xizmat turi:</b> ${escapeHtml(data.service)}\n` +
    `📍 <b>Hudud:</b> ${escapeHtml(data.region)}\n` +
    `💬 <b>Telegram:</b> ${escapeHtml(username(ctx))}\n` +
    `🆔 <b>User ID:</b> <code>${ctx.from.id}</code>`
  );
}

bot.start(async (ctx) => {
  await resetAndShowMainMenu(ctx);
});

bot.command("menu", async (ctx) => {
  await resetAndShowMainMenu(ctx);
});

bot.action(ACTIONS.CANCEL, async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("Bekor qilindi.", Markup.removeKeyboard());
  clearState(ctx.from.id);
  await showMainMenu(ctx);
});

bot.action(ACTIONS.CONFIRM_MASTER, async (ctx) => {
  await ctx.answerCbQuery();

  const state = userStates.get(ctx.from.id);
  if (!state || state.step !== STEPS.MASTER_CONFIRM) {
    await showMainMenu(ctx, "Iltimos, menyudan qayta boshlang:");
    return;
  }

  const sent = await safeSendToAdmin(buildMasterAdminMessage(state.data, ctx));
  clearState(ctx.from.id);

  if (!sent) {
    await ctx.reply("Kechirasiz, so'rovingizni adminga yuborishda xatolik bo'ldi. Keyinroq urinib ko'ring.", Markup.removeKeyboard());
    return;
  }

  await ctx.reply("👉 Rahmat! Sizning so'rovingiz yuborildi", Markup.removeKeyboard());
  await showMainMenu(ctx, "Yana qanday yordam bera olamiz?");
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

  await ctx.reply("Qaysi hududda ishlaysiz? Masalan: Toshkent, Chilonzor", cancelKeyboard);
});

bot.on("contact", async (ctx) => {
  const state = userStates.get(ctx.from.id);

  if (!state || state.step !== STEPS.MASTER_PHONE) {
    await ctx.reply("Telefon raqam qabul qilindi, ammo hozir ro'yxatdan o'tish jarayoni aktiv emas.");
    return;
  }

  const contact = ctx.message.contact;
  if (contact.user_id !== ctx.from.id) {
    await ctx.reply("Iltimos, faqat o'zingizning Telegram raqamingizni yuboring.", phoneKeyboard);
    return;
  }

  const phone = contact.phone_number;
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
      const service = getServiceValue(text);
      if (!serviceTypes.includes(service)) {
        await ctx.reply("Iltimos, xizmat turini faqat tugmalardan tanlang.", serviceKeyboard);
        return;
      }

      setState(userId, STEPS.MASTER_REGION, {
        ...state.data,
        service,
      });

      await ctx.reply("Qaysi hududda ishlaysiz? Masalan: Toshkent, Chilonzor", Markup.removeKeyboard());
      await ctx.reply("Hududni yozing:", cancelKeyboard);
      break;
    }

    case STEPS.MASTER_REGION: {
      if (text.length < 2) {
        await ctx.reply("Iltimos, hududni to'g'ri kiriting:");
        return;
      }

      const data = {
        ...state.data,
        region: text,
      };

      setState(userId, STEPS.MASTER_CONFIRM, data);
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

bot.telegram.setMyCommands(BOT_COMMANDS)
  .then(() => bot.launch(() => {
    console.log("TeskorUsta24 bot ishga tushdi.");
  }))
  .catch((error) => {
    console.error("Bot menyusini sozlashda xatolik:", error);
    process.exit(1);
  });
