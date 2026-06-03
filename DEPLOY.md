# Cookie Bot Deployment

## 1. Prepare the server

- Ubuntu 22.04 or newer is recommended.
- Install Node.js 22 LTS.
- Install PM2 globally with `npm install -g pm2`.

## 2. Upload the project

Clone or upload this project to the server, then move into the project directory.

## 3. Configure secrets

Create a `.env` file in the project root:

```env
BOT_TOKEN=your_new_discord_bot_token
```

Important:

- Reissue the bot token in the Discord Developer Portal before deploying.
- The previous token was stored in `config.json`, so treat it as exposed.

## 4. Install dependencies

```bash
npm install
```

## 5. Start the bot

For a quick test:

```bash
npm start
```

For permanent operation with auto-restart:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 6. Open after reboot

After server restart, PM2 brings `cookie-bot` back automatically.

Check status with:

```bash
pm2 status
pm2 logs cookie-bot
```

## Notes

- `config.json` stores server-specific IDs and can still be updated by bot commands.
- `data.json` stores runtime state, so keep it writable on the server.
- This bot is better on a VPS than serverless hosting because it uses long-running Discord sessions and periodic jobs.
