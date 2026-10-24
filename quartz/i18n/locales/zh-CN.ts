import { Translation } from "./definition"

export default {
  propertyDefaults: {
    title: "untitled",
    description: "no description",
  },
  components: {
    callout: {
      note: "Note",
      abstract: "Abstract",
      info: "Info",
      todo: "Todo",
      tip: "Tip",
      success: "Success",
      question: "Question",
      warning: "Warning",
      failure: "Failure",
      danger: "Danger",
      bug: "Bug",
      example: "Example",
      quote: "Quote",
    },
    backlinks: {
      title: "reverse links",
      noBacklinksFound: "can't find any reverse links",
    },
    themeToggle: {
      lightMode: "Light Mode",
      darkMode: "Dark Mode",
    },
    readerMode: {
      title: "Reader Mode",
    },
    explorer: {
      title: "Explorer",
    },
    footer: {
      createdWith: "Created with",
    },
    graph: {
      title: "Knowledge Graph",
    },
    recentNotes: {
      title: "Recent Notes",
      seeRemainingMore: ({ remaining }) => `See ${remaining} more notes →`,
    },
    transcludes: {
      transcludeOf: ({ targetSlug }) => `include${targetSlug}`,
      linkToOriginal: "Link to original note",
    },
    search: {
      title: "Search",
      searchBarPlaceholder: "Search",
    },
    tableOfContents: {
      title: "Contents",
    },
    contentMeta: {
      readingTime: ({ minutes }) => `${minutes}min${minutes === 1 ? "" : "s"} read`,
      pageViews: ({ count }) => `${count} views`,
    },
  },
  pages: {
    rss: {
      recentNotes: "Recent Notes",
      lastFewNotes: ({ count }) => `Last ${count} notes`,
    },
    error: {
      title: "Not Found",
      notFound: "Private note or note does not exist.",
      home: "Return to Home",
    },
    folderContent: {
      folder: "Folder",
      itemsUnderFolder: ({ count }) => `This folder contains ${count} note${count === 1 ? "" : "s"}.`,
    },
    tagContent: {
      tag: "Tag",
      tagIndex: "Tag Index",
      itemsUnderTag: ({ count }) => `This tag contains ${count} note${count === 1 ? "" : "s"}.`,
      showingFirst: ({ count }) => `Showing first ${count} tags.`,
      totalTags: ({ count }) => `Total of ${count} tags.`,
    },
  },
} as const satisfies Translation
