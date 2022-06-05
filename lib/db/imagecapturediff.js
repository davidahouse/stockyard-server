const moment = require("moment");
const performance = require("perf_hooks").performance;
const { v4: uuidv4 } = require('uuid');

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

async function createTables() {
  await execute(
    "createImageCaptureDiff",
    "CREATE TABLE IF NOT EXISTS stockyard.imageCaptureDiff \
		( image_capture_diff_id varchar, \
			owner varchar, \
			repository varchar, \
			branch varchar, \
            raw_json jsonb, \
            new_images_count int, \
            changed_images_count int, \
            removed_images_count int, \
			created_at timestamptz, \
			PRIMARY KEY (image_capture_diff_id));",
    []
  );
}

/**
 * storeImageCaptureDiff
 * @param {*} owner
 * @param {*} repository
 * @param {*} branch
 * @param {*} rawJSON
 */
async function storeImageCaptureDiff(owner, repository, branch, rawJSON) {
  const imageCaptureDiffID = uuidv4();
  const insert =
    "INSERT INTO stockyard.imageCaptureDiff (image_capture_diff_id, owner, repository, branch, raw_json, \
        new_images_count, changed_images_count, removed_images_count, created_at) \
	 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);";
  await execute("storeImageCapture", insert, [
    imageCaptureDiffID,
    owner,
    repository,
    branch,
    rawJSON,
    rawJSON.new != null ? rawJSON.new.length : 0,
    rawJSON.changed != null ? rawJSON.changed.length : 0,
    rawJSON.removed != null ? rawJSON.removed.length : 0,
    new Date(),
  ]);
  return imageCaptureDiffID;
}

async function fetchLatestImageCaptureDiff(owner, repository, branch) {
  const query =
    "SELECT raw_json from stockyard.imageCaptureDiff \
    WHERE owner = $1 and repository = $2 and branch = $3 \
    ORDER BY created_at DESC limit 1;";
  const latest = await execute("fetchLatestImageCapture", query, [
    owner,
    repository,
    branch,
  ]);
  if (latest == null || latest.rows.length == 0) {
    return null;
  } else {
    return latest.rows[0];
  }
}

module.exports.setPool = setPool;
module.exports.createTables = createTables;
module.exports.storeImageCaptureDiff = storeImageCaptureDiff;
module.exports.fetchLatestImageCaptureDiff = fetchLatestImageCaptureDiff;
