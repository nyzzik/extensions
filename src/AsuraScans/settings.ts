import {
    ButtonRow,
    Form,
    type FormSectionElement,
    InputRow,
    LabelRow,
    Section,
    ToggleRow,
} from "@paperback/types";

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
    if (!Application.getState("username") || !Application.getState("password")) {
        throw new Error("Username or password not set. Please check settings.");
    }
    if (!Application.getState("accessToken")) {
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
            body: `{"email":"${Application.getState("username") as string}","password":"${Application.getState("password") as string}"}`,
        });
        const responseBody = JSON.parse(Application.arrayBufferToUTF8String(buffer));
        Application.setState(responseBody.data.access_token, "accessToken");
        Application.setState(responseBody.data.refresh_token, "refreshToken");
    }
    return Application.getState("accessToken") as string;
}

export class AsuraSettingForm extends Form {
    override getSections(): FormSectionElement[] {
        return [
            Section("first", [
                InputRow("username", {
                    title: "Username",
                    value: Application.getState("username") as string,
                    onValueChange: Application.Selector(this as AsuraSettingForm, "saveUsername"),
                }),
                InputRow("password", {
                    title: "Password",
                    value: Application.getState("password") as string,
                    isSecureEntry: true,
                    onValueChange: Application.Selector(this as AsuraSettingForm, "savePassword"),
                }),
                ToggleRow("pre", {
                    title: "Show Upcoming Chapters",
                    value: getShowUpcomingChapters(),
                    onValueChange: Application.Selector(this as AsuraSettingForm, "preChange"),
                }),
                LabelRow("label", {
                    title: "",
                    subtitle:
                        "Enabling HQ thumbnails will use more bandwidth and will load thumbnails slightly slower.",
                }),
            ]),
            Section("second", [
                ButtonRow("clearTags", {
                    title: "Clear Cached Search Tags",
                    onSelect: Application.Selector(this as AsuraSettingForm, "tagsChange"),
                }),
                ButtonRow("resetState", {
                    title: "Reset All State",
                    onSelect: Application.Selector(this as AsuraSettingForm, "resetState"),
                }),
                LabelRow("resetStateLabel", {
                    title: "",
                    subtitle:
                        "Clicking this will reset all state for this extension. Do not click unless you know what you are doing.",
                }),
            ]),
        ];
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
        Application.setState(password, "password");
    }
}
