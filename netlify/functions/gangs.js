const { getSessionUser, dataStore, json } = require('./utils/auth');

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

      const gang = { id: 'g_' + Date.now(), name, points: 0, founderId: user.id, members: [user.id] };
      gangs.push(gang);
      me.gangId = gang.id;
      await store.setJSON('gangs', gangs);
      await store.setJSON('users', users);
      return json(200, { ok: true });
    }

    if (body.action === 'join') {
      if (me.gangId) return json(400, { error: 'Você já está em uma gang.' });
      const gang = gangs.find((g) => g.id === body.gangId);
      if (!gang) return json(400, { error: 'Gang não encontrada.' });
      gang.members.push(user.id);
      me.gangId = gang.id;
      await store.setJSON('gangs', gangs);
      await store.setJSON('users', users);
      return json(200, { ok: true });
    }

    if (body.action === 'leave') {
      const gang = gangs.find((g) => g.id === me.gangId);
      if (gang) gang.members = gang.members.filter((id) => id !== user.id);
      me.gangId = null;
      await store.setJSON('gangs', gangs);
      await store.setJSON('users', users);
      return json(200, { ok: true });
    }

    return json(400, { error: 'Ação inválida.' });
  }

  return json(405, { error: 'Método não permitido.' });
};
