"use strict";

/**
 * The url path this handler will serve
 */
function path() {
  return "/api/latest/codecoverage";
}

/**
 * The http method this handler will serve
 */
function method() {
  return "get";
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

  const coverageData = await dependencies.db.codecoverage.fetchLatestRawCodeCoverage(
    owner,
    repository,
    branch
  );
  if (coverageData != null) {
    res.send(coverageData);
  } else {
    res.send({});
  }
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
