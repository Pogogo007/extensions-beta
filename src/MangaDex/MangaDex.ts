/* eslint-disable camelcase, @typescript-eslint/explicit-module-boundary-types, radix, unicorn/filename-case */
import {
  PagedResults,
  Source,
  Manga,
  Chapter,
  ChapterDetails,
  HomeSectionRequest,
  HomeSection,
  MangaTile,
  SearchRequest,
  Request,
  MangaUpdates,
  SourceTag,
  TagType,
} from 'paperback-extensions-common'

export class MangaDex extends Source {
  get version(): string {
    return '2.0.75'
  }

  get name(): string {
    return 'MangaDex Unlocked'
  }

  get icon(): string {
    return 'icon.png'
  }

  get author(): string {
    return 'Neko'
  }

  get authorWebsite(): string {
    return 'https://github.com/Pogogo007'
  }

  get description(): string {
    return 'Full MangaDex Experience With Nothing Filtered'
  }

  get hentaiSource(): boolean {
    return false
  }

  get websiteBaseURL(): string {
    return 'https://mangadex.org'
  }

  get sourceTags(): SourceTag[] {
    return [
      {
        text: 'Recommended',
        type: TagType.BLUE,
      },
    ]
  }

  get rateLimit(): number {
    return 1
  }

  get sectionKeys() {
    return {
      shounen: 'shounen',
      recentlyUpdated: 'recentlyUpdated',
    }
  }

  getMangaDetailsRequest(ids: string[]): Request[] {
    return [
      createRequestObject({
        metadata: { ids },
        url: CACHE_MANGA,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        data: JSON.stringify({
          id: ids.map(x => parseInt(x)),
          bypassFilter: true,
        }),
      }),
    ]
  }

  getMangaDetails(data: any, _metadata: any): Manga[] {
    const result = JSON.parse(data)

    const mangas = []
    for (const mangaDetails of result.result) {
      mangas.push(
        createManga({
          id: mangaDetails.id.toString(),
          titles: mangaDetails.titles,
          image:
            mangaDetails.image ??
            'https://mangadex.org/images/avatars/default1.jpg',
          rating: mangaDetails.rating,
          status: mangaDetails.status,
          langFlag: mangaDetails.langFlag,
          langName: mangaDetails.langName,
          artist: mangaDetails.artist,
          author: mangaDetails.author,
          avgRating: mangaDetails.avgRating,
          covers: mangaDetails.covers,
          desc: mangaDetails.description,
          follows: mangaDetails.follows,
          tags: [
            createTagSection({
              id: 'content',
              label: 'Content',
              tags: mangaDetails.content.map((x: any) =>
                createTag({ id: x.id.toString(), label: x.value }),
              ),
            }),
            createTagSection({
              id: 'demographic',
              label: 'Demographic',
              tags: mangaDetails.demographic.map((x: any) =>
                createTag({ id: x.id.toString(), label: x.value }),
              ),
            }),
            createTagSection({
              id: 'format',
              label: 'Format',
              tags: mangaDetails.format.map((x: any) =>
                createTag({ id: x.id.toString(), label: x.value }),
              ),
            }),
            createTagSection({
              id: 'genre',
              label: 'Genre',
              tags: mangaDetails.genre.map((x: any) =>
                createTag({ id: x.id.toString(), label: x.value }),
              ),
            }),
            createTagSection({
              id: 'theme',
              label: 'Theme',
              tags: mangaDetails.theme.map((x: any) =>
                createTag({ id: x.id.toString(), label: x.value }),
              ),
            }),
          ],
          users: mangaDetails.users,
          views: mangaDetails.views,
          hentai: mangaDetails.hentai,
          relatedIds: mangaDetails.relatedIds,
          lastUpdate: mangaDetails.lastUpdate,
        }),
      )
    }

    return mangas
  }

  getChaptersRequest(mangaId: string): Request {
    const metadata = { mangaId }
    return createRequestObject({
      metadata,
      url: `${MD_MANGA_API}/${mangaId}`,
      method: 'GET',
    })
  }

  getChapters(data: any, metadata: any): Chapter[] {
    const chapters = JSON.parse(data).chapter as any

    return Object.keys(chapters).map(id => {
      const chapter = chapters[id]
      const volume = Number(chapter.volume)
      return createChapter({
        id: id,
        chapNum: Number(chapter.chapter),
        langCode: chapter.lang_code,
        volume: Number.isNaN(volume) ? 0 : volume,
        mangaId: metadata.mangaId,
        group: chapter.group_name,
        name: chapter.title,
        time: new Date(Number(chapter.timestamp) * 1000),
      })
    })
  }

  getChapterDetailsRequest(_mangaId: string, chapId: string): Request {
    return createRequestObject({
      url: `${MD_CHAPTER_API}/${chapId}?mark_read=0`,
      method: 'GET',
      incognito: false,
    })
  }

  getChapterDetails(data: any, _metadata: any): ChapterDetails {
    const chapterDetails = JSON.parse(data) as any

    return createChapterDetails({
      id: chapterDetails.id.toString(),
      longStrip: parseInt(chapterDetails.long_strip) === 1,
      mangaId: chapterDetails.manga_id.toString(),
      pages: chapterDetails.page_array.map(
        (x: string) =>
          `${chapterDetails.server}${chapterDetails.hash}/${x}`,
      ),
    })
  }

  constructFilterUpdatedMangaRequest(ids: string[], time: Date, page: number) {
    const metadata = { ids: ids, referenceTime: time, page: page }

    console.log(`time ${time}, idCount: ${ids.length}`)

    return createRequestObject({
      metadata: metadata,
      url: 'https://mangadex.org/titles/0/' + page.toString(),
      method: 'GET',
      incognito: true,
      cookies: [
        createCookie({
          name: 'mangadex_title_mode',
          value: '2',
          domain: MD_DOMAIN,
        }),
      ],
    })
  }

  filterUpdatedMangaRequest(ids: string[], time: Date): Request | null {
    return this.constructFilterUpdatedMangaRequest(ids, time, 1)
  }

  filterUpdatedManga(data: any, metadata: any): MangaUpdates {
    const $ = this.cheerio.load(data)

    console.log(`REFERENCE TIME: ${metadata.referenceTime}`)

    const returnObject: MangaUpdates = {
      ids: [],
      nextPage: this.constructFilterUpdatedMangaRequest(
        metadata.ids,
        metadata.referenceTime,
        metadata.page + 1,
      ),
    }

    for (const elem of $('.manga-entry').toArray()) {
      const id = elem.attribs['data-id']
      const mangaDate = new Date(
        ($(elem).find('time').attr('datetime') ?? '').replace(/-/g, '/'),
      )
      console.log(`${id} updated at ${mangaDate}}`)
      if (mangaDate >= metadata.referenceTime) {
        if (metadata.ids.includes(id)) {
          console.log(`${id} marked as an update`)
          returnObject.ids.push(id)
        }
      } else {
        returnObject.nextPage = undefined
        return createMangaUpdates(returnObject)
      }
    }

    console.log(`Found ${returnObject.ids.length} updates`)
    return createMangaUpdates(returnObject)
  }


  getHomePageSectionRequest(): HomeSectionRequest[] {
    console.log(JSON.stringify(this));
    let request1 = createRequestObject({
      url: 'https://mangadex.org',
      method: "GET"
    });
    let request2 = createRequestObject({
      url: 'https://mangadex.org/updates',
      method: 'GET'
    });

    let section1 = createHomeSection({ id: 'featured_titles', title: 'FEATURED TITLES' });
    let section2 = createHomeSection({ id: 'new_titles', title: 'NEW TITLES' });
    let section3 = createHomeSection({
      id: 'recently_updated',
      title: 'RECENTLY UPDATED TITLES',
      view_more: this.constructGetViewMoreRequest('recently_updated', 1)
    });

    return [
      createHomeSectionRequest({
        request: request1,
        sections: [section1, section2]
      }),
      createHomeSectionRequest({
        request: request2,
        sections: [section3]
      })
    ];
  }

  getHomePageSections(data: any, sections: HomeSection[]): HomeSection[] {
    console.log(JSON.stringify(this));

    let $ = this.cheerio.load(data);
    return sections.map(section => {
      switch (section.id) {
        case 'featured_titles':
          section.items = this.parseFeaturedMangaTiles($);
          break;
        case 'new_titles':
          section.items = this.parseNewMangaSectionTiles($);
          break;
        case 'recently_updated':
          section.items = this.parseRecentlyUpdatedMangaSectionTiles($);
          break;
      }

      return section;
    });
  }

  constructGetViewMoreRequest(key: string, page: number) {
    return createRequestObject({
      url: 'https://mangadex.org/updates/' + page.toString(),
      method: 'GET',
      metadata: {
        key, page
      }
    });
  }

  getViewMoreItems(data: string, key: string, metadata: any): PagedResults {
    let $ = this.cheerio.load(data);

    let updates = this.parseRecentlyUpdatedMangaSectionTiles($);

    return createPagedResults({
      results: updates,
      nextPage: updates.length > 0 ? this.constructGetViewMoreRequest(key, metadata.page + 1) : undefined
    });
  }

  parseFeaturedMangaTiles($: CheerioSelector): MangaTile[] {
    let featuredManga: MangaTile[] = [];

    $("#hled_titles_owl_carousel .large_logo").each(function (i: any, elem: any) {
      let title = $(elem);

      let img = title.find("img").first();
      let links = title.find("a");

      let idStr: any = links.first().attr("href");
      let id = idStr!!.match(/(\d+)(?=\/)/) ?? "-1";

      let caption = title.find(".car-caption p:nth-child(2)");
      let bookmarks = caption.find("span[title=Follows]").text();
      let rating = caption.find("span[title=Rating]").text();

      featuredManga.push(createMangaTile({
        id: id[0],
        image: img.attr("data-src") ?? "",
        title: createIconText({ text: img.attr("title") ?? "" }),
        primaryText: createIconText({ text: bookmarks, icon: 'bookmark.fill' }),
        secondaryText: createIconText({ text: rating, icon: 'star.fill' })
      }));
    });

    return featuredManga;
  }

  parseNewMangaSectionTiles($: CheerioSelector): MangaTile[] {
    let newManga: MangaTile[] = [];

    $("#new_titles_owl_carousel .large_logo").each(function (i: any, elem: any) {
      let title = $(elem);

      let img = title.find("img").first();
      let links = title.find("a");

      let idStr: any = links.first().attr("href");
      let id = idStr.match(/(\d+)(?=\/)/);

      let caption = title.find(".car-caption p:nth-child(2)");
      let obj: any = { name: caption.find("a").text(), group: "", time: Date.parse(caption.find("span").attr("title") ?? " "), langCode: "" };
      let updateTime: string = caption.find("span").text();
      newManga.push(createMangaTile({
        id: id[0],
        image: img.attr("data-src") ?? " ",
        title: createIconText({ text: img.attr("title") ?? " " }),
        subtitleText: createIconText({ text: caption.find("a").text() }),
        secondaryText: createIconText({ text: updateTime, icon: 'clock.fill' })
      }));
    });

    return newManga;
  }

  parseRecentlyUpdatedMangaSectionTiles($: CheerioSelector): MangaTile[] {
    let updates: MangaTile[] = [];
    let elem = $('tr', 'tbody').toArray();
    let i = 0;

    while (i < elem.length) {
      let hasImg: boolean = false;
      let idStr: string = $('a.manga_title', elem[i]).attr('href') ?? '';
      let id: string = (idStr.match(/(\d+)(?=\/)/) ?? '')[0] ?? '';
      let title: string = $('a.manga_title', elem[i]).text() ?? '';
      let image: string = (MD_DOMAIN + $('img', elem[i]).attr('src')) ?? '';

      // in this case: badge will be number of updates
      // that the manga has received within last week
      let badge = 0;
      let pIcon = 'eye.fill';
      let sIcon = 'clock.fill';
      let subTitle = '';
      let pText = '';
      let sText = '';

      let first = true;
      i++;
      while (!hasImg && i < elem.length) {
        // for the manga tile, we only care about the first/latest entry
        if (first && !hasImg) {
          subTitle = $('a', elem[i]).first().text();
          pText = $('.text-center.text-info', elem[i]).text();
          sText = $('time', elem[i]).text().replace('ago', '').trim();
          first = false;
        }
        badge++;
        i++;

        hasImg = $(elem[i]).find('img').length > 0;
      }

      updates.push(createMangaTile({
        id,
        image,
        title: createIconText({ text: title }),
        subtitleText: createIconText({ text: subTitle }),
        primaryText: createIconText({ text: pText, icon: pIcon }),
        secondaryText: createIconText({ text: sText, icon: sIcon }),
        badge
      }));
    }

    return updates;
  }


  constructSearchRequest(query: SearchRequest, page: number, items = 50) {
    return createRequestObject({
      url: CACHE_SEARCH + `?page=${page}&items=${items}`,
      method: 'POST',
      // We cant just JSON.stringify the `SearchRequest` object
      // so this is necessary
      data: JSON.stringify({
        title: query.title,
        includeDemographic: query.includeDemographic?.map(x => parseInt(x)),
        includeTheme: query.includeTheme?.map(x => parseInt(x)),
        includeFormat: query.includeFormat?.map(x => parseInt(x)),
        includeContent: query.includeContent?.map(x => parseInt(x)),
        includeGenre: query.includeGenre?.map(x => parseInt(x)),
        excludeDemographic: query.excludeDemographic?.map(x => parseInt(x)),
        excludeTheme: query.excludeTheme?.map(x => parseInt(x)),
        excludeFormat: query.excludeFormat?.map(x => parseInt(x)),
        excludeContent: query.excludeContent?.map(x => parseInt(x)),
        excludeGenre: query.excludeGenre?.map(x => parseInt(x)),
        includeOperator: query.includeOperator,
        excludeOperator: query.excludeOperator,
        author: query.author,
        artist: query.artist,
        status: query.status,
        hStatus: query.hStatus,
        bypassFilter: true,
      }),
      headers: {
        'content-type': 'application/json',
      },
      metadata: {
        page, items, query
      }
    })
  }

  searchRequest(query: SearchRequest): Request | null {
    return this.constructSearchRequest(query, 1)
  }

  search(data: any, metadata: any): PagedResults | null {
    const result = JSON.parse(data)

    const mangas = []
    for (const mangaDetails of result.result) {
      mangas.push(
        createMangaTile({
          id: mangaDetails.id.toString(),
          image: mangaDetails.image,
          title: createIconText({
            text: mangaDetails.titles[0] ?? 'UNKNOWN',
          }),
        }),
      )
    }

    return createPagedResults({
      results: mangas,
      nextPage:
        mangas.length > 0 ?
          this.constructSearchRequest(metadata.query, metadata.page + 1) :
          undefined,
    })
  }

  getMangaShareUrl(mangaId: string) {
    return `${MD_DOMAIN}/manga/${mangaId}`
  }

  timeDifference(current: number, previous: number) {
    const msPerMinute = 60 * 1000
    const msPerHour = msPerMinute * 60
    const msPerDay = msPerHour * 24
    const msPerMonth = msPerDay * 30
    const msPerYear = msPerDay * 365

    const elapsed = current - previous

    if (elapsed < msPerMinute) {
      return Math.round(elapsed / 1000) + ' sec ago'
    }
    if (elapsed < msPerHour) {
      return Math.round(elapsed / msPerMinute) + ' min ago'
    }
    if (elapsed < msPerDay) {
      return Math.round(elapsed / msPerHour) + ' hrs ago'
    }
    if (elapsed < msPerMonth) {
      return Math.round(elapsed / msPerDay) + ' days ago'
    }
    if (elapsed < msPerYear) {
      return Math.round(elapsed / msPerMonth) + ' months ago'
    }
    return Math.round(elapsed / msPerYear) + ' years ago'
  }
}
