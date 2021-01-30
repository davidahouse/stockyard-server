const { Pool } = require("pg");
const moment = require("moment");
const performance = require("perf_hooks").performance;

let pool;
let systemLogger = null;
let createdTables = false;
let logSlowQueries = "";
let logSQL = false;

/**
 * start
 * @param {*} conf
 */
async function start(conf, logger) {
  systemLogger = logger;
  logSlowQueries = conf.dbLogSlowQueries;
  logSQL = conf.dbLogSQL;
  if (conf.dbCert != null) {
    pool = new Pool({
      user: conf.dbUser,
      host: conf.dbHost,
      database: conf.dbDatabase,
      password: conf.dbPassword,
      port: conf.dbPort,
      ssl: {
        ca: conf.dbCert,
        rejectUnauthorized: false,
      },
    });
  } else {
    pool = new Pool({
      user: conf.dbUser,
      host: conf.dbHost,
      database: conf.dbDatabase,
      password: conf.dbPassword,
      port: conf.dbPort,
    });
  }

  pool.on("connect", (client) => {
    systemLogger.info("Database Connected");
  });

  pool.on("error", (error, client) => {
    systemLogger.error("Database error: " + error);
  });

  createTables(pool);
}

/**
 * stop the database connection
 */
async function stop() {
  await pool.end();
}

async function execute(operation, sql, params) {
  try {
    if (logSQL) {
      systemLogger.info("SQL: " + sql + " " + JSON.stringify(params, null, 2));
    }
    let start = performance.now();
    const result = await pool.query(sql, params);
    let finished = performance.now();
    if (
      (logSlowQueries === "true" && finished - start > 50.0) ||
      logSlowQueries === "all"
    ) {
      systemLogger.info("DB: " + operation + " " + (finished - start) + " ms");
    }
    return result;
  } catch (e) {
    systemLogger.error("DB Error: " + e);
    return null;
  }
}

/**
 * createTables
 */
async function createTables(client) {
  systemLogger.info("Creating stockyard database schema if needed");

  await client.query("CREATE SCHEMA IF NOT EXISTS stockyard;");

  await client.query(
    "CREATE TABLE IF NOT EXISTS stockyard.repositories \
    (owner varchar, \
      repository varchar, \
    PRIMARY KEY (owner, repository));"
  );

  await client.query(
    "CREATE TABLE IF NOT EXISTS stockyard.version \
    (version int);"
  );

  await updateTables(client);
}

/**
 * updateTables
 * @param {*} client
 */
async function updateTables(client) {
  systemLogger.info("Checking for stockyard database schema updates");
  let currentVersion = 0;
  const version = await execute(
    "selectVersion",
    "SELECT * FROM stockyard.version",
    []
  );
  if (version.rows.length == 0) {
    await client.query("INSERT into stockyard.version (version) VALUES (3);");
    return;
  }
  currentVersion = version.rows[0].version;
}

module.exports.start = start;
module.exports.stop = stop;
