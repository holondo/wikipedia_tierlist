function absoluteUrl(url) {
  if (!url) return "";
  return url.startsWith("//") ? `https:${url}` : url;
}

function stripHtml(value = "") {
  const div = document.createElement("div");
  div.innerHTML = value;
  return div.textContent || div.innerText || "";
}

export async function searchWikipediaPages(query, language, signal) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = new URL(`https://${language}.wikipedia.org/w/rest.php/v1/search/page`);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", "12");

  const response = await fetch(url, {
    signal,
    headers: {
      Accept: "application/json",
      "Api-User-Agent": "WikiTierlist/0.1 (GitHub Pages static app)",
    },
  });

  if (!response.ok) throw new Error(`Wikipedia returned ${response.status}`);
  const data = await response.json();

  return (data.pages || []).map((page) => ({
    id: `${language}wiki:${page.id}`,
    pageId: page.id,
    title: page.title,
    description: page.description || "",
    excerpt: stripHtml(page.excerpt || ""),
    thumbnailUrl: absoluteUrl(page.thumbnail?.url),
    pageUrl: `https://${language}.wikipedia.org/wiki/${page.key}`,
    source: "wikipedia",
    language,
  }));
}

export async function enrichWikipediaItemImage(item, signal) {
  const [pageImage, articleImage] = await Promise.allSettled([
    getPageImage(item, signal),
    getFirstArticleImage(item, signal),
  ]);

  const bestImageUrl = pageImage.status === "fulfilled" && pageImage.value
    ? pageImage.value
    : articleImage.status === "fulfilled" && articleImage.value
      ? articleImage.value
      : item.thumbnailUrl;

  return {
    ...item,
    bestImageUrl: absoluteUrl(bestImageUrl),
  };
}

async function getPageImage(item, signal) {
  const url = actionApiUrl(item.language);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("pageids", String(item.pageId));
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("piprop", "original|thumbnail");
  url.searchParams.set("pithumbsize", "800");

  const page = await fetchFirstPage(url, signal);
  return absoluteUrl(page?.original?.source || page?.thumbnail?.source || "");
}

async function getFirstArticleImage(item, signal) {
  const imageListUrl = actionApiUrl(item.language);
  imageListUrl.searchParams.set("action", "query");
  imageListUrl.searchParams.set("format", "json");
  imageListUrl.searchParams.set("origin", "*");
  imageListUrl.searchParams.set("pageids", String(item.pageId));
  imageListUrl.searchParams.set("prop", "images");
  imageListUrl.searchParams.set("imlimit", "20");

  const page = await fetchFirstPage(imageListUrl, signal);
  const title = (page?.images || [])
    .map((image) => image.title)
    .find((candidate) => /\.(png|jpe?g|webp|gif|svg)$/i.test(candidate));

  if (!title) return "";

  const imageInfoUrl = actionApiUrl(item.language);
  imageInfoUrl.searchParams.set("action", "query");
  imageInfoUrl.searchParams.set("format", "json");
  imageInfoUrl.searchParams.set("origin", "*");
  imageInfoUrl.searchParams.set("titles", title);
  imageInfoUrl.searchParams.set("prop", "imageinfo");
  imageInfoUrl.searchParams.set("iiprop", "url");
  imageInfoUrl.searchParams.set("iiurlwidth", "800");

  const imagePage = await fetchFirstPage(imageInfoUrl, signal);
  const info = imagePage?.imageinfo?.[0];
  return absoluteUrl(info?.thumburl || info?.url || "");
}

function actionApiUrl(language) {
  return new URL(`https://${language}.wikipedia.org/w/api.php`);
}

async function fetchFirstPage(url, signal) {
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: "application/json",
      "Api-User-Agent": "WikiTierlist/0.1 (GitHub Pages static app)",
    },
  });

  if (!response.ok) throw new Error(`Wikipedia returned ${response.status}`);
  const data = await response.json();
  return Object.values(data.query?.pages || {})[0];
}