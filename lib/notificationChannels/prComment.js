"use strict";
const prettyMilliseconds = require("pretty-ms");

/**
 * sendNotification
 * @param {*} notification
 */
async function sendNotification(notification, dependencies) {
  let notificationPayload = null;

  if (!notification.payload.buildKey.startsWith("pullrequest")) {
    return null;
  }

  const matches = await matchesFilter(notification, dependencies);
  if (matches == false) {
    return;
  }

  const owner = notification.payload.owner;
  const repository = notification.payload.repo;
  const parts = notification.payload.buildKey.split("-");
  const prNumber = parts[1];

  if (notification.notification === "buildCompleted") {
    notificationPayload = await prepareBuildCompletedNotification(
      notification,
      dependencies
    );
  }

  if (notificationPayload != null) {
    await sendNotificationToPRComment(
      owner,
      repository,
      prNumber,
      notificationPayload,
      notification.channelConfig.config,
      dependencies
    );
  }
}

async function prepareBuildCompletedNotification(notification, dependencies) {
  // Ignore any builds that aren't PRs
  let moreInfoURL = dependencies.serverConfig.webURL;
  if (dependencies.serverConfig.prCommentNotificationMoreInfoURL != null) {
    moreInfoURL = dependencies.serverConfig.prCommentNotificationMoreInfoURL;
  }

  const build = await dependencies.db.fetchBuild(notification.build);
  const buildTasks = await dependencies.db.fetchBuildTasks(notification.build);
  const buildDetails = build.rows.length > 0 ? build.rows[0] : {};
  const duration = buildDetails.completed_at
    ? buildDetails.completed_at - buildDetails.started_at
    : null;
  const tasks = [];
  const artifacts = [];
  let artifactList = "";
  let failedTasks = false;
  for (let index = 0; index < buildTasks.rows.length; index++) {
    const taskDetails = await dependencies.cache.fetchTaskConfig(
      buildTasks.rows[index].task
    );
    const task = buildTasks.rows[index];
    task.title = taskDetails.title;
    task.duration =
      task.finished_at != null ? task.finished_at - task.started_at : null;
    if (task.conclusion == "failure") {
      failedTasks = true;
    }
    const detailsRows = await dependencies.db.fetchTaskDetails(task.task_id);
    const taskResultDetails = detailsRows.rows[0];

    if (
      taskResultDetails != null &&
      taskResultDetails.details != null &&
      taskResultDetails.details.result != null &&
      taskResultDetails.details.result.summary != null
    ) {
      task.summary = taskResultDetails.details.result.summary;
    }
    tasks.push(task);

    if (
      taskResultDetails != null &&
      taskResultDetails.details != null &&
      taskResultDetails.details.result != null &&
      taskResultDetails.details.result.artifacts != null
    ) {
      for (
        let aindex = 0;
        aindex < taskResultDetails.details.result.artifacts.length;
        aindex++
      ) {
        artifacts.push(taskResultDetails.details.result.artifacts[aindex]);
      }
    }
    const artifactRows = await dependencies.db.fetchTaskArtifacts(task.task_id);
    if (artifactRows != null && artifactRows.rows != null) {
      for (let aindex = 0; aindex < artifactRows.rows.length; aindex++) {
        artifacts.push(artifactRows.rows[aindex]);

        if (
          artifactRows.rows[aindex].type == "download" ||
          artifactRows.rows[aindex].type == "link"
        ) {
          artifactList +=
            "- [" +
            artifactRows.rows[aindex].title +
            "](" +
            artifactRows.rows[aindex].url +
            ")\n";
        } else if (artifactRows.rows[aindex].type == "installplist") {
          artifactList +=
            "- [" +
            artifactRows.rows[aindex].title +
            "](" +
            "itms-services://?action=download-manifest&url=" +
            encodeURIComponent(artifactRows.rows[aindex].url) +
            ")\n";
        } else if (artifactRows.rows[aindex].type == "cloc") {
          artifactList +=
            "- [" +
            artifactRows.rows[aindex].title +
            "](" +
            dependencies.serverConfig.webURL +
            "/artifacts/viewCloc?taskID=" +
            task.task_id +
            "&artifact=" +
            encodeURI(artifactRows.rows[aindex].title) +
            ")\n";
        } else if (artifactRows.rows[aindex].type == "xcodebuild") {
          artifactList +=
            "- [" +
            artifactRows.rows[aindex].title +
            "](" +
            dependencies.serverConfig.webURL +
            "/artifacts/viewXcodebuild?taskID=" +
            task.task_id +
            "&artifact=" +
            encodeURI(artifactRows.rows[aindex].title) +
            ")\n";
        } else if (artifactRows.rows[aindex].type == "imagegallery") {
          artifactList +=
            "- [" +
            artifactRows.rows[aindex].title +
            "](" +
            dependencies.serverConfig.webURL +
            "/artifacts/viewImageGallery?taskID=" +
            task.task_id +
            "&artifact=" +
            encodeURI(artifactRows.rows[aindex].title) +
            ")\n";
        } else if (artifactRows.rows[aindex].type == "imagediff") {
          artifactList +=
            "- [" +
            artifactRows.rows[aindex].title +
            "](" +
            dependencies.serverConfig.webURL +
            "/artifacts/viewImageGalleryDiff?taskID=" +
            task.task_id +
            "&artifact=" +
            encodeURI(artifactRows.rows[aindex].title) +
            ")\n";
        } else {
          artifactList +=
            "- [" +
            artifactRows.rows[aindex].title +
            "](" +
            dependencies.serverConfig.webURL +
            "/artifacts/viewUnknown?taskID=" +
            task.task_id +
            "&artifact=" +
            encodeURI(artifactRows.rows[aindex].title) +
            ")\n";
        }
      }
    }
  }

  if (failedTasks == true) {
    let message = ":scream: Oh no! Some of the stampede tasks have failed:\n\n";

    for (let index = 0; index < tasks.length; index++) {
      if (tasks[index].conclusion == "failure") {
        message += "- :x: " + tasks[index].title + "\n";
      } else {
        message += "- :white_check_mark: " + tasks[index].title + "\n";
      }
    }

    message += "\n";
    message +=
      "[More Info...](" +
      moreInfoURL +
      "/repositories/buildDetails?buildID=" +
      notification.build +
      ")";

    return message;
  } else {
    let message =
      ":racehorse: Sweet! All your stampede tasks have passed...\n\n";

    for (let index = 0; index < tasks.length; index++) {
      if (tasks[index].summary != null) {
        message += "*" + tasks[index].title + "*:\n";
        message += tasks[index].summary + "\n\n";
      }
    }

    if (artifactList != "") {
      message += "*Artifacts*:\n" + artifactList + "\n\n";
    }

    message +=
      "[More Info...](" +
      moreInfoURL +
      "/repositories/buildDetails?buildID=" +
      notification.build +
      ")";
    return message;
  }
}

async function sendNotificationToPRComment(
  owner,
  repository,
  prNumber,
  notification,
  config,
  dependencies
) {
  if (notification == null) {
    return;
  }

  await dependencies.scm.commentOnPR(
    owner,
    repository,
    prNumber,
    notification,
    dependencies.serverConfig
  );
}

async function matchesFilter(notification, dependencies) {
  if (notification.filter === "all") {
    return true;
  }

  const buildTasks = await dependencies.db.fetchBuildTasks(notification.build);
  let failedTasks = false;
  for (let index = 0; index < buildTasks.rows.length; index++) {
    const task = buildTasks.rows[index];
    if (task.conclusion == "failure") {
      failedTasks = true;
    }
  }

  if (notification.filter === "success" && failedTasks == false) {
    return true;
  } else if (notification.filter === "failure" && failedTasks == true) {
    return true;
  } else {
    return false;
  }
}

module.exports.sendNotification = sendNotification;
