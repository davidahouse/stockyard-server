const prettyMilliseconds = require("pretty-ms");
const randomColor = require("randomcolor");

/**
 * path this handler will serve
 */
function path() {
  return "/repositories/imageCaptureDiffDetails";
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
    "Image capture diff details for: " + owner + " / " + repository
  );
  dependencies.logger.verbose("Branch is: " + branch);

  const imageCaptureDiff = await fetchImageCaptureDiff(
    owner,
    repository,
    branch,
    dependencies
  );
  console.dir(imageCaptureDiff);

  res.render(dependencies.viewsPath + "repositories/imageCaptureDiffDetails", {
    owners: owners,
    isAdmin: req.validAdminSession,
    owner: owner,
    repository: repository,
    branch: branch,
    images: imageCaptureDiff.raw_json,
    prettyMilliseconds: (ms) => (ms != null ? prettyMilliseconds(ms) : ""),
  });
}

async function fetchImageCaptureDiff(owner, repository, branch, dependencies) {
  const latest = await dependencies.db.imagecapturediff.fetchLatestImageCaptureDiff(
    owner,
    repository,
    branch
  );
  if (latest == null) {
    return [];
  } else {
    return latest;
  }
}

module.exports.path = path;
module.exports.handle = handle;
