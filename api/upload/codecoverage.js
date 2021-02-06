"use strict";

/**
 * The url path this handler will serve
 */
function path() {
  return "/api/upload/codecoverage";
}

/**
 * The http method this handler will serve
 */
function method() {
  return "post";
}

/**
 * handle activeBuilds
 * @param {*} req
 * @param {*} res
 * @param {*} dependencies
 */
async function handle(req, res, dependencies) {
  const owner = req.query.owner;
  const repository = req.query.repository;
  const branch = req.query.branch;
  const pullRequest = req.query.pull_request;

  if (owner == null || repository == null || branch == null) {
    res.send({ status: "missing owner, repo or branch" });
    return;
  }

  const contents = req.body;

  await dependencies.db.repositories.storeRepository(
    owner,
    repository,
    dependencies.serverConfig.defaultBranch
  );
  await dependencies.db.branches.storeBranch(
    owner,
    repository,
    branch,
    pullRequest
  );
  await dependencies.db.branches.updateBranchActivity(
    owner,
    repository,
    branch
  );

  await dependencies.db.codecoverage.storeCodeCoverage(
    owner,
    repository,
    branch,
    contents.codeCoverage.lineCoverage,
    contents.codeCoverage.executableLines,
    contents.codeCoverage.coveredLines,
    contents.codeCoverage.targets
  );

  res.send({ status: "ok" });
}

/**
 * The OpenAPI docs
 */
function docs() {
  return {
    get: {
      summary: "codecoverage",
      responses: {
        200: {
          description: "",
        },
      },
    },
  };
}

module.exports.path = path;
module.exports.method = method;
module.exports.handle = handle;
module.exports.docs = docs;
