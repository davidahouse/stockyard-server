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
    "createLinesOfCode",
    "CREATE TABLE IF NOT EXISTS stockyard.linesOfCode \
    ( lines_of_code_id varchar, \
      owner varchar, \
      repository varchar, \
      branch varchar, \
      raw_json jsonb, \
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
 * storeLinesOfCode
 * @param {*} owner
 * @param {*} repository
 * @param {*} branch
 * @param {*} languages
 * @param {*} rawJSON
 */
async function storeLinesOfCode(owner, repository, branch, languages, rawJSON) {
  const linesOfCodeID = uuidv4();
  const insert =
    "INSERT INTO stockyard.linesOfCode (lines_of_code_id, owner, repository, branch, raw_json, created_at) \
	 VALUES ($1, $2, $3, $4, $5, $6);";
  await execute("storeLinesOfCode", insert, [
    linesOfCodeID,
    owner,
    repository,
    branch,
    rawJSON,
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

/**
 * fetchLatestLinesOfCode
 * @param {*} owner
 * @param {*} repository
 * @param {*} branch
 */
async function fetchLatestLinesOfCode(owner, repository, branch) {
  const query =
    "SELECT * from stockyard.linesOfCode \
    WHERE owner = $1 and repository = $2 and branch = $3 \
    ORDER BY created_at DESC limit 1;";
  const latest = await execute("fetchLatestLinesOfCode", query, [
    owner,
    repository,
    branch,
  ]);
  if (latest == null || latest.rows.length == 0) {
    return null;
  }

  const linesOfCodeID = latest.rows[0].lines_of_code_id;
  const languageQuery =
    "SELECT * from stockyard.linesOfCodeLanguage WHERE \
    lines_of_code_id = $1 \
    ORDER BY language;";
  const languages = await execute("fetchLanguages", languageQuery, [
    linesOfCodeID,
  ]);
  return {
    linesOfCodeID: linesOfCodeID,
    createdAt: latest.rows[0].created_at,
    languages: languages.rows,
  };
}

async function fetchLatestRawLinesOfCode(owner, repository, branch) {
  const query =
    "SELECT raw_json from stockyard.linesOfCode \
    WHERE owner = $1 and repository = $2 and branch = $3 \
    ORDER BY created_at DESC limit 1;";
  const latest = await execute("fetchLatestLinesOfCode", query, [
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
module.exports.storeLinesOfCode = storeLinesOfCode;
module.exports.fetchLatestLinesOfCode = fetchLatestLinesOfCode;
module.exports.fetchLatestRawLinesOfCode = fetchLatestRawLinesOfCode;
