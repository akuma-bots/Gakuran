const { getSessionUser, dataStore, json } = require('./utils/auth');

const QUEUE_DEFS = [
  { id: 'patio3v3', label: '3v3 — Pátio Central', capacity: 6 },
  { id: 'corredor5v5', label: '5v5 — Corredor B', capacity: 10 },
  { id: 'telhado1v1', label: '1v1 — Telhado', capacity: 2 },
];

async function loadData(store) {
  const queues = (await store.get('inhouse-queues', { type: 'json' })) || {};
  const matches = (await store.get('inhouse-matches', { type: 'json' })) || [];
  const history = (await store.get('inhouse-history', { type: 'json' })) || [];
  QUEUE_DEFS.forEach((q) => {
    if (!queues[q.id]) queues[q.id] = [];
  });
  return { queues, matches, history };
}

exports.handler = async (event) => {
  const user = await getSessionUser(event);
  if (!user) return json(401, { error: 'Não autenticado.' });

  const store = dataStore();

  if (event.httpMethod === 'GET') {
    const { queues, matches, history } = await loadData(store);
    return json(200, { queueDefs: QUEUE_DEFS, queues, matches, history, userId: user.id });
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const { queues, matches, history } = await loadData(store);

    if (body.action === 'join') {
      const def = QUEUE_DEFS.find((q) => q.id === body.queueId);
      if (!def) return json(400, { error: 'Fila inválida.' });

      const alreadyQueued = Object.values(queues).some((list) => list.some((m) => m.id === user.id));
      const inMatch = matches.some(
        (m) => m.status === 'em partida' && m.players.some((p) => p.id === user.id)
      );
      if (alreadyQueued || inMatch) return json(400, { error: 'Você já está em uma fila ou partida.' });

      queues[def.id].push({ id: user.id, username: user.username });

      if (queues[def.id].length >= def.capacity) {
        const players = queues[def.id];
        queues[def.id] = [];
        matches.push({
          id: 'm_' + Date.now(),
          queueId: def.id,
          label: def.label,
          players,
          status: 'em partida',
          createdAt: Date.now(),
        });
      }

      await store.setJSON('inhouse-queues', queues);
      await store.setJSON('inhouse-matches', matches);
      return json(200, { ok: true });
    }

    if (body.action === 'leave') {
      Object.keys(queues).forEach((k) => {
        queues[k] = queues[k].filter((m) => m.id !== user.id);
      });
      await store.setJSON('inhouse-queues', queues);
      return json(200, { ok: true });
    }

    if (body.action === 'finish') {
      const match = matches.find((m) => m.id === body.matchId);
      if (!match) return json(400, { error: 'Partida não encontrada.' });
      if (!match.players.some((p) => p.id === user.id))
        return json(403, { error: 'Você não participa dessa partida.' });

      const users = (await store.get('users', { type: 'json' })) || {};
      const gangs = (await store.get('gangs', { type: 'json' })) || [];
      match.players.forEach((p) => {
        if (!users[p.id]) return;
        const won = p.id === body.winnerId;
        const delta = won ? 15 : -5;
        users[p.id].points = (users[p.id].points || 0) + delta;
        users[p.id][won ? 'wins' : 'losses'] = (users[p.id][won ? 'wins' : 'losses'] || 0) + 1;

        if (users[p.id].gangId) {
          const gang = gangs.find((g) => g.id === users[p.id].gangId);
          if (gang) gang.points = (gang.points || 0) + delta;
        }
      });
      await store.setJSON('users', users);
      await store.setJSON('gangs', gangs);

      const idx = matches.indexOf(match);
      matches.splice(idx, 1);
      history.unshift({ ...match, status: 'finalizada', finishedAt: Date.now(), winnerId: body.winnerId || null });

      await store.setJSON('inhouse-matches', matches);
      await store.setJSON('inhouse-history', history.slice(0, 30));
      return json(200, { ok: true });
    }

    return json(400, { error: 'Ação inválida.' });
  }

  return json(405, { error: 'Método não permitido.' });
};
