const prettyMilliseconds = require("pretty-ms");
const randomColor = require("randomcolor");

/**
 * path this handler will serve
 */
function path() {
  return "/repositories/imageCaptureDetails";
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

  const imageCapture = await fetchImageCapture(
    owner,
    repository,
    defaultBranch,
    dependencies
  );

  res.render(dependencies.viewsPath + "repositories/imageCaptureDetails", {
    owners: owners,
    isAdmin: req.validAdminSession,
    owner: owner,
    repository: repository,
    branch: defaultBranch,
    images: imageCapture,
    prettyMilliseconds: (ms) => (ms != null ? prettyMilliseconds(ms) : ""),
  });
}

async function fetchImageCapture(owner, repository, branch, dependencies) {
  const latest = await dependencies.db.imagecapture.fetchLatestImageCapture(
    owner,
    repository,
    branch
  );
  if (latest == null) {
    return [];
  } else {
    return latest.files;
  }
}

module.exports.path = path;
module.exports.handle = handle;
