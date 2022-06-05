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
    "createUnitTest",
    "CREATE TABLE IF NOT EXISTS stockyard.unitTest \
		( unit_test_id varchar, \
			owner varchar, \
			repository varchar, \
			branch varchar, \
      raw_json jsonb, \
			created_at timestamptz, \
			PRIMARY KEY (unit_test_id));",
    []
  );

  await execute(
    "createUnitTestClass",
    "CREATE TABLE IF NOT EXISTS stockyard.unitTestClass \
	( unit_test_id varchar, \
		unit_test_class varchar, \
		PRIMARY KEY (unit_test_id, unit_test_class));",
    []
  );

  await execute(
    "createUnitTestCase",
    "CREATE TABLE IF NOT EXISTS stockyard.unitTestCase \
	( unit_test_id varchar, \
		unit_test_class varchar, \
		unit_test_case varchar, \
		status varchar, \
		PRIMARY KEY (unit_test_id, unit_test_class, unit_test_case));",
    []
  );
}

/**
 * storeUnitTest
 * @param {*} owner
 * @param {*} repository
 * @param {*} branch
 * @param {*} testClasses
 * @param {*} rawJSON
 */
async function storeUnitTest(owner, repository, branch, testClasses, rawJSON) {
  const unitTestID = uuidv4();
  const insert =
    "INSERT INTO stockyard.unitTest (unit_test_id, owner, repository, branch, raw_json, created_at) \
	 VALUES ($1, $2, $3, $4, $5, $6);";
  await execute("storeUnitTest", insert, [
    unitTestID,
    owner,
    repository,
    branch,
    rawJSON,
    new Date(),
  ]);

  const promises = testClasses.map(async (testClass) => {
    const insertTestClass =
      "INSERT INTO stockyard.unitTestClass (unit_test_id, unit_test_class) \
			VALUES ($1, $2);";
    return await execute("storeTestClass", insertTestClass, [
      unitTestID,
      testClass.id,
    ]);
  });
  await Promise.all(promises);

  const testCasePromises = testClasses.map(async (testClass) => {
    return testClass.testCases.map(async (testCase) => {
      const insertTestClass =
        "INSERT INTO stockyard.unitTestCase (unit_test_id, unit_test_class, unit_test_case, status) \
			VALUES ($1, $2, $3, $4);";
      return await execute("storeTestClass", insertTestClass, [
        unitTestID,
        testClass.id,
        testCase.id,
        testCase.status,
      ]);
    });
  });
  await Promise.all(testCasePromises);

  return unitTestID;
}

/**
  fetchLatestUnitTestSummary
  @param {*} owner
  @param {*} repository
  @param {*} branch
*/
async function fetchLatestUnitTestSummary(owner, repository, branch) {
  const query =
    "SELECT * FROM stockyard.unitTest WHERE \
	owner = $1 AND \
	repository = $2 AND \
	branch = $3 \
	ORDER BY created_at DESC \
	LIMIT 1";
  const unitTestExecution = await execute("fetchUnitTest", query, [
    owner,
    repository,
    branch,
  ]);

  if (unitTestExecution == null || unitTestExecution.rows.length == 0) {
    return null;
  } else {
    const summaryQuery =
      "SELECT status, count(*) as count FROM stockyard.unitTestCase \
		WHERE unit_test_id = $1 \
		GROUP BY status;";
    const summary = await execute("fetchUnitTestSummary", summaryQuery, [
      unitTestExecution.rows[0].unit_test_id,
    ]);
    return {
      unitTestID: unitTestExecution.rows[0].unit_test_id,
      summary: summary.rows,
    };
  }
}

async function fetchTestExecutionDetails(unitTestID) {
  const query =
    "SELECT * \
  FROM stockyard.unitTestCase \
  WHERE unit_test_id = $1 \
  ORDER BY unit_test_class, unit_test_case;";
  const testCases = await execute("fetchExecutionDetails", query, [unitTestID]);
  if (testCases != null) {
    return testCases.rows;
  } else {
    return [];
  }
}

async function fetchLatestRawUnitTestSummary(owner, repository, branch) {
  const query =
    "SELECT raw_json from stockyard.unitTest \
    WHERE owner = $1 and repository = $2 and branch = $3 \
    ORDER BY created_at DESC limit 1;";
  const latest = await execute("fetchLatestUnitTestSummary", query, [
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
module.exports.storeUnitTest = storeUnitTest;
module.exports.fetchLatestUnitTestSummary = fetchLatestUnitTestSummary;
module.exports.fetchTestExecutionDetails = fetchTestExecutionDetails;
module.exports.fetchLatestRawUnitTestSummary = fetchLatestRawUnitTestSummary;
