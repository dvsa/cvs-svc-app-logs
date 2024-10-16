import Response from "../api/Response";
import { HttpStatus } from "@dvsa/cvs-microservice-common/api/http-status-codes";

export default (
  body: {},
  statusCode = HttpStatus.OK,
  reqHeaders: { [id: string]: string } = {},
): Response => {
  const accessControlAllowOriginHeader = {
    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
  };

  return {
    statusCode,
    headers: { ...accessControlAllowOriginHeader, ...reqHeaders },
    body: body === null ? null : JSON.stringify(body),
  };
};
