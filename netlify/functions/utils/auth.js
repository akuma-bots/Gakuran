const jwt = require('jsonwebtoken');
const { getStore } = require('@netlify/blobs');

function getCookie(header, name) {
  if (!header) return null;
  const match = header.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function dataStore() {
  return getStore({
    name: 'gakuran-data',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN,
  });
}

async function getSessionUser(event) {
  const token = getCookie(event.headers.cookie, 'session');
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.SESSION_SECRET);
    const store = dataStore();
    const users = (await store.get('users', { type: 'json' })) || {};
    return users[payload.id] || null;
  } catch (e) {
    return null;
  }
}

function json(statusCode, obj, extraHeaders) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
    body: JSON.stringify(obj),
  };
}

module.exports = { getCookie, getSessionUser, dataStore, json };
