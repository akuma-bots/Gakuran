exports.handler = async () => {
  return {
    statusCode: 302,
    headers: {
      Location: '/',
      'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    },
  };
};
