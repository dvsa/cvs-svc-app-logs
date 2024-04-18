import { CloudWatchLogsClient, CreateLogStreamCommand, PutLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { randomBytes } from "crypto";
import LogEvent from "../application/LogEvent";
import Logger, { LogDelegate } from "../application/Logger";

export function uniqueLogStreamName(loggerName: string): string {
  const date = new Date();
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const randomUuid = randomBytes(16).toString("hex");
  return `${loggerName}-${year}-${month}-${day}-${randomUuid}`;
}

function ignoreResourceAlreadyExistsException(err: any) {
  if ((err.errorType || err.name) !== "ResourceAlreadyExistsException") {
    throw err;
  }
}

export async function createCloudWatchLogger(
  loggerName: string,
  logGroupName: string
): Promise<LogDelegate> {
  const client = new CloudWatchLogsClient();
  const logStreamName = uniqueLogStreamName(loggerName);
  const input = { // CreateLogStreamRequest
    logGroupName: logGroupName,
    logStreamName: logStreamName
  };

  const command = new CreateLogStreamCommand(input);
  try {
    await client.send(command);
  } catch(err) {
    ignoreResourceAlreadyExistsException(err);
  }

  let sequenceToken: string | undefined = undefined;

  const cloudWatchLogger = async (logEvents: LogEvent[]) => {
    const input = {
      logGroupName: logGroupName,
      logStreamName: logStreamName,
      logEvents: logEvents,
      sequenceToken: sequenceToken,
    };
    const command = new PutLogEventsCommand(input);
    const logResult = await client.send(command);
    sequenceToken = logResult.nextSequenceToken; //nextSequenceToken is deprecated
  };

  console.log(
    `Initialised Custom CloudWatch logging to: ${logGroupName}/${logStreamName}`
  );
  return cloudWatchLogger;
}

export function createConsoleLogger(loggerName: string): LogDelegate {
  console.log("Initialised console logging");
  return async (logEvents: LogEvent[]) =>
    console.log(`${loggerName}: %O`, logEvents);
}

/**
 * Creates a `Logger` object, which can be used to send `LogMessage(s)` to the logging system.
 * @param loggerName The name for the logger.
 * @param cloudWatchLogGroupName The name for the AWS CloudWatch log group to send logs to.
 * @returns `Promise` for completing the action, which returns the created `Logger`.
 */
export async function createLogger(
  loggerName: string,
  cloudWatchLogGroupName: string | undefined
): Promise<Logger> {
  // If the `cloudWatchLogGroupName` variable is set then log to that CloudWatch log group.
  // This is also used to indicate we are running in the infrastructure, so the Amazon SDK will
  // automatically pull access credentials from IAM Role.
  // Otherwise, if the `cloudWatchLogGroupName` variable is NOT set, then log to the console.
  const logDelegate =
    cloudWatchLogGroupName && cloudWatchLogGroupName.length > 0
      ? await createCloudWatchLogger(loggerName, cloudWatchLogGroupName)
      : createConsoleLogger(loggerName);

  // Create and return the Logger.
  return new Logger(logDelegate, loggerName);
}
