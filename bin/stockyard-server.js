#!/usr/bin/env node
"use strict";
const clear = require("clear");
const figlet = require("figlet");
const fs = require("fs");
const os = require("os");
require("pkginfo")(module);
const viewsPath = __dirname + "/../views/";
const winston = require("winston");

// Dependencies
const db = require("../lib/db");
const cache = require("../lib/cache/cache");

// Services
const web = require("../services/web");
const notification = require("../services/notification");

const thirtySeconds = 1000 * 30;
const fiveMinuteInterval = 1000 * 60 * 5;
const conf = require("rc")("stockyard", {
  // redis
  redisHost: "localhost",
  redisPort: 6379,
  redisPassword: null,
  // web
  webURL: "http://localhost:7777",
  webPort: 7777,
  // Postgres
  dbHost: "localhost",
  dbDatabase: "stockyard",
  dbUser: "postgres",
  dbPassword: null,
  dbPort: 54320,
  dbCert: null,
  dbLogSlowQueries: "",
  dbLogSQL: false,
  // Misc
  incomingQueue: "incoming",
  notificationQueues: "",
  // Control if the server enables the portal functions of the UI & API
  handlePortal: "enabled",
  // Control if the server will handle anything in the incoming queue
  handleIncomingQueue: "enabled",
  // Control if the server will handle notification channel queue
  handleNotificationChannelQueue: "enabled",
  // Admin mode
  adminPassword: "stockyard",
  // Logging
  logLevel: "info",
  // Retention
  defaultDataRetentionDays: 30,
  // API Docs
  enableApiDocs: false,
  // Notification channels
  slackNotificationMoreInfoURL: null,
  prCommentNotificationMoreInfoURL: null,
  // Default branch
  defaultBranch: "main",
});

// Configure winston logging
const logFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.align(),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

const logger = winston.createLogger({
  level: conf.logLevel,
  format: logFormat,
  transports: [new winston.transports.Console()],
});

clear();
logger.info(figlet.textSync("stockyard", { horizontalLayout: "full" }));
logger.info(module.exports.version);
logger.info("Redis Host: " + conf.redisHost);
logger.info("Redis Port: " + conf.redisPort);
logger.info("Web Port: " + conf.webPort);

// Initialize our cache
cache.startCache(conf);

// Setup a redis config for our Queue system
const redisConfig = {
  redis: {
    port: conf.redisPort,
    host: conf.redisHost,
    password: conf.redisPassword,
  },
};

/**
 * Handle shutdown gracefully
 */
process.on("SIGINT", function () {
  gracefulShutdown();
});

/**
 * gracefulShutdown
 */
async function gracefulShutdown() {
  logger.verbose("Closing queues");
  await db.stop();
  await cache.stopCache();
  await web.stop();
  process.exit(0);
}

db.start(conf, logger);

let scheduleDuration = 0;

async function schedule() {
  scheduleDuration += thirtySeconds;
  if (scheduleDuration > fiveMinuteInterval) {
    if (conf.handleRetentionScheduler === "enabled") {
      await retentionHandler.handle(dependencies);
    }
    scheduleDuration = 0;
  }
}

const dependencies = {
  serverConfig: conf,
  cache: cache,
  db: db,
  redisConfig: redisConfig,
  viewsPath: viewsPath,
  logger: logger,
};

// Start all our services
notification.start(dependencies);
web.start(dependencies);
