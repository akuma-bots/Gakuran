const { getSessionUser, json } = require('./utils/auth');

exports.handler = async (event) => {
  const user = await getSessionUser(event);
  if (!user) return json(200, { authenticated: false });
  return json(200, { authenticated: true, user });
};
