exports.handler = async () => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const siteUrl = process.env.SITE_URL;
  const redirectUri = `${siteUrl}/.netlify/functions/auth-callback`;

  const url =
    `https://discord.com/api/oauth2/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=identify`;

  return {
    statusCode: 302,
    headers: { Location: url },
  };
};
