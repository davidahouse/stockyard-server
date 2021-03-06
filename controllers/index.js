/**
 * path this handler will serve
 */
function path() {
  return "/";
}

/**
 * if the route requires admin
 */
function requiresAdmin() {
  return false;
}

/**
 * handle index
 * @param {*} req
 * @param {*} res
 * @param {*} dependencies
 */
async function handle(req, res, dependencies, owners) {
  res.render(dependencies.viewsPath + "index", {
    owners: owners,
    isAdmin: req.validAdminSession,
  });
}

module.exports.path = path;
module.exports.requiresAdmin = requiresAdmin;
module.exports.handle = handle;
