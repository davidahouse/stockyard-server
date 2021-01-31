const moment = require("moment");
const performance = require("perf_hooks").performance;

let pool;
let systemLogger = null;
let logSlowQueries = "";
let logSQL = false;

function setPool(dbPool, conf, logger) {
  pool = dbPool;
  systemLogger = logger;
  logSlowQueries = conf.dbLogSlowQueries;
  logSQL = conf.dbLogSQL;
}

async function execute(operation, sql, params) {
  try {
    if (logSQL) {
      systemLogger.info("SQL: " + sql + " " + JSON.stringify(params, null, 2));
    }
    let start = performance.now();
    const result = await pool.query(sql, params);
    let finished = performance.now();
    if (
      (logSlowQueries === "true" && finished - start > 50.0) ||
      logSlowQueries === "all"
    ) {
      systemLogger.info("DB: " + operation + " " + (finished - start) + " ms");
    }
    return result;
  } catch (e) {
    systemLogger.error("DB Error: " + e);
    return null;
  }
}

/**
 * storeRepository
 * @param {*} owner
 * @param {*} repository
 */
async function storeRepository(owner, repository) {
  const insert =
    "INSERT INTO stockyard.repositories (owner, repository) VALUES ($1, $2) ON CONFLICT DO NOTHING;";
  return await execute("storeRepository", insert, [owner, repository]);
}

/**
 * fetchRepositories
 */
async function fetchRepositories() {
  const query =
    "SELECT * FROM stockyard.repositories ORDER BY owner, repository";
  return await execute("fetchRepositories", query, []);
}

/**
 * fetchRepositoriesWithOwner
 */
async function fetchRepositoriesWithOwner(owner) {
  const query =
    "SELECT * FROM stockyard.repositories WHERE owner = $1 ORDER BY repository";
  return await execute("fetchRepositoriesWithOwner", query, [owner]);
}

/**
 * fetchOwners
 */
async function fetchOwners() {
  const query =
    "SELECT DISTINCT owner FROM stockyard.repositories ORDER BY owner";
  return await execute("fetchOwners", query, []);
}

module.exports.setPool = setPool;
module.exports.storeRepository = storeRepository;
module.exports.fetchRepositories = fetchRepositories;
module.exports.fetchOwners = fetchOwners;
module.exports.fetchRepositoriesWithOwner = fetchRepositoriesWithOwner;
