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
 */
async function storeImageCapture(
  owner,
  repository,
  branch,
  imageCaptures
) {
  const imageCaptureID = uuidv1();
  const insert =
    "INSERT INTO stockyard.imageCapture (image_capture_id, owner, repository, branch, created_at) \
	 VALUES ($1, $2, $3, $4, $5);";
  await execute("storeImageCapture", insert, [
    imageCaptureID,
    owner,
    repository,
    branch,
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
      file.fileName
    ]);
  });
  await Promise.all(promises);
  return imageCaptureID;
}

module.exports.setPool = setPool;
module.exports.createTables = createTables;
module.exports.storeImageCapture = storeImageCapture;