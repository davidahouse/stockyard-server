const moment = require("moment");
const performance = require("perf_hooks").performance;
const uuidv1 = require("uuid/v1");

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
    "createImageCapture",
    "CREATE TABLE IF NOT EXISTS stockyard.imageCapture \
		( image_capture_id varchar, \
			owner varchar, \
			repository varchar, \
			branch varchar, \
      raw_json jsonb, \
			created_at timestamptz, \
			PRIMARY KEY (image_capture_id));",
    []
  );

  await execute(
    "createImageCaptureFile",
    "CREATE TABLE IF NOT EXISTS stockyard.imageCaptureFile \
		( image_capture_id varchar, \
            title varchar, \
            url varchar, \
            file_name varchar, \
			PRIMARY KEY (image_capture_id, title));",
    []
  );
}

/**
 * storeImageCapture
 * @param {*} owner
 * @param {*} repository
 * @param {*} branch
 * @param {*} imageCaptures
 * @param {*} rawJSON
 */
async function storeImageCapture(
  owner,
  repository,
  branch,
  imageCaptures,
  rawJSON
) {
  const imageCaptureID = uuidv1();
  const insert =
    "INSERT INTO stockyard.imageCapture (image_capture_id, owner, repository, branch, raw_json, created_at) \
	 VALUES ($1, $2, $3, $4, $5, $6);";
  await execute("storeImageCapture", insert, [
    imageCaptureID,
    owner,
    repository,
    branch,
    rawJSON,
    new Date(),
  ]);

  const promises = imageCaptures.map(async (file) => {
    const insertImageCapture =
      "INSERT INTO stockyard.imageCaptureFile (image_capture_id, title, url, file_name) \
			VALUES ($1, $2, $3, $4);";
    return await execute("storeImageCaptureFile", insertImageCapture, [
      imageCaptureID,
      file.title,
      file.url,
      file.fileName,
    ]);
  });
  await Promise.all(promises);
  return imageCaptureID;
}

async function fetchLatestImageCapture(
  owner,
  repository,
  branch,
  dependencies
) {
  const query =
    "SELECT * FROM stockyard.imageCapture WHERE \
	owner = $1 AND \
	repository = $2 AND \
	branch = $3 \
	ORDER BY created_at DESC \
	LIMIT 1";
  const imageCaptureExecution = await execute("fetchImageCapture", query, [
    owner,
    repository,
    branch,
  ]);

  if (imageCaptureExecution == null || imageCaptureExecution.rows.length == 0) {
    return null;
  } else {
    const imageCaptureRow = imageCaptureExecution.rows[0];
    const fileSummary =
      "SELECT * from stockyard.imageCaptureFile \
		WHERE image_capture_id = $1 \
    ORDER BY title;";
    const summary = await execute("fetchImageCaptureFile", fileSummary, [
      imageCaptureRow.image_capture_id,
    ]);
    return {
      imageCaptureID: imageCaptureRow.image_capture_id,
      files: summary.rows,
    };
  }
}

async function fetchLatestRawImageCapture(owner, repository, branch) {
  const query =
    "SELECT raw_json from stockyard.imageCapture \
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
    return latest.rows[0].raw_json;
  }
}

module.exports.setPool = setPool;
module.exports.createTables = createTables;
module.exports.storeImageCapture = storeImageCapture;
module.exports.fetchLatestImageCapture = fetchLatestImageCapture;
module.exports.fetchLatestRawImageCapture = fetchLatestRawImageCapture;
