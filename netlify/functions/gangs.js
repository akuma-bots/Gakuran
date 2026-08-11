const { getSessionUser, dataStore, json } = require('./utils/auth');

async function sendDM(userId, content) {
  try {
    const chRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient_id: userId }),
    });
    if (!chRes.ok) return false;
    const channel = await chRes.json();

    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });
    return msgRes.ok;
  } catch (e) {
    return false;
  }
}

function isLeaderOrVice(gang, userId) {
  return gang.founderId === userId || gang.viceId === userId;
}

exports.handler = async (event) => {
  const user = await getSessionUser(event);
  if (!user) return json(401, { error: 'Não autenticado.' });

  const store = dataStore();
  let gangs = (await store.get('gangs', { type: 'json' })) || [];

  if (event.httpMethod === 'GET') {
    const sorted = [...gangs].sort((a, b) => b.points - a.points);
    return json(200, { gangs: sorted, userId: user.id, userGangId: user.gangId || null });
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const users = (await store.get('users', { type: 'json' })) || {};
    const me = users[user.id];

    if (body.action === 'create') {
      if (me.gangId) return json(400, { error: 'Você já está em uma gang.' });
      const name = (body.name || '').trim();
      if (name.length < 3) return json(400, { error: 'O nome precisa ter pelo menos 3 caracteres.' });
      if (gangs.some((g) => g.name.toLowerCase() === name.toLowerCase()))
        return json(400, { error: 'Já existe uma gang com esse nome.' });

      const gang = {
        id: 'g_' + Date.now(),
        name,
        icon: (body.icon || '⚔️').slice(0, 4),
        points: 0,
        founderId: user.id,
        viceId: null,
        members: [user.id],
        discordInvite: null,
        lastAnnounceAt: null,
        joinRequests: [],
      };
      gangs.push(gang);
      me.gangId = gang.id;
      await store.setJSON('gangs', gangs);
      await store.setJSON('users', users);
      return json(200, { ok: true });
    }

    if (body.action === 'requestJoin') {
      if (me.gangId) return json(400, { error: 'Você já está em uma gang.' });
      const gang = gangs.find((g) => g.id === body.gangId);
      if (!gang) return json(400, { error: 'Gang não encontrada.' });
      if (!gang.joinRequests) gang.joinRequests = [];
      if (gang.joinRequests.includes(user.id)) return json(400, { error: 'Você já pediu pra entrar nessa gang.' });

      gang.joinRequests.push(user.id);
      await store.setJSON('gangs', gangs);

      const notifyIds = [gang.founderId, gang.viceId].filter(Boolean);
      for (const nId of notifyIds) {
        const target = users[nId];
        if (target && !target.dmOptOut) {
          await sendDM(nId, `📥 **${user.username}** pediu pra entrar na gang **${gang.name}**. Aprove ou recuse pelo site, na página da sua gang.`);
        }
      }
      return json(200, { ok: true });
    }

    if (body.action === 'approveJoin' || body.action === 'rejectJoin') {
      const gang = gangs.find((g) => g.id === me.gangId);
      if (!gang) return json(400, { error: 'Você não lidera nenhuma gang.' });
      if (!isLeaderOrVice(gang, user.id)) return json(403, { error: 'Só o líder ou vice podem fazer isso.' });

      const targetId = body.userId;
      gang.joinRequests = (gang.joinRequests || []).filter((id) => id !== targetId);

      if (body.action === 'approveJoin') {
        if (users[targetId] && !users[targetId].gangId) {
          gang.members.push(targetId);
          users[targetId].gangId = gang.id;
        }
      }

      await store.setJSON('gangs', gangs);
      await store.setJSON('users', users);
      return json(200, { ok: true });
    }

    if (body.action === 'leave') {
      const gang = gangs.find((g) => g.id === me.gangId);
      if (gang) {
        gang.members = gang.members.filter((id) => id !== user.id);
        if (gang.viceId === user.id) gang.viceId = null;
      }
      me.gangId = null;
      await store.setJSON('gangs', gangs);
      await store.setJSON('users', users);
      return json(200, { ok: true });
    }

    if (body.action === 'setVice') {
      const gang = gangs.find((g) => g.id === me.gangId);
      if (!gang) return json(400, { error: 'Você não está em uma gang.' });
      if (gang.founderId !== user.id) return json(403, { error: 'Só o líder pode definir o vice.' });
      if (body.userId && !gang.members.includes(body.userId))
        return json(400, { error: 'Esse jogador não é membro da gang.' });

      gang.viceId = body.userId || null;
      await store.setJSON('gangs', gangs);
      return json(200, { ok: true });
    }

    if (body.action === 'update') {
      const gang = gangs.find((g) => g.id === me.gangId);
      if (!gang) return json(400, { error: 'Você não está em uma gang.' });
      if (!isLeaderOrVice(gang, user.id)) return json(403, { error: 'Só o líder ou vice podem editar a gang.' });

      if (body.name) {
        const name = body.name.trim();
        if (name.length < 3) return json(400, { error: 'O nome precisa ter pelo menos 3 caracteres.' });
        if (gangs.some((g) => g.id !== gang.id && g.name.toLowerCase() === name.toLowerCase()))
          return json(400, { error: 'Já existe uma gang com esse nome.' });
        gang.name = name;
      }
      if (body.icon) gang.icon = String(body.icon).slice(0, 4);
      if (body.discordInvite !== undefined) gang.discordInvite = body.discordInvite ? String(body.discordInvite).trim() : null;

      await store.setJSON('gangs', gangs);
      return json(200, { ok: true });
    }

    if (body.action === 'announce') {
      const gang = gangs.find((g) => g.id === me.gangId);
      if (!gang) return json(400, { error: 'Você não está em uma gang.' });
      if (gang.founderId !== user.id) return json(403, { error: 'Só o líder pode reenviar o anúncio.' });
      if (!gang.discordInvite) return json(400, { error: 'Sua gang ainda não tem um convite do Discord cadastrado.' });

      const cooldownMs = 60 * 60 * 1000;
      if (gang.lastAnnounceAt && Date.now() - gang.lastAnnounceAt < cooldownMs) {
        const waitMin = Math.ceil((cooldownMs - (Date.now() - gang.lastAnnounceAt)) / 60000);
        return json(400, { error: `Aguarde mais ${waitMin} min pra reenviar o anúncio.` });
      }

      const canalId = body.channelId;
      if (!canalId) return json(400, { error: 'Informe o canal.' });

      const res = await fetch(`https://discord.com/api/v10/channels/${canalId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `${gang.icon} **${gang.name}** está recrutando! Entre no Discord da gang: ${gang.discordInvite}`,
        }),
      });
      if (!res.ok) return json(400, { error: 'Não consegui publicar nesse canal.' });

      gang.lastAnnounceAt = Date.now();
      await store.setJSON('gangs', gangs);
      return json(200, { ok: true });
    }

    return json(400, { error: 'Ação inválida.' });
  }

  return json(405, { error: 'Método não permitido.' });
};
