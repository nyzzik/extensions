import {
    ButtonRow,
    Form,
    InputRow,
    LabelRow,
    Section,
    ToggleRow,
    type FormSectionElement,
    type ListSectionElement,
} from "@paperback/types";
import type { AsuraUser } from "../interfaces/interfaces";

function toBoolean(value: unknown): boolean {
    return (value ?? false) === "true";
}

export function getHQthumb(): boolean {
    return toBoolean(Application.getState("HQthumb"));
}

export function getShowUpcomingChapters(): boolean {
    return toBoolean(Application.getState("prerelease"));
}

export function setHQthumb(value: boolean): void {
    Application.setState(value.toString(), "HQthumb");
}

export function setShowUpcomingChapters(value: boolean): void {
    Application.setState(value.toString(), "prerelease");
}

export function clearTags(): void {
    Application.setState(undefined, "tags");
}

export async function getAccessToken(): Promise<string> {
    if (Application.getState("accessToken")) {
        let url = "https://api.asurascans.com/api/auth/refresh";
        const [res, buffer] = await Application.scheduleRequest({
            url,
            method: "POST",
            body: JSON.stringify({ refresh_token: Application.getState("refreshToken") }),
        });
        if (res.status !== 200) {
            throw new Error("Access token expired. Please sign in again.");
        }
        const responseBody = JSON.parse(Application.arrayBufferToUTF8String(buffer));
        Application.setState(responseBody.data.access_token, "accessToken");
        Application.setState(responseBody.data.refresh_token, "refreshToken");
        Application.setState(responseBody.data.expires_at, "tokenExpiration");
    }
    return Application.getState("accessToken") as string;
}

export class AsuraSettingForm extends Form {
    override getSections() {
        let sections: ListSectionElement[] = [];

        if (
            Application.getState("user") &&
            Application.getState("accessToken") &&
            new Date() < new Date(Application.getState("tokenExpiration") as string)
        ) {
            let user = Application.getState("user") as AsuraUser;
            sections.push(this.getUserSection(user));
        } else {
            sections.push(this.getSignInSection());
        }

        console.log(Application.getState("tokenExpiration") as string);
        return [
            ...sections,
            Section("second", [
                ToggleRow("pre", {
                    title: "Show Upcoming Chapters",
                    value: getShowUpcomingChapters(),
                    onValueChange: Application.Selector(this as AsuraSettingForm, "preChange"),
                }),
                ButtonRow("clearTags", {
                    title: "Clear Cached Search Tags",
                    onSelect: Application.Selector(this as AsuraSettingForm, "tagsChange"),
                }),
            ]),
        ];
    }

    getUserSection(user: AsuraUser): ListSectionElement {
        let section: ListSectionElement = Section("user", []);

        section.items.push(
            LabelRow("username", {
                title: "Username",
                value: user?.username ?? "Not Signed In",
                subtitle: user.id.toString(),
            }),
        );

        if (user.description != "") {
            section.items.push(
                LabelRow("description", {
                    title: "Description",
                    value: user?.description ?? "No Description",
                }),
            );
        }

        return section;
    }

    getSignInSection(): ListSectionElement {
        return Section("signIn", [
            InputRow("username", {
                title: "Username",
                value: (Application.getState("username") as string) ?? "",
                onValueChange: Application.Selector(this as AsuraSettingForm, "saveUsername"),
            }),
            InputRow("password", {
                title: "Password",
                value: (Application.getState("password") as string) ?? "",
                isSecureEntry: true,
                onValueChange: Application.Selector(this as AsuraSettingForm, "savePassword"),
            }),
        ]);
    }

    async hQthumbChange(value: boolean): Promise<void> {
        setHQthumb(value);
    }

    async preChange(value: boolean): Promise<void> {
        setShowUpcomingChapters(value);
    }

    async tagsChange(): Promise<void> {
        clearTags();
    }

    async resetState(): Promise<void> {
        Application.resetAllState();
    }

    async oauthLoginSuccess(refreshToken: string, accessToken: string): Promise<void> {
        Application.setState(refreshToken, "refreshToken");
        Application.setState(accessToken, "accessToken");
    }

    async saveUsername(username: string): Promise<void> {
        Application.setState(username, "username");
    }

    async savePassword(password: string): Promise<void> {
        const [, buffer] = await Application.scheduleRequest({
            headers: {
                Accept: "*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "Content-Type": "application/json",
                "Sec-GPC": "1",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-site",
                Priority: "u=0",
            },
            url: "https://api.asurascans.com/api/auth/login",
            method: "POST",
            body: `{"email":"${Application.getState("username") as string}","password":"${password as string}"}`,
        });
        const responseBody = JSON.parse(Application.arrayBufferToUTF8String(buffer));
        Application.setState(responseBody.data.user, "user");
        Application.setState(responseBody.data.access_token, "accessToken");
        Application.setState(responseBody.data.refresh_token, "refreshToken");
        Application.setState(responseBody.data.expires_at, "tokenExpiration");

        this.reloadForm();
    }
}
