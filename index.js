const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const SALES_CHANNEL_ID = '1475643785307492557';

const CHATTERS = {
  '1':  { name: 'Daniel', channelId: '1475713586751078410' },
  '2':  { name: 'Moucheflick', channelId: '1475713536587206788' },
  '3':  { name: 'Dim Codjo',   channelId: '1475713663838195826' },
  '4':  { name: 'Donas',       channelId: '1475713693764288717' },
  '5':  { name: 'Elodie',      channelId: '1475713722122108969' },
  '6':  { name: 'François',    channelId: '1475713754346815559' },
  '7':  { name: 'Hélène',      channelId: '1475713792967970980' },
  '8':  { name: 'Junior',      channelId: '1475713819220250674' },
  '9':  { name: 'Justin',      channelId: '1475713894142972036' },
  '10': { name: 'Rozen',       channelId: '1475713925227216916' },
  '11': { name: 'Manel',       channelId: '1475713960287146128' },
  '12': { name: 'Salomon',     channelId: '1475713987973877886' },
  '13': { name: 'Canal', channelId: '1475722814320283812' }
};

const SALES_FILE = 'sales.json';

function loadSales() {
  if (fs.existsSync(SALES_FILE)) return JSON.parse(fs.readFileSync(SALES_FILE, 'utf8'));
  return [];
}

function saveSales(sales) {
  fs.writeFileSync(SALES_FILE, JSON.stringify(sales, null, 2));
}

client.on('ready', () => {
  console.log(`Bot connecté : ${client.user.tag}`);
  scheduleWeeklyRecap();
});

client.on('messageCreate', async (message) => {
  if (message.channelId !== SALES_CHANNEL_ID) return;
 if (!message.content.includes('New payment received')) return;
  if (!message.webhookId) return;

  const rows = [];
  const keys = Object.keys(CHATTERS);
  for (let i = 0; i < keys.length; i += 4) {
    const row = new ActionRowBuilder();
    keys.slice(i, i + 4).forEach(key => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`claim_${key}_${message.id}`)
          .setLabel(CHATTERS[key].name)
          .setStyle(ButtonStyle.Primary)
      );
    });
    rows.push(row);
  }

  await message.reply({ content: '👆 Qui claim cette vente ?', components: rows });
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const parts = interaction.customId.split('_');
  if (parts[0] !== 'claim') return;

  const chatterId = parts[1];
  const messageId = parts[2];
  const chatter = CHATTERS[chatterId];
  if (!chatter) return;

  const originalMessage = await interaction.channel.messages.fetch(messageId);
  const content = originalMessage.content;

  const match = content.match(/\*\*Montant :\*\* ([\d.,]+ EUR)/);
  const montant = match ? match[1] : 'inconnu';

  const sales = loadSales();
  sales.push({
    chatterName: chatter.name,
    montant,
    date: new Date().toISOString()
  });
  saveSales(sales);

  const chatterChannel = await client.channels.fetch(chatter.channelId);
  await chatterChannel.send(`✅ Vente claimée par **${chatter.name}** !\n${content}`);

  await interaction.update({ content: `✅ Claimée par **${chatter.name}** !`, components: [] });
});

function scheduleWeeklyRecap() {
  setInterval(async () => {
    const now = new Date();
    if (now.getDay() === 1 && now.getHours() === 9 && now.getMinutes() < 5) {
      const sales = loadSales();
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const weeklySales = sales.filter(s => new Date(s.date) > oneWeekAgo);

      const recap = {};
      weeklySales.forEach(sale => {
        if (!recap[sale.chatterName]) recap[sale.chatterName] = { count: 0, total: 0 };
        recap[sale.chatterName].count++;
        const amount = parseFloat(sale.montant.replace(',', '.'));
        if (!isNaN(amount)) recap[sale.chatterName].total += amount;
      });

      let msg = '📊 **Récap hebdomadaire des ventes**\n\n';
      Object.entries(recap).sort((a, b) => b[1].total - a[1].total).forEach(([name, data]) => {
        msg += `**${name}** : ${data.count} vente(s) → ${data.total.toFixed(2)} EUR\n`;
      });

      const salesChannel = await client.channels.fetch(SALES_CHANNEL_ID);
      await salesChannel.send(msg);
    }
  }, 5 * 60 * 1000);
}

client.login(process.env.DISCORD_TOKEN);
