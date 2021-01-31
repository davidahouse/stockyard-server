"use strict";

/**
 * The url path this handler will serve
 */
function path() {
  return "/api/upload/cloc";
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
  const languages = [];
  if (contents != null) {
    Object.keys(contents).forEach(function (key) {
      if (key != "SUM" && key != "header") {
        languages.push({
          language: key,
          codeLines: contents[key].code,
          blankLines: contents[key].blank,
          numberOfFiles: contents[key].nFiles,
          commentLines: contents[key].comment,
        });
      }
    });
  }

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

  await dependencies.db.linesofcode.storeLinesOfCode(
    owner,
    repository,
    branch,
    languages
  );

  res.send({ status: "ok" });
}

/**
 * The OpenAPI docs
 */
function docs() {
  return {
    get: {
      summary: "cloc",
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
