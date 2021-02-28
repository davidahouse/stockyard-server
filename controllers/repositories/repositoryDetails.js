const prettyMilliseconds = require("pretty-ms");
const randomColor = require("randomcolor");

/**
 * path this handler will serve
 */
function path() {
  return "/repositories/repositoryDetails";
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

  let branch = defaultBranch;
  if (req.query.branch != null) {
    branch = req.query.branch;
  }

  const linesOfCode = await fetchLinesOfCode(
    owner,
    repository,
    branch,
    dependencies
  );

  const unitTest = await fetchUnitTest(owner, repository, branch, dependencies);

  const codeCoverage = await fetchCodeCoverage(
    owner,
    repository,
    branch,
    dependencies
  );

  const imageCapture = await fetchImageCapture(
    owner,
    repository,
    branch,
    dependencies
  );

  const imageCaptureDiff = await fetchImageCaptureDiff(
    owner,
    repository,
    branch,
    dependencies
  );

  res.render(dependencies.viewsPath + "repositories/repositoryDetails", {
    owners: owners,
    isAdmin: req.validAdminSession,
    owner: owner,
    repository: repository,
    branch: branch,
    linesOfCode: linesOfCode.linesOfCode,
    totalLinesOfCode: linesOfCode.totalLinesOfCode,
    totalFiles: linesOfCode.totalFiles,
    totalTests: unitTest.totalTests,
    successTests: unitTest.successTests,
    failedTests: unitTest.failedTests,
    coveragePct: codeCoverage.coveragePct,
    coverageFiles: codeCoverage.files,
    noCoveragePct: codeCoverage.noCoveragePct,
    noCoverageFiles: codeCoverage.noCoverageFiles,
    goodCoveragePct: codeCoverage.goodCoveragePct,
    goodCoverageFiles: codeCoverage.goodCoverageFiles,
    numberOfImages: imageCapture.numberOfImages,
    imageCaptureDiffNewCount: imageCaptureDiff.newCount,
    imageCaptureDiffChangedCount: imageCaptureDiff.changedCount,
    imageCaptureDiffRemovedCount: imageCaptureDiff.removedCount,
    prettyMilliseconds: (ms) => (ms != null ? prettyMilliseconds(ms) : ""),
  });
}

async function fetchLinesOfCode(owner, repository, branch, dependencies) {
  let linesOfCode = null;
  const linesOfCodeData = await dependencies.db.linesofcode.fetchLatestLinesOfCode(
    owner,
    repository,
    branch
  );

  let totalLinesOfCode = 0;
  let totalFiles = 0;

  if (linesOfCodeData != null) {
    const total = [];
    const labels = [];
    const colors = [];

    for (let index = 0; index < linesOfCodeData.languages.length; index++) {
      totalLinesOfCode += linesOfCodeData.languages[index].code_lines;
      totalFiles += linesOfCodeData.languages[index].number_of_files;
    }

    for (let index = 0; index < linesOfCodeData.languages.length; index++) {
      const pct = Math.round(
        (linesOfCodeData.languages[index].code_lines / totalLinesOfCode) * 100
      );
      labels.push(
        linesOfCodeData.languages[index].language + " (" + pct.toString() + "%)"
      );
      total.push(pct);
      colors.push(randomColor());
    }

    linesOfCode = {
      labels: labels,
      datasets: [
        {
          label: "Language",
          data: total,
          backgroundColor: colors,
        },
      ],
    };
  }

  return {
    linesOfCode: linesOfCode,
    totalLinesOfCode: totalLinesOfCode,
    totalFiles: totalFiles,
  };
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
      coveragePct: Math.round(latest.lineCoverage * 100),
      files: totalFiles,
      noCoveragePct: Math.round(noCoveragePct * 100),
      noCoverageFiles: noCoverageFiles,
      goodCoveragePct: Math.round(goodCoveragePct * 100),
      goodCoverageFiles: goodCoverageFiles,
    };
  }
}

async function fetchImageCapture(owner, repository, branch, dependencies) {
  const latest = await dependencies.db.imagecapture.fetchLatestImageCapture(
    owner,
    repository,
    branch
  );
  if (latest == null) {
    return {
      numberOfImages: 0,
    };
  } else {
    return {
      numberOfImages: latest.files.length,
    };
  }
}

async function fetchImageCaptureDiff(owner, repository, branch, dependencies) {
  const latest = await dependencies.db.imagecapturediff.fetchLatestImageCaptureDiff(
    owner,
    repository,
    branch
  );
  if (latest == null) {
    return {
      newCount: 0,
      changedCount: 0,
      removedCount: 0,
    };
  } else {
    return {
      newCount: latest.raw_json.new.length,
      changedCount: latest.raw_json.changed.length,
      removedCount: latest.raw_json.removed.length,
    };
  }
}

module.exports.path = path;
module.exports.handle = handle;
