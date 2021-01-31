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
    "createLinesOfCode",
    "CREATE TABLE IF NOT EXISTS stockyard.linesOfCode \
    ( lines_of_code_id varchar, \
      owner varchar, \
      repository varchar, \
      branch varchar, \
      created_at timestamptz, \
      PRIMARY KEY (lines_of_code_id));",
    []
  );

  await execute(
    "createLinesOfCodeLanguage",
    "CREATE TABLE IF NOT EXISTS stockyard.linesOfCodeLanguage \
    ( lines_of_code_id varchar, \
    language varchar, \
    number_of_files int, \
    blank_lines int, \
    comment_lines int, \
    code_lines int, \
    PRIMARY KEY (lines_of_code_id, language));",
    []
  );
}

/**
 * storeBranch
 * @param {*} owner
 * @param {*} repository
 * @param {*} branch
 * @param {*} languages
 */
async function storeLinesOfCode(owner, repository, branch, languages) {
  const linesOfCodeID = uuidv1();
  const insert =
    "INSERT INTO stockyard.linesOfCode (lines_of_code_id, owner, repository, branch, created_at) \
	 VALUES ($1, $2, $3, $4, $5);";
  await execute("storeLinesOfCode", insert, [
    linesOfCodeID,
    owner,
    repository,
    branch,
    new Date(),
  ]);

  const promises = languages.map(async (language) => {
    const insertLanguage =
      "INSERT INTO stockyard.linesOfCodeLanguage (lines_of_code_id, language, \
      number_of_files, blank_lines, comment_lines, code_lines) \
      VALUES ($1, $2, $3, $4, $5, $6);";
    return await execute("storeLanguage", insertLanguage, [
      linesOfCodeID,
      language.language,
      language.numberOfFiles != null ? language.numberOfFiles : 0,
      language.blankLines != null ? language.blankLines : 0,
      language.commentLines != null ? language.commentLines : 0,
      language.codeLines != null ? language.codeLines : 0,
    ]);
  });
  await Promise.all(promises);
  return linesOfCodeID;
}

module.exports.setPool = setPool;
module.exports.createTables = createTables;
module.exports.storeLinesOfCode = storeLinesOfCode;
