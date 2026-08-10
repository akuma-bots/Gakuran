const jwt = require('jsonwebtoken');
const { dataStore } = require('./utils/auth');

exports.handler = async (event) => {
  const code = event.queryStringParameters && event.queryStringParameters.code;
  const errorParam = event.queryStringParameters && event.queryStringParameters.error;

  if (errorParam) {
    return { statusCode: 302, headers: { Location: '/?auth=cancelled' } };
  }
  if (!code) {
    return { statusCode: 400, body: 'Código de autorização ausente.' };
  }

  const siteUrl = process.env.SITE_URL;
  const redirectUri = `${siteUrl}/.netlify/functions/auth-callback`;

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return { statusCode: 400, body: 'Falha ao trocar o código pelo token: ' + errText };
    }
    const tokenData = await tokenRes.json();

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) {
      return { statusCode: 400, body: 'Falha ao buscar dados do usuário no Discord.' };
    }
    const discordUser = await userRes.json();

    const store = dataStore();
    const users = (await store.get('users', { type: 'json' })) || {};

    if (!users[discordUser.id]) {
      users[discordUser.id] = {
        id: discordUser.id,
        username: discordUser.username,
        avatar: discordUser.avatar,
        points: 0,
        wins: 0,
        losses: 0,
        gangId: null,
        createdAt: Date.now(),
      };
    } else {
      users[discordUser.id].username = discordUser.username;
      users[discordUser.id].avatar = discordUser.avatar;
    }
    await store.setJSON('users', users);

    const sessionToken = jwt.sign({ id: discordUser.id }, process.env.SESSION_SECRET, {
      expiresIn: '30d',
    });

    return {
      statusCode: 302,
      headers: {
        Location: '/dashboard.html',
        'Set-Cookie': `session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
      },
    };
  } catch (e) {
    return { statusCode: 500, body: 'Erro interno no login: ' + e.message };
  }
};
