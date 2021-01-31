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
 * storeBranch
 * @param {*} owner
 * @param {*} repository
 * @param {*} branch
 * @param {*} pullRequest
 */
async function storeBranch(owner, repository, branch, pullRequest) {
  const insert =
    "INSERT INTO stockyard.branches (owner, repository, branch, pull_request) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING;";
  return await execute("storeBranch", insert, [
    owner,
    repository,
    branch,
    pullRequest,
  ]);
}

/**
 * updateBranchActivity
 * @param {*} owner
 * @param {*} repository
 * @param {*} branch
 */
async function updateBranchActivity(owner, repository, branch) {
  const query =
    "UPDATE stockyard.branches SET latest_activity = $4 \
	WHERE owner = $1 AND repository = $2 AND branch = $3";
  return await execute("fetchRepositories", query, [
    owner,
    repository,
    branch,
    new Date(),
  ]);
}

module.exports.setPool = setPool;
module.exports.storeBranch = storeBranch;
module.exports.updateBranchActivity = updateBranchActivity;
