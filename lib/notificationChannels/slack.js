"use strict";
const prettyMilliseconds = require("pretty-ms");
const axios = require('axios').default;

/**
 * sendNotification
 * @param {*} notification
 */
async function sendNotification(notification, dependencies) {
  const matches = await matchesFilter(notification, dependencies);
  if (matches == false) {
    return;
  }

  let notificationPayload = null;
  if (notification.notification === "buildStarted") {
    notificationPayload = await prepareBuildStartedNotification(
      notification,
      dependencies
    );
  } else if (notification.notification === "buildCompleted") {
    notificationPayload = await prepareBuildCompletedNotification(
      notification,
      dependencies
    );
  }

  if (notificationPayload != null) {
    await sendNotificationToSlackAPI(
      notificationPayload,
      notification.channelConfig.config,
      dependencies
    );
  }
}

async function prepareBuildStartedNotification(notification, dependencies) {
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            ":racehorse: *Build started:* " +
            notification.payload.owner +
            "/" +
            notification.payload.repo +
            " " +
            notification.payload.buildKey +
            " #" +
            notification.payload.buildNumber +
            " " +
            "*<" +
            dependencies.serverConfig.webURL +
            "/repositories/buildDetails?buildID=" +
            notification.build +
            "|More info...>*",
        },
      },
    ],
  };
}

async function prepareBuildCompletedNotification(notification, dependencies) {
  let moreInfoURL = dependencies.serverConfig.webURL;
  if (dependencies.serverConfig.slackNotificationMoreInfoURL != null) {
    moreInfoURL = dependencies.serverConfig.slackNotificationMoreInfoURL;
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
            "- *<" +
            artifactRows.rows[aindex].url +
            "|" +
            artifactRows.rows[aindex].title +
            ">*\n";
        } else if (artifactRows.rows[aindex].type == "installplist") {
          artifactList +=
            "- *<" +
            "itms-services://?action=download-manifest&url=" +
            encodeURIComponent(artifactRows.rows[aindex].url) +
            "|" +
            artifactRows.rows[aindex].title +
            ">*\n";
        } else if (artifactRows.rows[aindex].type == "cloc") {
          artifactList +=
            "- *<" +
            dependencies.serverConfig.webURL +
            "/artifacts/viewCloc?taskID=" +
            task.task_id +
            "&artifact=" +
            encodeURI(artifactRows.rows[aindex].title) +
            "|" +
            artifactRows.rows[aindex].title +
            ">*\n";
        } else if (artifactRows.rows[aindex].type == "xcodebuild") {
          artifactList +=
            "- *<" +
            dependencies.serverConfig.webURL +
            "/artifacts/viewXcodebuild?taskID=" +
            task.task_id +
            "&artifact=" +
            encodeURI(artifactRows.rows[aindex].title) +
            "|" +
            artifactRows.rows[aindex].title +
            ">*\n";
        } else if (artifactRows.rows[aindex].type == "imagegallery") {
          artifactList +=
            "- *<" +
            dependencies.serverConfig.webURL +
            "/artifacts/viewImageGallery?taskID=" +
            task.task_id +
            "&artifact=" +
            encodeURI(artifactRows.rows[aindex].title) +
            "|" +
            artifactRows.rows[aindex].title +
            ">*\n";
        } else if (artifactRows.rows[aindex].type == "imagediff") {
          artifactList +=
            "- *<" +
            dependencies.serverConfig.webURL +
            "/artifacts/viewImageGalleryDiff?taskID=" +
            task.task_id +
            "&artifact=" +
            encodeURI(artifactRows.rows[aindex].title) +
            "|" +
            artifactRows.rows[aindex].title +
            ">*\n";
        } else {
          artifactList +=
            "- *<" +
            dependencies.serverConfig.webURL +
            "/artifacts/viewUnknown?taskID=" +
            task.task_id +
            "&artifact=" +
            encodeURI(artifactRows.rows[aindex].title) +
            "|" +
            artifactRows.rows[aindex].title +
            ">*\n";
        }
      }
    }
  }

  let message = "";
  if (failedTasks == true) {
    message =
      "@channel :scream: Oh no! Some of the stampede tasks have failed for build " +
      notification.payload.owner +
      "/" +
      notification.payload.repo +
      " " +
      notification.payload.buildKey +
      " #" +
      notification.payload.buildNumber +
      ":\n\n";

    for (let index = 0; index < tasks.length; index++) {
      if (tasks[index].conclusion == "failure") {
        message += "- :x: " + tasks[index].title + "\n";
      } else {
        message += "- :white_check_mark: " + tasks[index].title + "\n";
      }
    }

    message += "\n";
  } else {
    message =
      ":racehorse: *Build completed successfully!* " +
      notification.payload.owner +
      "/" +
      notification.payload.repo +
      " " +
      notification.payload.buildKey +
      " #" +
      notification.payload.buildNumber +
      "\n\n";

    for (let index = 0; index < tasks.length; index++) {
      if (tasks[index].summary != null) {
        message += "*" + tasks[index].title + "*:\n";
        message += tasks[index].summary + "\n\n";
      }
    }

    if (artifactList != "") {
      message += "*Artifacts*:\n" + artifactList + "\n\n";
    }
  }

  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            message +
            " " +
            "*<" +
            moreInfoURL +
            "/repositories/buildDetails?buildID=" +
            notification.build +
            "|More info...>* ",
        },
      },
    ],
  };
}

async function sendNotificationToSlackAPI(notification, config, dependencies) {
  if (config == null || notification == null) {
    return;
  }

  await axios({
    method: 'post',
    url: "https://" + config.host + "/" + config.path,
    data: notification
  })
    .then(function (response) {
      dependencies.logger.verbose("http notification sent to " + postURL);
    })
    .catch(function (error) {
      dependencies.logger.error("Error sending notification: " + error)
    })
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
