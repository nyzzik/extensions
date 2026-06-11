import { Form, LabelRow, OAuthButtonRow, Section, type FormSectionElement } from "@paperback/types";

export class MALSettingsForm extends Form {
    username: string = "";

    override getSections(): FormSectionElement<unknown>[] {
        let clientId = "5a7227c9c7bc0f28fe4372d791f5971f";

        let sections = [];

        if (Application.getState("malAccessToken") && Application.getState("malRefreshToken")) {
            sections.push(
                LabelRow("username-id", {
                    title: "Username",
                    value: Application.getState("malUsername") as string,
                }),
            );

            if (!Application.getState("malUsername")) {
                const url = "https://api.myanimelist.net/v2/users/@me?fields=anime_statistics";
                const request = {
                    url,
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${Application.getState("malAccessToken")}`,
                    },
                };

                Application.scheduleRequest(request).then((res) => {
                    const response = JSON.parse(Application.arrayBufferToUTF8String(res[1]));
                    Application.setState(response.name, "malUsername");
                    this.reloadForm();
                });
            }

            // this.reloadForm();
        } else {
            sections.push(
                OAuthButtonRow("auth", {
                    title: "mal",
                    onSuccess: Application.Selector(this as MALSettingsForm, "handleLoginSuccess"),
                    authorizeEndpoint: "https://myanimelist.net/v1/oauth2/authorize",
                    responseType: {
                        type: "pkce",
                        tokenEndpoint: `https://myanimelist.net/v1/oauth2/token`,
                        pkceCodeLength: 64,
                        pkceCodeMethod: "plain",
                        formEncodeGrant: true,
                    },
                    clientId,
                }),
            );
        }

        return [Section({ id: "profile-data", header: "Profile" }, sections)];
    }

    async handleLoginSuccess(accessToken: string, refreshToken: string): Promise<void> {
        Application.setState(accessToken, "malAccessToken");
        Application.setState(refreshToken, "malRefreshToken");

        const url = "https://api.myanimelist.net/v2/users/@me?fields=anime_statistics";
        const request = {
            url,
            method: "GET",
            headers: {
                Authorization: `Bearer ${Application.getState("malAccessToken")}`,
            },
        };

        const [_, buffer] = await Application.scheduleRequest(request);
        const response = JSON.parse(Application.arrayBufferToUTF8String(buffer));
        Application.setState(response.name, "malUsername");
        this.reloadForm();
    }

    getMalCodeChallenge() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
        let codeVerifier = "";

        // Generate a random 128-character string
        for (let i = 0; i < 127; i++) {
            codeVerifier += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Because MAL uses 'plain', they are identical

        return codeVerifier;
    }
}
