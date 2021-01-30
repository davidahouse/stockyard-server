"use strict";

let client;

function setClient(redisClient) {
  client = redisClient;
}

async function storeSession(sessionID, sessionDetails, expiring) {
  await client.store(
    "stockyard-adminsession-" + sessionID,
    sessionDetails,
    expiring
  );
}

async function fetchSession(sessionID) {
  const session = await client.fetch(
    "stockyard-adminsession-" + sessionID,
    null
  );
  return session;
}

module.exports.setClient = setClient;
module.exports.storeSession = storeSession;
module.exports.fetchSession = fetchSession;
