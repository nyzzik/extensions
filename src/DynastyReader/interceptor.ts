import { PaperbackInterceptor, type Request, type Response } from "@paperback/types";
import { DS_DOMAIN } from "./config";

export class DynastyReaderInterceptor extends PaperbackInterceptor {
    override async interceptRequest(request: Request): Promise<Request> {
        request.headers = {
            ...request.headers,
            referer: `${DS_DOMAIN}/`,
            "user-agent": await Application.getDefaultUserAgent(),
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
