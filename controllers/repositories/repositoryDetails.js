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

  let linesOfCode = null;
  const linesOfCodeData = await dependencies.db.linesofcode.fetchLatestLinesOfCode(
    owner,
    repository,
    defaultBranch
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

  res.render(dependencies.viewsPath + "repositories/repositoryDetails", {
    owners: owners,
    isAdmin: req.validAdminSession,
    owner: owner,
    repository: repository,
    linesOfCode: linesOfCode,
    totalLinesOfCode: totalLinesOfCode,
    totalFiles: totalFiles,
    prettyMilliseconds: (ms) => (ms != null ? prettyMilliseconds(ms) : ""),
  });
}

module.exports.path = path;
module.exports.handle = handle;
