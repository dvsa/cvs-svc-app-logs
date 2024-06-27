import { CloudWatchLogsClient, CreateLogStreamCommand, PutLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { mockClient } from "aws-sdk-client-mock";
import { Mock, It, Times } from "typemoq";
import * as logger from "../createLogger";
import { LogDelegate } from "../../application/Logger";

describe("logging", () => {
  const originalConsoleLog = console.log;
  const moqConsoleLog = Mock.ofInstance(console.log);

  beforeEach(() => {
    moqConsoleLog.reset();

    moqConsoleLog
      .setup((x) => x(It.isAny(), It.isAny()))
      .callback((message?: any, ...optionalParams: any[]) =>
        originalConsoleLog(message, ...optionalParams)
      );

    spyOn(console, "log").and.callFake(moqConsoleLog.object);
  });

  describe("createLogger", () => {
    const sut = logger.createLogger;

    const initialisedConsoleLogging = "Initialised console logging";
    const initialisedCloudWatchLogging =
      "Initialised Custom CloudWatch logging";

    it("creates a console logger if no CloudWatch LogGroupName specified", async () => {
      // ACT
      const result = await sut("testLogger", undefined);

      // ASSERT
      expect(result).toBeDefined();
      expect(result.loggerName).toEqual("testLogger");

      moqConsoleLog.verify(
        (x) =>
          x(It.is<string>((s) => s.indexOf(initialisedConsoleLogging) !== -1)),
        Times.once()
      );
      moqConsoleLog.verify(
        (x) =>
          x(
            It.is<string>((s) => s.indexOf(initialisedCloudWatchLogging) !== -1)
          ),
        Times.never()
      );
    });

    it("creates a CloudWatch logger if CloudWatch LogGroupName is specified", async () => {
      // ACT
      const mockCloudWatchClient = mockClient(CloudWatchLogsClient);
      mockCloudWatchClient.on(CreateLogStreamCommand).resolves({});
      const result = await sut("testLogger", "cloudWatchLogGroupName");

      // ASSERT
      expect(result).toBeDefined();
      expect(result.loggerName).toEqual("testLogger");

      moqConsoleLog.verify(
        (x) =>
          x(It.is<string>((s) => s.indexOf(initialisedConsoleLogging) !== -1)),
        Times.never()
      );
      moqConsoleLog.verify(
        (x) =>
          x(
            It.is<string>((s) => s.indexOf(initialisedCloudWatchLogging) !== -1)
          ),
        Times.once()
      );
    });
  });

  describe("createCloudWatchLogger", () => {
    const sut = logger.createCloudWatchLogger;

    it("creates a log delegate that logs to CloudWatch", async () => {
      const mockCloudWatchClient = mockClient(CloudWatchLogsClient);
      mockCloudWatchClient.on(CreateLogStreamCommand).resolves({});
      mockCloudWatchClient.on(PutLogEventsCommand).resolves({ nextSequenceToken: "123" });

      const result: LogDelegate = await sut(
        "testLoggerName",
        "testLogGroupName"
      );
      await result([
        { timestamp: 265473, message: "test log message to cloudwatch" },
      ]);

      const putLogEventsStub = mockCloudWatchClient.commandCalls(PutLogEventsCommand);

      expect(putLogEventsStub[0].args[0].input).toEqual(jasmine.objectContaining({
        logGroupName: "testLogGroupName",
      }));
      expect(putLogEventsStub[0].args[0].input.logStreamName).toContain("testLoggerName");
      expect(putLogEventsStub[0].args[0].input.logEvents).toEqual([{"timestamp":265473,"message":"test log message to cloudwatch"}]);
    });

    it("should call the `createLogStream` CloudWatchLogs method correctly", async () => {
      const mockCloudWatchClient = mockClient(CloudWatchLogsClient);
      mockCloudWatchClient.on(CreateLogStreamCommand).resolves({});
      mockCloudWatchClient.on(PutLogEventsCommand).resolves({ nextSequenceToken: "123" });

      await sut("testLoggerName", "testLogGroupName");
      const createLogEventsStub = mockCloudWatchClient.commandCalls(CreateLogStreamCommand);

      expect(createLogEventsStub[0].args[0].input).toEqual(jasmine.objectContaining({
        logGroupName: "testLogGroupName",
      }));
      expect(createLogEventsStub[0].args[0].input.logStreamName).toContain("testLoggerName");
    });

    it("should use `sequenceToken` from previous `putLogEvents` result", async () => {
      const mockCloudWatchClient = mockClient(CloudWatchLogsClient);
      mockCloudWatchClient.on(CreateLogStreamCommand).resolves({});
      mockCloudWatchClient.on(PutLogEventsCommand).resolves({ nextSequenceToken: "example-sequenceToken-123" });

      const result = await sut("testLoggerName", "testLogGroupName");
      await result([
        { timestamp: 1, message: "test log message to cloudwatch 1" },
      ]);
      await result([
        { timestamp: 2, message: "test log message to cloudwatch 2" },
      ]);
      const putLogEventsStub = mockCloudWatchClient.commandCalls(PutLogEventsCommand);

      expect(putLogEventsStub[0].args[0].input.logEvents).toEqual([{ timestamp: 1, message: "test log message to cloudwatch 1" }]);
      expect(putLogEventsStub[0].args[0].input.sequenceToken).toBeUndefined();

      expect(putLogEventsStub[1].args[0].input.logEvents).toEqual([{ timestamp: 2, message: "test log message to cloudwatch 2" }]);
      expect(putLogEventsStub[1].args[0].input.sequenceToken).toEqual("example-sequenceToken-123");
    });

    it("should swallow a `ResourceAlreadyExistsException` error", async () => {
      const mockCloudWatchClient = mockClient(CloudWatchLogsClient);
      mockCloudWatchClient.on(CreateLogStreamCommand).rejects({name: "ResourceAlreadyExistsException"});

      const result = await sut("testLoggerName", "testLogGroupName");

      expect(result).toBeDefined();
    });

    it("should throw on any other exceptions", async () => {

      const mockCloudWatchClient = mockClient(CloudWatchLogsClient);
      mockCloudWatchClient.on(CreateLogStreamCommand).rejects({name: "SomeOtherException"});

      let errorThrown: any | undefined = undefined;
      let wasErrorThrown = false;

      try {
        await sut("testLoggerName", "testLogGroupName");
      } catch (e) {
        errorThrown = e;
        wasErrorThrown = true;
      }

      expect(wasErrorThrown).toEqual(true);
      expect(errorThrown).toBeDefined();
      expect(errorThrown.name).toEqual("SomeOtherException");
    });
  });

  describe("createConsoleLogger", () => {
    const sut = logger.createConsoleLogger;

    it("creates a log delegate that logs to the console", async () => {
      // ACT
      const result: LogDelegate = sut("testLoggerName");
      await result([{ timestamp: 347574, message: "an example log message" }]);

      // ASSERT
      moqConsoleLog.verify(
        (x) =>
          x(
            It.is<string>((s) => /testLoggerName:/.test(s)),
            It.is<any>((args) =>
              /^an example log message$/.test(args[0].message)
            )
          ),
        Times.once()
      );
    });
  });

  describe("uniqueLogStreamName", () => {
    const sut = logger.uniqueLogStreamName;

    it("returns a string in the expected format", () => {
      // ACT
      const result = sut("LoggerName");

      // ASSERT
      expect(result).toMatch(/^LoggerName-\d\d\d\d-\d\d-\d\d-[0-9a-f]{32}$/);
    });

    it("generates unique names each time", () => {
      const results = new Set();
      const countToGenerate = 50000;

      // ACT
      for (let i = 0; i < countToGenerate; i = i + 1) {
        const result = sut("LoggerName");
        results.add(result);
      }

      // ASSERT
      expect(results.size).toEqual(countToGenerate);
    });
  });
});
