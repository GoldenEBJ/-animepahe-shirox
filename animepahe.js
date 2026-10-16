/*
 * AnimePahe module for ShiroX
 * Author: GoldenEBJ
 *
 * Initial implementation:
 * - Anime search
 * - Anime details
 * - Episode listings
 *
 * API compatibility and playback are not yet verified.
 */

const BASE_URL = "https://animepahe.ch";

const HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Referer": BASE_URL + "/"
};

/**
 * Fetch text using ShiroX's fetchv2 bridge.
 */
async function getText(url) {
    const response = await fetchv2(url, HEADERS);

    if (typeof response === "string") {
        return response;
    }

    if (response && typeof response.text === "function") {
        return await response.text();
    }

    if (response && typeof response.body === "string") {
        return response.body;
    }

    if (response && typeof response._data === "string") {
        return response._data;
    }

    throw new Error("Unable to read response from " + url);
}

/**
 * Fetch and parse JSON.
 */
async function getJSON(url) {
    const response = await getText(url);
    return JSON.parse(response);
}

/**
 * Convert relative URLs into absolute URLs.
 */
function absoluteURL(url) {
    if (!url) return "";

    if (/^https?:\/\//i.test(url)) {
        return url;
    }

    if (url.startsWith("//")) {
        return "https:" + url;
    }

    if (url.startsWith("/")) {
        return BASE_URL + url;
    }

    return BASE_URL + "/" + url;
}

/**
 * Search AnimePahe.
 *
 * Expected result:
 * [{ title, image, href }]
 */
globalThis.searchResults = async function (keyword) {
    try {
        const url =
            BASE_URL +
            "/api?m=search&q=" +
            encodeURIComponent(keyword);

        const response = await getJSON(url);

        const items = Array.isArray(response.data)
            ? response.data
            : [];

        const results = items.map(function (item) {
            return {
                title: item.title || item.english || "Unknown anime",
                image: absoluteURL(item.poster || item.image || ""),
                href: absoluteURL(
                    "/anime/" + (item.session || item.id || "")
                )
            };
        }).filter(function (item) {
            return item.href !== BASE_URL + "/anime/";
        });

        return JSON.stringify(results);
    } catch (error) {
        return JSON.stringify([]);
    }
};

/**
 * Extract basic anime details.
 *
 * Expected result:
 * [{ description, aliases, airdate }]
 */
globalThis.extractDetails = async function (url) {
    try {
        const html = await getText(url);

        function getMeta(property) {
            const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            const patterns = [
                new RegExp(
                    '<meta[^>]+property=["\\']' +
                    escaped +
                    '["\\'][^>]+content=["\\']([^"\\']*)',
                    "i"
                ),
                new RegExp(
                    '<meta[^>]+content=["\\']([^"\\']*)["\\'][^>]+property=["\\']' +
                    escaped +
                    '["\\']',
                    "i"
                )
            ];

            for (let i = 0; i < patterns.length; i++) {
                const match = html.match(patterns[i]);
                if (match) return match[1];
            }

            return "";
        }

        const description =
            getMeta("og:description") ||
            getMeta("description");

        const aliases = getMeta("og:title");

        return JSON.stringify([{
            description: description,
            aliases: aliases,
            airdate: ""
        }]);
    } catch (error) {
        return JSON.stringify([{
            description: "",
            aliases: "",
            airdate: ""
        }]);
    }
};

/**
 * Extract episodes.
 *
 * Expected result:
 * [{ href, number }]
 *
 * AnimePahe commonly exposes episode information through
 * its release API. The exact response needs verification
 * against the selected domain.
 */
globalThis.extractEpisodes = async function (url) {
    try {
        const match = url.match(/\/anime\/([^/?#]+)/i);

        if (!match) {
            return JSON.stringify([]);
        }

        const session = match[1];

        const apiURL =
            BASE_URL +
            "/api?m=release&id=" +
            encodeURIComponent(session) +
            "&sort=episode_asc&page=1";

        const response = await getJSON(apiURL);

        const items = Array.isArray(response.data)
            ? response.data
            : [];

        const episodes = items.map(function (item) {
            return {
                href: absoluteURL(
                    "/play/" +
                    session +
                    "/" +
                    (item.session || item.id || "")
                ),
                number: String(
                    item.episode ||
                    item.number ||
                    ""
                )
            };
        }).filter(function (item) {
            return item.number !== "";
        });

        return JSON.stringify(episodes);
    } catch (error) {
        return JSON.stringify([]);
    }
};

/**
 * Initial stream resolver.
 *
 * Only returns direct media URLs if they are present on
 * the episode page. Embed-page extraction and playback
 * support will be implemented after testing the source.
 */
globalThis.extractStreamUrl = async function (url) {
    try {
        const html = await getText(url);

        const streams = [];
        const pattern =
            /https?:\/\/[^"'\\\s<>]+?\.(?:m3u8|mp4)(?:\?[^"'\\\s<>]*)?/gi;

        const matches = html.match(pattern) || [];

        matches.forEach(function (streamURL) {
            if (!streams.some(function (item) {
                return item.streamUrl === streamURL;
            })) {
                streams.push({
                    title: "AnimePahe stream",
                    streamUrl: streamURL
                });
            }
        });

        return JSON.stringify({
            streams: streams,
            subtitles: []
        });
    } catch (error) {
        return JSON.stringify({
            streams: [],
            subtitles: []
        });
    }
};
