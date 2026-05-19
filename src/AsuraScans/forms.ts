import {
    AdvancedSearchForm,
    type FormItemElement,
    type FormSectionElement,
    type SearchQuery,
    Section,
    SelectRow,
    type TagSection,
    ToggleRow,
} from "@paperback/types";
import { type SearchMetadata, TagSectionId } from "./interfaces/interfaces";
import { getTagFromTagStore } from "./utilities";

export class AsuraScansAdvancedSearchForm extends AdvancedSearchForm {
    private readonly searchMetadata: SearchMetadata;
    private readonly tags: TagSection[];

    constructor(searchQuery: SearchQuery<SearchMetadata>, tags: TagSection[]) {
        super();
        this.searchMetadata = searchQuery.metadata ?? {};
        this.tags = tags;
    }

    getSearchQueryMetadata(): SearchMetadata {
        return this.searchMetadata;
    }

    getSections(): FormSectionElement<unknown>[] {
        return [
            Section("genres", this.getGenresFilter(this.tags)),
            Section("seriesStatus", this.getSeriesStatusFilter(this.tags)),
            Section("seriesType", this.getSeriesTypesFilter(this.tags)),
            Section("order", this.getOrderFilter()),
        ];
    }

    getGenresFilter(tags: TagSection[]): FormItemElement<unknown>[] {
        const tag = getTagFromTagStore(TagSectionId.Genres, tags);
        return [
            SelectRow("genres", {
                title: tag.title,
                subtitle: "Select the genre(s) to include in search results",
                value: this.searchMetadata.genres ?? [],
                minItemCount: 0,
                maxItemCount: tag.tags.length,
                options: tag.tags.map((x) => ({ id: x.id, title: x.title })),
                onValueChange: Application.Selector(
                    this as AsuraScansAdvancedSearchForm,
                    "handleGenresChange",
                ),
            }),
        ];
    }

    async handleGenresChange(value: string[]): Promise<void> {
        this.searchMetadata.genres = value;
    }

    getSeriesStatusFilter(tags: TagSection[]): FormItemElement<unknown>[] {
        const tag = getTagFromTagStore(TagSectionId.SeriesStatus, tags);
        return [
            SelectRow("seriesStatus", {
                title: tag.title,
                subtitle: "Select the series status(es) to include in search results",
                value: this.searchMetadata.seriesStatus ?? [],
                minItemCount: 0,
                maxItemCount: 1,
                options: tag.tags.map((x) => ({ id: x.id, title: x.title })),
                onValueChange: Application.Selector(
                    this as AsuraScansAdvancedSearchForm,
                    "handleSeriesStatusChange",
                ),
            }),
        ];
    }

    async handleSeriesStatusChange(value: string[]): Promise<void> {
        this.searchMetadata.seriesStatus = value;
    }

    getSeriesTypesFilter(tags: TagSection[]): FormItemElement<unknown>[] {
        const tag = getTagFromTagStore(TagSectionId.SeriesType, tags);
        return [
            SelectRow("seriesType", {
                title: "Series Type",
                subtitle: "Select the series type(s) to include in search results",
                value: this.searchMetadata.seriesType ?? [],
                minItemCount: 0,
                maxItemCount: 1,
                options: tag.tags.map((x) => ({ id: x.id, title: x.title })),
                onValueChange: Application.Selector(
                    this as AsuraScansAdvancedSearchForm,
                    "handleSeriesTypeChange",
                ),
            }),
        ];
    }

    async handleSeriesTypeChange(value: string[]): Promise<void> {
        this.searchMetadata.seriesType = value;
    }

    getOrderFilter(): FormItemElement<unknown>[] {
        return [
            ToggleRow("order", {
                title: "Order Descending",
                subtitle: "Toggle on to sort in descending order",
                value: this.searchMetadata.orderIsDescending ?? false,
                onValueChange: Application.Selector(
                    this as AsuraScansAdvancedSearchForm,
                    "handleOrderChange",
                ),
            }),
        ];
    }

    async handleOrderChange(value: boolean): Promise<void> {
        this.searchMetadata.orderIsDescending = value;
    }
}
