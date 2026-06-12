import {
    ButtonRow,
    Form,
    LabelRow,
    OAuthButtonRow,
    Section,
    ToggleRow,
    type FormSectionElement,
    type ListSectionElement,
} from "@paperback/types";
import type { MyAnimeListUserStatistics } from "../interfaces";

export class MALSettingsForm extends Form {
    userInfo?: MyAnimeListUserStatistics;

    override formWillAppear(): void {
        const url = "https://api.myanimelist.net/v2/users/@me?fields=anime_statistics";
        const request = {
            url,
            method: "GET",
            headers: {
                Authorization: `Bearer ${Application.getState("malAccessToken")}`,
            },
        };

        Application.scheduleRequest(request)
            .then((res) => {
                const response = JSON.parse(
                    Application.arrayBufferToUTF8String(res[1]),
                ) as MyAnimeListUserStatistics;
                this.userInfo = response;
            })
            .finally(() => {
                this.reloadForm();
            });
    }

    override getSections(): FormSectionElement<unknown>[] {
        if (this.userInfo == undefined) {
            return [Section("loading", [LabelRow("loading", { title: "Loading..." })])];
        }

        let sections: ListSectionElement[] = [];

        if (Application.getState("malAccessToken") && Application.getState("malRefreshToken")) {
            sections.push(
                this.getProfileSections(this.userInfo!),
                this.getMangaStatsSection(this.userInfo!),
            );
        } else {
            sections.push(this.getLoginSection());
        }

        sections.push(this.getToggleSection());

        return sections;
    }

    async handleLoginSuccess(accessToken: string, refreshToken: string): Promise<void> {
        Application.setState(accessToken, "malAccessToken");
        Application.setState(refreshToken, "malRefreshToken");

        this.reloadForm();
    }

    getLoginSection() {
        let clientId = "5a7227c9c7bc0f28fe4372d791f5971f";
        return Section({ id: "profile-data", header: "Profile:" }, [
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
        ]);
    }

    getProfileSections(info: MyAnimeListUserStatistics): ListSectionElement {
        return Section({ id: "profile-data", header: "Profile:" }, [
            LabelRow("username-id", {
                title: "Username",
                value: info.name,
                subtitle: info.id.toString(),
            }),
            ButtonRow("logout", {
                title: "Log Out",
                onSelect: Application.Selector(this as MALSettingsForm, "handleLogout"),
            }),
        ]);
    }

    getMangaStatsSection(_info: MyAnimeListUserStatistics): ListSectionElement {
        return Section({ id: "manga-stats", header: "Manga Statistics" }, [
            LabelRow("manga-stats", {
                title: "Uhh so i wanted to show the user's manga stats here but their API doesn't support it. 😔 \n Maybe in the future they will support it.",
            }),
        ]);
    }

    getToggleSection(): ListSectionElement {
        return Section({ id: "toggles" }, [
            ToggleRow("safe-mode", {
                title: "Safe Mode",
                subtitle: "Hide NSFW content in search.",
                value: (Application.getState("nsfw") as boolean) ?? true,
                onValueChange: Application.Selector(this as MALSettingsForm, "handleNSFWToggle"),
            }),
        ]);
    }

    async handleLogout(): Promise<void> {
        Application.setState(undefined, "malAccessToken");
        Application.setState(undefined, "malRefreshToken");
        this.userInfo = undefined;
    }

    async handleNSFWToggle(value: boolean): Promise<void> {
        Application.setState(value, "nsfw");
    }
}
