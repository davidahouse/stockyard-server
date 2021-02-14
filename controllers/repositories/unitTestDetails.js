const prettyMilliseconds = require("pretty-ms");
const randomColor = require("randomcolor");

/**
 * path this handler will serve
 */
function path() {
  return "/repositories/unitTestDetails";
}

/**
 * handle index
 * @param {*} req
 * @param {*} res
 * @param {*} dependencies
 */
async function handle(req, res, dependencies, owners) {
  const owner = req.query.owner;
  const repository = req.query.repository;

  const repositoryDetails = await dependencies.db.repositories.fetchRepository(
    owner,
    repository
  );
  let defaultBranch = "";
  if (repositoryDetails == null || repositoryDetails.rows.length == 0) {
    defaultBranch = dependencies.serverConfig.defaultBranch;
  } else {
    defaultBranch = repositoryDetails.rows[0].default_branch;
  }

  const unitTest = await fetchUnitTest(
    owner,
    repository,
    defaultBranch,
    dependencies
  );

  const testCases = await dependencies.db.unittest.fetchTestExecutionDetails(
    unitTest.unitTestID
  );

  res.render(dependencies.viewsPath + "repositories/unitTestDetails", {
    owners: owners,
    isAdmin: req.validAdminSession,
    owner: owner,
    repository: repository,
    branch: defaultBranch,
    totalTests: unitTest.totalTests,
    successTests: unitTest.successTests,
    failedTests: unitTest.failedTests,
    tests: testCases,
    prettyMilliseconds: (ms) => (ms != null ? prettyMilliseconds(ms) : ""),
  });
}

async function fetchUnitTest(owner, repository, branch, dependencies) {
  const unitTest = await dependencies.db.unittest.fetchLatestUnitTestSummary(
    owner,
    repository,
    branch
  );
  if (unitTest == null) {
    return {
      unitTestID: null,
      totalTests: null,
      successTests: null,
      failedTests: null,
    };
  } else {
    let total = 0;
    let success = 0;
    let failed = 0;
    unitTest.summary.forEach(function (result) {
      total += parseInt(result.count);
      if (result.status.toLowerCase() == "success") {
        success += parseInt(result.count);
      } else {
        failed += parseInt(result.count);
      }
    });
    return {
      unitTestID: unitTest.unitTestID,
      totalTests: total,
      successTests: success,
      failedTests: failed,
    };
  }
}

module.exports.path = path;
module.exports.handle = handle;
