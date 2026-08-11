// Registra os slash commands GLOBALMENTE — funciona em qualquer servidor onde o bot estiver.
// Acesse essa URL UMA VEZ pelo navegador (depois do deploy) pra ativar os comandos:
//   https://gakuranbr-community.netlify.app/.netlify/functions/setup-commands?key=SEU_SETUP_KEY
//
// SEU_SETUP_KEY é uma variável de ambiente que você mesmo escolhe (qualquer texto aleatório),
// só serve pra impedir que outra pessoa dispare esse endpoint sem permissão.

const commands = [
  {
    name: 'perfil',
    description: 'Mostra o perfil InHouse de um jogador',
    options: [
      { name: 'usuario', description: 'Jogador (deixe vazio pra ver o seu)', type: 6, required: false },
    ],
  },
  {
    name: 'ranking',
    description: 'Top 10 do ranking InHouse de Gakuran BR',
  },
  {
    name: 'gangue',
    description: 'Mostra informações de uma gang',
    options: [
      { name: 'nome', description: 'Nome da gang (deixe vazio pra ver a sua)', type: 3, required: false },
    ],
  },
  {
    name: 'eventos',
    description: 'Lista os eventos do GBR·HUB',
  },
  {
    name: 'ajuda',
    description: 'Lista os comandos do bot',
  },
  {
    name: 'anunciar',
    description: '[Admin] Publica um comunicado em um canal',
    options: [
      { name: 'canal', description: 'Canal onde o aviso será publicado', type: 7, required: true },
      { name: 'mensagem', description: 'Texto do comunicado', type: 3, required: true },
    ],
  },
  {
    name: 'banir',
    description: '[Admin] Bane ou desbane um jogador do servidor',
    options: [
      { name: 'usuario', description: 'Jogador', type: 6, required: true },
      { name: 'motivo', description: 'Motivo do banimento', type: 3, required: false },
      { name: 'desbanir', description: 'Marque true pra desbanir em vez de banir', type: 5, required: false },
    ],
  },
  {
    name: 'updateall',
    description: '[Admin] Comando de emergência: recalcula os pontos de todas as gangs',
  },
];

exports.handler = async (event) => {
  const key = event.queryStringParameters && event.queryStringParameters.key;

  if (!process.env.SETUP_KEY || key !== process.env.SETUP_KEY) {
    return { statusCode: 401, body: 'Chave de configuração inválida ou ausente. Use ?key=SEU_SETUP_KEY na URL.' };
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!clientId || !botToken) {
    return { statusCode: 500, body: 'Faltam variáveis de ambiente: DISCORD_CLIENT_ID ou DISCORD_BOT_TOKEN.' };
  }

  // Registro GLOBAL — funciona em qualquer servidor onde o bot estiver.
  // Pode levar até 1 hora pra propagar (comandos por servidor são instantâneos, mas exigem o Guild ID certo).
  const url = `https://discord.com/api/v10/applications/${clientId}/commands`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { statusCode: 400, body: 'Falha ao registrar comandos: ' + errText };
  }

  const data = await res.json();
  const list = data.map((c) => '/' + c.name).join(', ');

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: `✅ ${data.length} comandos GLOBAIS registrados:\n${list}\n\nPodem levar até 1 hora pra aparecer no Discord. Já pode fechar essa página.`,
  };
};
