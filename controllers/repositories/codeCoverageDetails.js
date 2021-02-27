const prettyMilliseconds = require("pretty-ms");
const randomColor = require("randomcolor");

/**
 * path this handler will serve
 */
function path() {
  return "/repositories/codeCoverageDetails";
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
    "Code coverage details for: " + owner + " / " + repository
  );
  dependencies.logger.verbose("Branch is: " + branch);

  const codeCoverage = await fetchCodeCoverage(
    owner,
    repository,
    branch,
    dependencies
  );

  const coverageDetails = await dependencies.db.codecoverage.fetchCodeCoverageFiles(
    codeCoverage.codeCoverageID
  );

  res.render(dependencies.viewsPath + "repositories/codeCoverageDetails", {
    owners: owners,
    isAdmin: req.validAdminSession,
    owner: owner,
    repository: repository,
    branch: branch,
    coveragePct: codeCoverage.coveragePct,
    coverageFiles: codeCoverage.files,
    noCoveragePct: codeCoverage.noCoveragePct,
    noCoverageFiles: codeCoverage.noCoverageFiles,
    goodCoveragePct: codeCoverage.goodCoveragePct,
    goodCoverageFiles: codeCoverage.goodCoverageFiles,
    coverageDetails: coverageDetails,
    prettyMilliseconds: (ms) => (ms != null ? prettyMilliseconds(ms) : ""),
  });
}

async function fetchCodeCoverage(owner, repository, branch, dependencies) {
  const latest = await dependencies.db.codecoverage.fetchLatestCodeCoverageSummary(
    owner,
    repository,
    branch
  );
  if (latest == null) {
    return {
      coveragePct: 0.0,
      files: 0,
      noCoveragePct: 0.0,
      noCoverageFiles: 0,
      goodCoveragePct: 0.0,
      goodCoverageFiles: 0,
    };
  } else {
    let totalFiles = 0;
    let noCoverageFiles = 0;
    let goodCoverageFiles = 0;
    latest.summary.forEach(function (file) {
      totalFiles += 1;
      if (file.line_coverage <= 0.0) {
        noCoverageFiles += 1;
      } else if (file.line_coverage >= 0.9) {
        goodCoverageFiles += 1;
      }
    });
    let noCoveragePct = 0;
    if (totalFiles > 0) {
      noCoveragePct = noCoverageFiles / totalFiles;
    }
    let goodCoveragePct = 0;
    if (totalFiles > 0) {
      goodCoveragePct = goodCoverageFiles / totalFiles;
    }
    return {
      codeCoverageID: latest.codeCoverageID,
      coveragePct: Math.round(latest.lineCoverage * 100),
      files: totalFiles,
      noCoveragePct: Math.round(noCoveragePct * 100),
      noCoverageFiles: noCoverageFiles,
      goodCoveragePct: Math.round(goodCoveragePct * 100),
      goodCoverageFiles: goodCoverageFiles,
    };
  }
}

module.exports.path = path;
module.exports.handle = handle;
