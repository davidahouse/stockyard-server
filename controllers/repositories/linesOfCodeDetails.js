const prettyMilliseconds = require("pretty-ms");
const randomColor = require("randomcolor");

/**
 * path this handler will serve
 */
function path() {
  return "/repositories/linesOfCodeDetails";
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
    "Lines of code details for: " + owner + " / " + repository
  );
  dependencies.logger.verbose("Branch is: " + branch);

  const linesOfCode = await fetchLinesOfCode(
    owner,
    repository,
    branch,
    dependencies
  );

  const sortedLanguages = linesOfCode.languages.sort(function (a, b) {
    const aloc = parseInt(a.code_lines);
    const bloc = parseInt(b.code_lines);
    if (aloc < bloc) {
      return 1;
    } else if (aloc > bloc) {
      return -1;
    } else {
      return 0;
    }
  });

  res.render(dependencies.viewsPath + "repositories/linesOfCodeDetails", {
    owners: owners,
    isAdmin: req.validAdminSession,
    owner: owner,
    repository: repository,
    branch: branch,
    linesOfCode: linesOfCode.linesOfCode,
    totalLinesOfCode: linesOfCode.totalLinesOfCode,
    totalFiles: linesOfCode.totalFiles,
    languages: sortedLanguages,
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
    languages: linesOfCodeData.languages,
  };
}

module.exports.path = path;
module.exports.handle = handle;
