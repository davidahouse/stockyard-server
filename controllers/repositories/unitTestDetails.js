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
  let branch = req.query.branch;

  if (branch == null) {
    const repositoryDetails = await dependencies.db.repositories.fetchRepository(
      owner,
      repository
    );

    if (repositoryDetails == null || repositoryDetails.rows.length == 0) {
      branch = dependencies.serverConfig.defaultBranch;
    } else {
      branch = repositoryDetails.rows[0].default_branch;
    }
  }

  dependencies.logger.verbose(
    "Unit test details for: " + owner + " / " + repository
  );
  dependencies.logger.verbose("Branch is: " + branch);

  const unitTest = await fetchUnitTest(owner, repository, branch, dependencies);

  const testCases = await dependencies.db.unittest.fetchTestExecutionDetails(
    unitTest.unitTestID
  );

  res.render(dependencies.viewsPath + "repositories/unitTestDetails", {
    owners: owners,
    isAdmin: req.validAdminSession,
    owner: owner,
    repository: repository,
    branch: branch,
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
