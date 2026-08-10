const nacl = require('tweetnacl');
const { getStore } = require('@netlify/blobs');

const DEFAULT_EVENTS = [
  { id: 'ev1', title: 'Torneio de Verão', date: '2026-08-15T20:00:00-03:00', description: 'Chaveamento 3v3, eliminação dupla. Premiação em destaque no hub para o time campeão.', capacity: 32 },
  { id: 'ev2', title: 'Brawl: Kurogami vs Akatsuba', date: '2026-08-16T19:00:00-03:00', description: 'Confronto direto entre as duas gangs no topo do ranking. Transmissão ao vivo no Discord.', capacity: 20 },
  { id: 'ev3', title: 'Ranked Reset — Temporada 4', date: '2026-08-17T00:00:00-03:00', description: 'Reinício de pontuação geral. Os top 10 da temporada anterior recebem selo especial no perfil.', capacity: 999 },
];

function json(obj) {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
function reply(content, ephemeral) {
  return json({ type: 4, data: { content, flags: ephemeral ? 64 : undefined } });
}
function getOpt(interaction, name) {
  const opts = (interaction.data && interaction.data.options) || [];
  const found = opts.find((o) => o.name === name);
  return found ? found.value : undefined;
}
function isAdmin(interaction) {
  const roles = (interaction.member && interaction.member.roles) || [];
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  if (!adminRoleId) return false;
  return roles.includes(adminRoleId);
}
function dataStore() {
  return getStore({
    name: 'gakuran-data',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN,
  });
}

async function loadUsers(s) {
  return (await s.get('users', { type: 'json' })) || {};
}
async function loadGangs(s) {
  return (await s.get('gangs', { type: 'json' })) || [];
}
async function loadEvents(s) {
  let events = await s.get('events', { type: 'json' });
  if (!events) {
    events = DEFAULT_EVENTS.map((e) => ({ ...e, registered: [] }));
    await s.setJSON('events', events);
  }
  return events;
}

/* ---------------- comandos ---------------- */

async function cmdPerfil(interaction) {
  const s = store();
  const users = await loadUsers(s);
  const gangs = await loadGangs(s);
  const targetId = getOpt(interaction, 'usuario') || interaction.member.user.id;
  const user = users[targetId];

  if (!user) {
    return reply('Esse jogador ainda não tem perfil no hub. Ele precisa entrar pelo site (login com Discord) pelo menos uma vez.', true);
  }

  const gang = user.gangId ? gangs.find((g) => g.id === user.gangId) : null;
  const text =
    `**Perfil InHouse — ${user.username}**\n` +
    `🏆 Pontos: **${user.points || 0}**\n` +
    `✅ Vitórias: **${user.wins || 0}**  ❌ Derrotas: **${user.losses || 0}**\n` +
    `⚔️ Gang: **${gang ? gang.name : 'Nenhuma'}**`;
  return reply(text);
}

async function cmdRanking(interaction) {
  const s = store();
  const users = await loadUsers(s);
  const list = Object.values(users)
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, 10);

  if (!list.length) return reply('Ainda não há jogadores no ranking.');

  const medals = ['🥇', '🥈', '🥉'];
  const lines = list.map((u, i) => `${medals[i] || `**${i + 1}.**`} ${u.username} — ${u.points || 0} pts`);
  return reply(`**Top 10 — Ranking InHouse Gakuran BR**\n\n${lines.join('\n')}`);
}

async function cmdGangue(interaction) {
  const s = store();
  const users = await loadUsers(s);
  const gangs = await loadGangs(s);
  const nome = getOpt(interaction, 'nome');

  let gang;
  if (nome) {
    gang = gangs.find((g) => g.name.toLowerCase() === String(nome).toLowerCase());
    if (!gang) return reply(`Nenhuma gang encontrada com o nome "${nome}".`, true);
  } else {
    const me = users[interaction.member.user.id];
    if (!me || !me.gangId) return reply('Você não está em nenhuma gang. Use `/gangue nome:` pra ver outra, ou entre em uma pelo site.', true);
    gang = gangs.find((g) => g.id === me.gangId);
  }

  const founder = users[gang.founderId];
  const memberNames = gang.members.map((id) => (users[id] ? users[id].username : id)).join(', ');
  const text =
    `**Gang: ${gang.name}**\n` +
    `👑 Fundador: ${founder ? founder.username : '—'}\n` +
    `🏆 Pontos: **${gang.points || 0}**\n` +
    `👥 Membros (${gang.members.length}): ${memberNames || '—'}`;
  return reply(text);
}

async function cmdEventos() {
  const s = store();
  const events = await loadEvents(s);
  if (!events.length) return reply('Nenhum evento cadastrado no momento.');

  const lines = events.map((e) => {
    const data = new Date(e.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    return `**${e.title}** — ${data}\n${e.description}\n📋 ${e.registered.length}/${e.capacity} inscritos\n`;
  });
  return reply(`**Eventos do GBR·HUB**\n\n${lines.join('\n')}`);
}

function cmdAjuda() {
  const text =
    `**Comandos do GBR·HUB**\n\n` +
    `\`/perfil [usuario]\` — mostra o perfil InHouse de um jogador\n` +
    `\`/ranking\` — top 10 do ranking InHouse\n` +
    `\`/gangue [nome]\` — mostra informações de uma gang (ou a sua)\n` +
    `\`/eventos\` — lista os eventos do hub\n` +
    `\`/ajuda\` — mostra esta mensagem\n\n` +
    `**Admin**\n` +
    `\`/anunciar canal mensagem\` — publica um comunicado em um canal\n` +
    `\`/banir usuario [motivo] [desbanir]\` — bane ou desbane um jogador do servidor\n` +
    `\`/updateall\` — recalcula pontos de todas as gangs (comando de emergência)`;
  return reply(text);
}

async function cmdAnunciar(interaction) {
  if (!isAdmin(interaction)) return reply('Você não tem permissão pra usar esse comando.', true);

  const canalId = getOpt(interaction, 'canal');
  const mensagem = getOpt(interaction, 'mensagem');

  const res = await fetch(`https://discord.com/api/v10/channels/${canalId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: `📢 **Aviso**\n${mensagem}` }),
  });

  if (!res.ok) return reply('Não consegui publicar nesse canal. Verifique se o bot tem permissão de enviar mensagens lá.', true);
  return reply(`Anúncio publicado em <#${canalId}>.`, true);
}

async function cmdBanir(interaction) {
  if (!isAdmin(interaction)) return reply('Você não tem permissão pra usar esse comando.', true);

  const usuarioId = getOpt(interaction, 'usuario');
  const motivo = getOpt(interaction, 'motivo') || 'Sem motivo informado';
  const desbanir = getOpt(interaction, 'desbanir') || false;
  const guildId = process.env.DISCORD_GUILD_ID;

  const url = `https://discord.com/api/v10/guilds/${guildId}/bans/${usuarioId}`;
  const res = await fetch(url, {
    method: desbanir ? 'DELETE' : 'PUT',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Audit-Log-Reason': encodeURIComponent(motivo),
    },
    body: desbanir ? undefined : JSON.stringify({}),
  });

  if (!res.ok) return reply('Não consegui completar a ação. Verifique se o bot tem permissão "Banir Membros" e um cargo acima do alvo.', true);
  return reply(desbanir ? `<@${usuarioId}> foi desbanido.` : `<@${usuarioId}> foi banido. Motivo: ${motivo}`, true);
}

async function cmdUpdateall(interaction) {
  if (!isAdmin(interaction)) return reply('Você não tem permissão pra usar esse comando.', true);

  const s = store();
  const users = await loadUsers(s);
  const gangs = await loadGangs(s);

  gangs.forEach((g) => {
    g.points = g.members.reduce((sum, id) => sum + ((users[id] && users[id].points) || 0), 0);
  });
  await s.setJSON('gangs', gangs);

  return reply(`Ranking recalculado. ${gangs.length} gang(s) atualizadas com base nos pontos atuais dos membros.`, true);
}

/* ---------------- roteador ---------------- */

async function handleCommand(interaction) {
  const name = interaction.data.name;
  try {
    switch (name) {
      case 'perfil': return await cmdPerfil(interaction);
      case 'ranking': return await cmdRanking(interaction);
      case 'gangue': return await cmdGangue(interaction);
      case 'eventos': return await cmdEventos();
      case 'ajuda': return cmdAjuda();
      case 'anunciar': return await cmdAnunciar(interaction);
      case 'banir': return await cmdBanir(interaction);
      case 'updateall': return await cmdUpdateall(interaction);
      default: return reply('Comando não reconhecido.', true);
    }
  } catch (e) {
    return reply('Deu erro ao processar esse comando: ' + e.message, true);
  }
}

/* ---------------- handler principal ---------------- */

exports.handler = async (event) => {
  const sig = event.headers['x-signature-ed25519'];
  const ts = event.headers['x-signature-timestamp'];
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;

  if (!sig || !ts || !rawBody) {
    return { statusCode: 401, body: 'invalid request signature' };
  }

  let validSig = false;
  try {
    validSig = nacl.sign.detached.verify(
      Buffer.from(ts + rawBody),
      Buffer.from(sig, 'hex'),
      Buffer.from(process.env.DISCORD_PUBLIC_KEY, 'hex')
    );
  } catch (e) {
    validSig = false;
  }

  if (!validSig) {
    return { statusCode: 401, body: 'invalid request signature' };
  }

  const interaction = JSON.parse(rawBody);

  if (interaction.type === 1) {
    return json({ type: 1 }); // PONG — necessário pra Discord validar a Interactions Endpoint URL
  }

  if (interaction.type === 2) {
    return await handleCommand(interaction);
  }

  return json({ type: 4, data: { content: 'Tipo de interação não suportado.' } });
};
