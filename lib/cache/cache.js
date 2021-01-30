"use strict";

const client = require("./cacheClient");
const admin = require("./admin");

// Public functions

// General

/**
 * startCache
 * @param {*} conf
 */
function startCache(conf) {
  client.createRedisClient(conf);
  admin.setClient(client);
}

/**
 * stopCache
 */
async function stopCache() {
  await client.quit();
}

/**
 * fetchOwners
 */
async function fetchOwners() {
  const owners = await client.fetchMembers("stockyard-owners", []);
  return owners;
}

/**
 * removeOwner
 * @param {*} owner
 */
async function removeOwner(owner) {
  await client.removeMember("stockyard-owners", owner);
}

/**
 * addOwner
 * @param {*} owner
 */
async function addOwner(owner) {
  await client.add("stockyard-owners", owner);
}

// Private functions

// General
module.exports.startCache = startCache;
module.exports.stopCache = stopCache;

// Modules
module.exports.admin = admin;

// Owners
module.exports.fetchOwners = fetchOwners;
module.exports.removeOwner = removeOwner;
module.exports.addOwner = addOwner;
