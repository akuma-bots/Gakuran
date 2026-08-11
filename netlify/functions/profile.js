const { getSessionUser, dataStore, json } = require('./utils/auth');

exports.handler = async (event) => {
  const user = await getSessionUser(event);
  if (!user) return json(401, { error: 'Não autenticado.' });

  if (event.httpMethod === 'GET') {
    return json(200, { user });
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const store = dataStore();
    const users = (await store.get('users', { type: 'json' })) || {};
    const me = users[user.id];

    if (body.action === 'toggleDm') {
      me.dmOptOut = !!body.value;
      await store.setJSON('users', users);
      return json(200, { ok: true, dmOptOut: me.dmOptOut });
    }

    return json(400, { error: 'Ação inválida.' });
  }

  return json(405, { error: 'Método não permitido.' });
};
