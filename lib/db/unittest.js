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
    "createUnitTest",
    "CREATE TABLE IF NOT EXISTS stockyard.unitTest \
		( unit_test_id varchar, \
			owner varchar, \
			repository varchar, \
			branch varchar, \
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
 */
async function storeUnitTest(owner, repository, branch, testClasses) {
  const unitTestID = uuidv1();
  const insert =
    "INSERT INTO stockyard.unitTest (unit_test_id, owner, repository, branch, created_at) \
	 VALUES ($1, $2, $3, $4, $5);";
  await execute("storeUnitTest", insert, [
    unitTestID,
    owner,
    repository,
    branch,
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

module.exports.setPool = setPool;
module.exports.createTables = createTables;
module.exports.storeUnitTest = storeUnitTest;
