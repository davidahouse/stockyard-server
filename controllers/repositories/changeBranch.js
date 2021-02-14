const prettyMilliseconds = require("pretty-ms");

/**
 * path this handler will serve
 */
function path() {
  return "/repositories/changeBranch";
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

  const branches = await dependencies.db.branches.fetchBranches(
    owner,
    repository,
    defaultBranch
  );

  res.render(dependencies.viewsPath + "repositories/changeBranch", {
    owners: owners,
    isAdmin: req.validAdminSession,
    owner: owner,
    repository: repository,
    defaultBranch: defaultBranch,
    branches: branches,
    prettyMilliseconds: (ms) => (ms != null ? prettyMilliseconds(ms) : ""),
  });
}

module.exports.path = path;
module.exports.handle = handle;
