import { PaperbackInterceptor, type Request, type Response } from "@paperback/types";
import { MG_DOMAIN } from "./config";

export class MangaGoInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...request.headers,
      referer: `${MG_DOMAIN}/`,
    };
    return request;
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    return data;
  }
}
