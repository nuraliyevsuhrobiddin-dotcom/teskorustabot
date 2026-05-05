# TeskorUsta24 Telegram Bot

Admin bilan bog'lanish, muammo yuborish va ustalarni ro'yxatga olish uchun Telegram bot.

## Ishga tushirish

1. Paketlarni o'rnating:

```bash
npm install
```

2. `.env.example` fayldan `.env` yarating:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. `.env` ichiga bot tokeningizni yozing:

```env
BOT_TOKEN=PASTE_YOUR_TELEGRAM_BOT_TOKEN_HERE
ADMIN_ID=123456789
```

4. Botni ishga tushiring:

```bash
npm start
```

Development rejimida:

```bash
npm run dev
```

## Bot funksiyalari

- `/start` va `/menu` orqali chiroyli inline menu.
- `Usta bo'lish` flow:
  - ism
  - telefon
  - xizmat turi
  - hudud
- Telefon raqam validatsiyasi.
- Admin bilan bog'lanish.
- Muammo yozish.
- Har bir user uchun alohida step-by-step state.
- Xatoliklar `console.error` orqali log qilinadi.

## Admin ID

Default admin ID:

```js
ADMIN_ID = 123456789
```

Uni `.env` orqali o'zgartirish mumkin.
