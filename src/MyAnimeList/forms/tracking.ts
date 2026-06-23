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
    StepperRow,
    type StepperRowProps,
} from "@paperback/types";
import {
    readingStatuses,
    type MyAnimeListMangaSlim,
    type MyAnimeListReadingStatus,
    type MyAnimeListScore,
} from "../interfaces";

export class TrackingForm extends Form {
    sourceMangaId: string;
    error?: Error;
    titleStatus?: MyAnimeListMangaSlim;

    constructor(sourceMangaId: string) {
        super();
        this.sourceMangaId = sourceMangaId;
    }

    override formWillAppear(): void {
        const request: Request = {
            url: `https://api.myanimelist.net/v2/manga/${this.sourceMangaId}?fields=my_list_status{score,num_volumes_read,num_chapters_read,is_rereading,priority,num_times_reread,reread_value,tags,comments},num_chapters,num_volumes`,
            method: "GET",
        };
        Application.scheduleRequest(request)
            .then(([_, buffer]) => {
                const json = JSON.parse(
                    Application.arrayBufferToUTF8String(buffer),
                ) as MyAnimeListMangaSlim;
                if (!this.titleStatus) {
                    this.titleStatus = json;
                }
                if (!this.titleStatus.my_list_status) {
                    this.titleStatus.my_list_status = {
                        score: 0,
                        num_volumes_read: 0,
                        num_chapters_read: 0,
                        is_rereading: false,
                        priority: 0,
                        num_times_reread: 0,
                        reread_value: 0,
                        tags: [],
                        comments: "",
                    };
                }
            })
            .catch((error: Error) => {
                if (!error?.toString().includes("[404]")) {
                    this.error = error;
                }

                if (!this.titleStatus) {
                    this.titleStatus = {
                        num_chapters: 0,
                        num_volumes: 0,
                        my_list_status: {
                            score: 0,
                            num_volumes_read: 0,
                            num_chapters_read: 0,
                            is_rereading: false,
                            priority: 0,
                            num_times_reread: 0,
                            reread_value: 0,
                            tags: [],
                            comments: "",
                        },
                    };
                }
            })
            .finally(() => {
                this.reloadForm();
            });
    }

    override requiresExplicitSubmission = true;

    override async formDidSubmit(): Promise<void> {
        if (this.titleStatus == undefined) {
            return;
        }

        const data: any = {
            status: this.titleStatus.my_list_status?.status ?? "reading",
            is_rereading: this.titleStatus.my_list_status?.is_rereading ?? false,
            score: this.titleStatus.my_list_status?.score ?? 0,
            num_volumes_read: this.titleStatus.my_list_status?.num_volumes_read ?? 0,
            num_chapters_read: this.titleStatus.my_list_status?.num_chapters_read ?? 0,
            num_times_reread: this.titleStatus.my_list_status?.num_times_reread ?? 0,
            comments: this.titleStatus.my_list_status?.comments ?? "",
        };

        const formBody = Object.keys(data)
            .map((key) => encodeURIComponent(key) + "=" + encodeURIComponent(data[key] as string))
            .join("&");

        const put: Request = {
            url: `https://api.myanimelist.net/v2/manga/${this.sourceMangaId}/my_list_status`,
            method: "PUT",
            body: formBody,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        };
        await Application.scheduleRequest(put);
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

        if (this.titleStatus?.my_list_status?.updated_at === undefined) {
            sections.push(this.getNewMediaListEntrySection());
        }

        const trackingSections: ListSectionElement[] = [
            ...this.getProgressSections(),
            ...this.getScoreSections(),
            this.getCommentsSection(),
        ];

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
        const statusOptions = [];
        for (const status of readingStatuses) {
            statusOptions.push({
                id: status.id,
                title: status.name,
            });
        }

        const statusProps: SelectRowProps = {
            title: "Status",
            value: [this.titleStatus?.my_list_status?.status ?? readingStatuses[0].id],
            minItemCount: 1,
            maxItemCount: 1,
            options: statusOptions,
            onValueChange: Application.Selector(this as TrackingForm, "statusUpdate"),
        };

        const chapterProgressProps: StepperRowProps = {
            title: "Chapters",
            subtitle: "The highest read chapter number",
            value: this.titleStatus?.my_list_status?.num_chapters_read ?? 0,
            minValue: 0,
            maxValue:
                (this.titleStatus?.num_chapters ?? 0) ? this.titleStatus!.num_chapters! : 9999,
            stepValue: 1,
            loopOver: false,

            onValueChange: Application.Selector(this as TrackingForm, "chapterProgressUpdate"),
        };

        const volumeProgressProps: StepperRowProps = {
            title: "Volumes",
            subtitle: "The highest read volume number",
            value: this.titleStatus?.my_list_status?.num_volumes_read ?? 0,
            minValue: 0,
            maxValue: (this.titleStatus?.num_volumes ?? 0) ? this.titleStatus!.num_volumes! : 9999,
            stepValue: 1,
            loopOver: false,
            onValueChange: Application.Selector(this as TrackingForm, "volumeProgressUpdate"),
        };

        const rereadCountProps: StepperRowProps = {
            title: "Reread Count",
            subtitle: "The amount of times you have reread the title",
            value: this.titleStatus?.my_list_status?.num_times_reread ?? 0,
            minValue: 0,
            maxValue: 99999,
            stepValue: 1,
            loopOver: false,
            onValueChange: Application.Selector(this as TrackingForm, "rereadCountUpdate"),
        };

        return [
            Section({ id: "progress", header: "Progress" }, [
                SelectRow("status", statusProps),
                StepperRow("chapterProgress", chapterProgressProps),
                StepperRow("volumeProgress", volumeProgressProps),
                StepperRow("rereadCount", rereadCountProps),
            ]),
        ];
    }

    async statusUpdate(newStatus: string[]): Promise<void> {
        this.titleStatus!.my_list_status!.status = newStatus[0] as MyAnimeListReadingStatus;
    }

    async chapterProgressUpdate(newChapterProgress: number): Promise<void> {
        this.titleStatus!.my_list_status!.num_chapters_read = newChapterProgress;
        this.reloadForm();
    }

    async volumeProgressUpdate(newVolumeProgress: number): Promise<void> {
        this.titleStatus!.my_list_status!.num_volumes_read = newVolumeProgress;
        this.reloadForm();
    }

    async rereadCountUpdate(newRereadCount: number): Promise<void> {
        this.titleStatus!.my_list_status!.num_times_reread = newRereadCount;
        this.reloadForm();
    }

    getScoreSections(): ListSectionElement[] {
        const scoreProps: StepperRowProps = {
            title: "Score",
            subtitle: "",
            value: this.titleStatus?.my_list_status?.score ?? 0,
            minValue: 0,
            maxValue: 10,
            stepValue: 1,
            loopOver: false,
            onValueChange: Application.Selector(this as TrackingForm, "scoreUpdate"),
        };

        return [Section({ id: "score", header: "Score" }, [StepperRow("score", scoreProps)])];
    }

    async scoreUpdate(newScore: number): Promise<void> {
        this.titleStatus!.my_list_status!.score = Number(newScore.toFixed(0)) as MyAnimeListScore;
        this.reloadForm();
    }

    getCommentsSection(): ListSectionElement {
        const commentsProps: InputRowProps = {
            title: "Comments",
            value: this.titleStatus?.my_list_status?.comments ?? "",
            onValueChange: Application.Selector(this as TrackingForm, "updateComments"),
        };

        return Section(
            {
                id: "comments",
                header: "Comments",
                footer: "Only you can see your notes",
            },
            [InputRow("comments", commentsProps)],
        );
    }

    async updateComments(newComments: string): Promise<void> {
        this.titleStatus!.my_list_status!.comments = newComments;
    }
}
