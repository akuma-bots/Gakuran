const { getSessionUser, dataStore, json } = require('./utils/auth');

const DEFAULT_EVENTS = [
  {
    id: 'ev1',
    title: 'Torneio de Verão',
    date: '2026-08-15T20:00:00-03:00',
    description: 'Chaveamento 3v3, eliminação dupla. Premiação em destaque no hub para o time campeão.',
    capacity: 32,
  },
  {
    id: 'ev2',
    title: 'Brawl: Kurogami vs Akatsuba',
    date: '2026-08-16T19:00:00-03:00',
    description: 'Confronto direto entre as duas gangs no topo do ranking. Transmissão ao vivo no Discord.',
    capacity: 20,
  },
  {
    id: 'ev3',
    title: 'Ranked Reset — Temporada 4',
    date: '2026-08-17T00:00:00-03:00',
    description: 'Reinício de pontuação geral. Os top 10 da temporada anterior recebem selo especial no perfil.',
    capacity: 999,
  },
];

exports.handler = async (event) => {
  const user = await getSessionUser(event);
  if (!user) return json(401, { error: 'Não autenticado.' });

  const store = dataStore();
  let events = await store.get('events', { type: 'json' });
  if (!events) {
    events = DEFAULT_EVENTS.map((e) => ({ ...e, registered: [] }));
    await store.setJSON('events', events);
  }

  if (event.httpMethod === 'GET') {
    return json(200, { events, userId: user.id });
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const ev = events.find((e) => e.id === body.eventId);
    if (!ev) return json(400, { error: 'Evento não encontrado.' });

    if (body.action === 'register') {
      if (ev.registered.includes(user.id)) return json(400, { error: 'Você já está inscrito.' });
      if (ev.registered.length >= ev.capacity) return json(400, { error: 'Vagas esgotadas.' });
      ev.registered.push(user.id);
    } else if (body.action === 'unregister') {
      ev.registered = ev.registered.filter((id) => id !== user.id);
    } else {
      return json(400, { error: 'Ação inválida.' });
    }

    await store.setJSON('events', events);
    return json(200, { ok: true });
  }

  return json(405, { error: 'Método não permitido.' });
};
