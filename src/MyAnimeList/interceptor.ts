import { PaperbackInterceptor, type Request, type Response } from "@paperback/types";

export class MyAnimeListInterceptor extends PaperbackInterceptor {
    override async interceptRequest(request: Request): Promise<Request> {
        request.headers = {
            ...request.headers,
            Authorization: `Bearer ${Application.getState("malAccessToken")}`,
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
