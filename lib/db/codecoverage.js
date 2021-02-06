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
    "createCodeCoverage",
    "CREATE TABLE IF NOT EXISTS stockyard.codeCoverage \
		( code_coverage_id varchar, \
			owner varchar, \
			repository varchar, \
			branch varchar, \
			created_at timestamptz, \
			line_coverage real, \
			executable_lines int, \
			covered_lines int, \
			PRIMARY KEY (code_coverage_id));",
    []
  );

  await execute(
    "createCodeCoverageTarget",
    "CREATE TABLE IF NOT EXISTS stockyard.codeCoverageTarget \
		( code_coverage_id varchar, \
			target varchar, \
			line_coverage real, \
			executable_lines int, \
			covered_lines int, \
			PRIMARY KEY (code_coverage_id, target));",
    []
  );

  await execute(
    "createCodeCoverageFile",
    "CREATE TABLE IF NOT EXISTS stockyard.codeCoverageFile \
	( code_coverage_id varchar, \
		target varchar, \
		file_path varchar, \
		file_name varchar, \
		line_coverage real, \
		executable_lines int, \
		covered_lines int, \
		PRIMARY KEY (code_coverage_id, target, file_path));",
    []
  );
}

/**
 * storeCodeCoverage
 * @param {*} owner
 * @param {*} repository
 * @param {*} branch
 * @param {*} targets
 */
async function storeCodeCoverage(
  owner,
  repository,
  branch,
  lineCoverage,
  executableLines,
  coveredLines,
  targets
) {
  const coverageID = uuidv1();
  const insert =
    "INSERT INTO stockyard.codeCoverage (code_coverage_id, owner, repository, branch, created_at, \
			line_coverage, executable_lines, covered_lines) \
	 VALUES ($1, $2, $3, $4, $5, $6, $7, $8);";
  await execute("storeCodeCoverage", insert, [
    coverageID,
    owner,
    repository,
    branch,
    new Date(),
    lineCoverage,
    executableLines,
    coveredLines,
  ]);

  const promises = targets.map(async (target) => {
    const insertTarget =
      "INSERT INTO stockyard.codeCoverageTarget (code_coverage_id, target, line_coverage, \
				executable_lines, covered_lines) \
			VALUES ($1, $2, $3, $4, $5);";
    return await execute("storeCodeCoverageTarget", insertTarget, [
      coverageID,
      target.name,
      target.lineCoverage,
      target.executableLines,
      target.coveredLines,
    ]);
  });
  await Promise.all(promises);

  const filePromises = targets.map(async (target) => {
    return target.files.map(async (file) => {
      const insertFile =
        "INSERT INTO stockyard.codeCoverageFile (code_coverage_id, target, file_path, file_name, \
					line_coverage, executable_lines, covered_lines) \
			VALUES ($1, $2, $3, $4, $5, $6, $7);";
      return await execute("storeCodeCoverageFile", insertFile, [
        coverageID,
        target.name,
        file.path,
        file.name,
        file.lineCoverage,
        file.executableLines,
        file.coveredLines,
      ]);
    });
  });
  await Promise.all(filePromises);

  return coverageID;
}

/**
	fetchLatestCodeCoverageSummary
	@param {*} owner
	@param {*} repository
	@param {*} branch
*/
async function fetchLatestCodeCoverageSummary(owner, repository, branch) {
  const query =
    "SELECT * FROM stockyard.codeCoverage WHERE \
	owner = $1 AND \
	repository = $2 AND \
	branch = $3 \
	ORDER BY created_at DESC \
	LIMIT 1";
  const coverageExecution = await execute("fetchCodeCoverage", query, [
    owner,
    repository,
    branch,
  ]);

  if (coverageExecution == null || coverageExecution.rows.length == 0) {
    return null;
  } else {
    const coverageRow = coverageExecution.rows[0];
    console.dir(coverageRow);
    const targetSummary =
      "SELECT * from stockyard.codeCoverageFile \
		WHERE code_coverage_id = $1";
    const summary = await execute("fetchCodeCoverageSummary", targetSummary, [
      coverageRow.code_coverage_id,
    ]);
    return {
      codeCoverageID: coverageRow.code_coverage_id,
      lineCoverage: coverageRow.line_coverage,
      summary: summary.rows,
    };
  }
}

module.exports.setPool = setPool;
module.exports.createTables = createTables;
module.exports.storeCodeCoverage = storeCodeCoverage;
module.exports.fetchLatestCodeCoverageSummary = fetchLatestCodeCoverageSummary;
