import {
    Form,
    InputRow,
    type InputRowProps,
    LabelRow,
    type LabelRowProps,
    type ListSectionElement,
    type Request,
    Section,
    SelectRow,
    type SelectRowProps,
    type SourceManga,
    StepperRow,
    type StepperRowProps,
} from "@paperback/types";
import {
    readingStatuses,
    type AsuraBookmark,
    type AsuraBookmarkResponse,
    type AsuraScansReadingStatus,
} from "../interfaces/interfaces";
import { URLBuilder } from "../../utils/url-builder/base";
import { AS_API_DOMAIN } from "../config";
import { getAccessToken } from "./settings";

export class TrackingForm extends Form {
    sourceManga: SourceManga;
    error?: Error;
    asuraTitle?: AsuraBookmark;
    new: boolean = true;

    constructor(sourceManga: SourceManga) {
        super();
        this.sourceManga = sourceManga;
    }

    override formWillAppear(): void {
        getAccessToken()
            .then((token) => {
                let request: Request = {
                    url: new URLBuilder(AS_API_DOMAIN)
                        .addPath("api")
                        .addPath("me")
                        .addPath("bookmarks")
                        .addQuery("search", this.sourceManga.mangaInfo.primaryTitle)
                        .build(),
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                };

                Application.scheduleRequest(request)
                    .then(([res, buffer]) => {
                        if (res.status !== 200) {
                            this.error = new Error("Failed to fetch manga progress.");
                        }
                        let response = JSON.parse(
                            Application.arrayBufferToUTF8String(buffer),
                        ) as AsuraBookmarkResponse;

                        this.asuraTitle = response.data.find(
                            (bookmark) => bookmark.series.slug === this.sourceManga.mangaId,
                        );

                        this.new =
                            this.asuraTitle === undefined || this.asuraTitle.last_read_chapter == 0;

                        if (this.asuraTitle === undefined) {
                            let request: Request = {
                                url: new URLBuilder(AS_API_DOMAIN)
                                    .addPath("api")
                                    .addPath("bookmarks")
                                    .addPath(this.sourceManga.mangaInfo.additionalInfo?.id ?? "")
                                    .build(),
                                method: "POST",
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                },
                            };
                            Application.scheduleRequest(request).then(([res, _]) => {
                                if (res.status !== 201) {
                                    this.error = new Error("Failed to create manga progress.");
                                    return;
                                }
                            });
                        }
                        this.reloadForm();
                    })
                    .catch((error: Error) => {
                        throw error;
                    });
            })
            .catch((error: Error) => {
                this.error = error;
            })
            .finally(() => {
                this.reloadForm();
            });
    }

    override requiresExplicitSubmission = true;

    override async formDidSubmit(): Promise<void> {
        if (this.asuraTitle === undefined) {
            return;
        }

        const data: any = {
            status: this.asuraTitle.status ?? "reading",
            last_read_chapter: this.asuraTitle.last_read_chapter ?? 0,
        };

        console.log("DATA: " + JSON.stringify(data));

        const put: Request = {
            url: `https://api.asurascans.com/api/bookmarks/${this.sourceManga.mangaInfo.additionalInfo?.id}`,
            method: "PUT",
            body: data,
            headers: {
                Authorization: `Bearer ${await getAccessToken()}`,
                "Content-Type": "application/json",
            },
        };
        let [res, _] = await Application.scheduleRequest(put);
        if (res.status !== 200) {
            this.error = new Error(`Failed to update manga progress.`);
        }
    }

    override formDidCancel(): void {
        return;
    }

    override getSections() {
        const sections: ListSectionElement[] = [];

        if (this.error != undefined) {
            return [
                Section("error", [
                    LabelRow("error", {
                        title: "Error",
                        subtitle: this.error.toString(),
                    }),
                ]),
            ];
        }

        if (this.new) {
            sections.push(this.getNewMediaListEntrySection());
        }

        const trackingSections: ListSectionElement[] = [...this.getProgressSections()];

        for (const trackingSection of trackingSections) {
            sections.push(trackingSection);
        }

        return sections;
    }

    getNewMediaListEntrySection(): ListSectionElement {
        const newMediaListEntryLabelProps: LabelRowProps = {
            title: "New Media List Entry",
            subtitle: "Selecting Done will add this item to your media list",
        };

        return Section("newMediaListEntry", [
            LabelRow("newMediaListEntry", newMediaListEntryLabelProps),
        ]);
    }

    getProgressSections(): ListSectionElement[] {
        let status = "reading";
        let chapterProgress = 0;
        if (this.asuraTitle !== undefined) {
            status = this.asuraTitle.status;
            chapterProgress = this.asuraTitle.last_read_chapter;
        }
        const statusOptions = [];
        for (const status of readingStatuses) {
            statusOptions.push({
                id: status.id,
                title: status.name,
            });
        }

        const statusProps: SelectRowProps = {
            title: "Status",
            value: [status],
            minItemCount: 1,
            maxItemCount: 1,
            options: statusOptions,
            onValueChange: Application.Selector(this as TrackingForm, "statusUpdate"),
        };

        const chapterProgressProps: StepperRowProps = {
            title: "Chapters",
            subtitle: "The highest read chapter number",
            value: chapterProgress,
            minValue: 0,
            maxValue: this.asuraTitle?.series.chapter_count ?? 9999,
            stepValue: 1,
            loopOver: false,

            onValueChange: Application.Selector(this as TrackingForm, "chapterProgressUpdate"),
        };

        return [
            Section({ id: "progress", header: "Progress" }, [
                SelectRow("status", statusProps),
                StepperRow("chapterProgress", chapterProgressProps),
            ]),
        ];
    }

    async statusUpdate(newStatus: string[]): Promise<void> {
        this.asuraTitle!.status = newStatus[0] as AsuraScansReadingStatus;
    }

    async chapterProgressUpdate(newChapterProgress: number): Promise<void> {
        this.asuraTitle!.last_read_chapter = newChapterProgress;
        this.reloadForm();
    }
}
