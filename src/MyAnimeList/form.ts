/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

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
    type MyAnimeListManga,
    type MyAnimeListMangaListStatus,
    type MyAnimeListReadingStatus,
    type MyAnimeListScore,
} from "./interfaces";

export class TrackingForm extends Form {
    sourceMangaId: string;
    error?: Error;
    titleStatus?: MyAnimeListMangaListStatus;

    constructor(sourceMangaId: string) {
        super();
        this.sourceMangaId = sourceMangaId;
    }

    override formWillAppear(): void {
        const request: Request = {
            url: `https://api.myanimelist.net/v2/manga/${this.sourceMangaId}?fields=my_list_status`,
            method: "GET",
        };
        Application.scheduleRequest(request)
            .then(([_, buffer]) => {
                const json = JSON.parse(
                    Application.arrayBufferToUTF8String(buffer),
                ) as MyAnimeListManga;
                if (!this.titleStatus) {
                    this.titleStatus = json.my_list_status;
                }
            })
            .catch((error: Error) => {
                if (!error?.toString().includes("[404]")) {
                    this.error = error;
                }

                if (!this.titleStatus) {
                    this.titleStatus = {
                        score: 0,
                        num_volumes_read: 0,
                        num_chapters_read: 0,
                        is_rereading: false,
                        priority: 0,
                        num_times_reread: 0,
                        reread_value: 0,
                        tags: [],
                        comments: "",
                        updated_at: "",
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
            status: this.titleStatus.status ?? "reading",
            is_rereading: this.titleStatus.is_rereading ?? false,
            score: this.titleStatus.score ?? 0,
            num_volumes_read: this.titleStatus.num_volumes_read ?? 0,
            num_chapters_read: this.titleStatus.num_chapters_read ?? 0,
            num_times_reread: this.titleStatus.num_times_reread ?? 0,
            comments: this.titleStatus.comments ?? "",
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

        if (this.titleStatus == undefined && this.error == undefined) {
            return [Section("loading", [LabelRow("loading", { title: "Loading..." })])];
        }

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

        if (this.titleStatus == undefined) {
            sections.push(this.getNewMediaListEntrySection());
        }

        const trackingSections: ListSectionElement[] = [
            ...this.getProgressSections(),
            ...this.getScoreSections(),
            this.getNotesSection(),
        ];

        // TODO: Add support for custom lists

        for (const trackingSection of trackingSections) {
            sections.push(trackingSection);
        }

        // if (this.titleStatus != undefined) {
        //     sections.push(this.getDeleteSection());
        // }

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
            value: [this.titleStatus?.status ?? readingStatuses[0].id],
            minItemCount: 1,
            maxItemCount: 1,
            options: statusOptions,
            onValueChange: Application.Selector(this as TrackingForm, "statusUpdate"),
        };

        const chapterProgressProps: StepperRowProps = {
            title: "Chapters",
            subtitle: "The highest read chapter number",
            value: this.titleStatus?.num_chapters_read ?? 0,
            minValue: 0,
            maxValue: 99999,
            stepValue: 1,
            loopOver: false,

            onValueChange: Application.Selector(this as TrackingForm, "chapterProgressUpdate"),
        };

        const volumeProgressProps: StepperRowProps = {
            title: "Volumes",
            subtitle: "The highest read volume number",
            value: this.titleStatus?.num_volumes_read ?? 0,
            minValue: 0,
            maxValue: 99999,
            stepValue: 1,
            loopOver: false,
            onValueChange: Application.Selector(this as TrackingForm, "volumeProgressUpdate"),
        };

        const rereadCountProps: StepperRowProps = {
            title: "Reread Count",
            subtitle: "The amount of times you have reread the title",
            value: this.titleStatus?.num_times_reread ?? 0,
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
        this.titleStatus!.status = newStatus[0] as MyAnimeListReadingStatus;
    }

    async chapterProgressUpdate(newChapterProgress: number): Promise<void> {
        this.titleStatus!.num_chapters_read = newChapterProgress;
        this.reloadForm();
    }

    async volumeProgressUpdate(newVolumeProgress: number): Promise<void> {
        this.titleStatus!.num_volumes_read = newVolumeProgress;
        this.reloadForm();
    }

    async rereadCountUpdate(newRereadCount: number): Promise<void> {
        this.titleStatus!.num_times_reread = newRereadCount;
        this.reloadForm();
    }

    getScoreSections(): ListSectionElement[] {
        const scoreProps: StepperRowProps = {
            title: "Score",
            subtitle: "",
            value: this.titleStatus!.score,
            minValue: 0,
            maxValue: 10,
            stepValue: 1,
            loopOver: false,
            onValueChange: Application.Selector(this as TrackingForm, "scoreUpdate"),
        };

        // TODO: Add support for advanced scores

        return [Section({ id: "score", header: "Score" }, [StepperRow("score", scoreProps)])];
    }

    async scoreUpdate(newScore: number): Promise<void> {
        this.titleStatus!.score = Number(newScore.toFixed(0)) as MyAnimeListScore;
        this.reloadForm();
    }

    getNotesSection(): ListSectionElement {
        const notesProps: InputRowProps = {
            title: "Notes",
            value: this.titleStatus!.comments ?? "",
            onValueChange: Application.Selector(this as TrackingForm, "updateNotes"),
        };

        return Section(
            {
                id: "notes",
                header: "Notes",
                footer: "Only you can see your notes",
            },
            [InputRow("notes", notesProps)],
        );
    }

    async updateNotes(newNotes: string): Promise<void> {
        this.titleStatus!.comments = newNotes;
    }

    // getDeleteSection(): ListSectionElement {
    //     const deleteNavigationProps: NavigationRowProps = {
    //         title: "Delete",
    //         form: new DeletionForm(this.titleStatus!),
    //     };

    //     return Section({ id: "delete", footer: "Delete the title from your media list" }, [
    //         NavigationRow("delete", deleteNavigationProps),
    //     ]);
    // }
}

// class DeletionForm extends Form {
//     mediaListId: number | null;

//     constructor(mediaListId: number) {
//         super();
//         this.mediaListId = mediaListId;
//     }

//     override getSections() {
//         if (this.mediaListId == null) {
//             const deletedLabelProps: LabelRowProps = {
//                 title: "Deleted",
//                 subtitle: "The title has been succesfully deleted from your media list",
//             };

//             return [Section("deleted", [LabelRow("deleted", deletedLabelProps)])];
//         }

//         const deleteButtonProps: ButtonRowProps = {
//             title: "Delete",
//             onSelect: Application.Selector(this as DeletionForm, "onDeletion"),
//         };

//         return [
//             Section(
//                 {
//                     id: "delete",
//                     footer: "WARNING: All media list data will be deleted, this action can not be undone",
//                 },
//                 [ButtonRow("delete", deleteButtonProps)],
//             ),
//         ];
//     }

//     async onDeletion(): Promise<void> {
//         const deletionVariables: TitleProgressDeletionVariables = {
//             deleteMediaListEntryId: this.mediaListId!,
//         };

//         const titleProgressDeletion = await makeRequest<
//             TitleProgressDeletion,
//             TitleProgressDeletionVariables
//         >(titleProgressDeletionMutation, true, deletionVariables);

//         if (titleProgressDeletion.DeleteMediaListEntry.deleted) {
//             this.mediaListId = null;
//             this.reloadForm();
//         }
//     }
// }
