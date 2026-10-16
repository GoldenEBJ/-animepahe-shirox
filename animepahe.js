/*

* AnimePahe for ShiroX
* Author: GoldenEBJ
* Initial version: search, details, and episodes.
* Playback resolution will be added after the source API is verified.
    */

var AnimePahe = (function () {
“use strict”;

var BASE = "https://animepahe.ch";
var HEADERS = {
    "Accept": "application/json, text/html, */*",
    "Referer": BASE + "/",
    "User-Agent": "Mozilla/5.0"
};
function absolute(url) {
    url = String(url || "").trim();
    if (/^https?:\/\//i.test(url)) return url;
    if (url.indexOf("//") === 0) return "https:" + url;
    if (url.indexOf("/") === 0) return BASE + url;
    return BASE + "/" + url;
}
async function request(url) {
    if (typeof fetchv2 !== "function") {
        throw new Error("ShiroX fetchv2 is unavailable.");
    }
    var response = await fetchv2(url, HEADERS, "GET", null);
    if (!response) {
        throw new Error("The source returned no response.");
    }
    if (typeof response.status === "number" &&
        (response.status < 200 || response.status >= 300)) {
        throw new Error("AnimePahe returned HTTP " + response.status);
    }
    return response;
}
async function text(url) {
    var response = await request(url);
    return await response.text();
}
async function json(url) {
    return JSON.parse(await text(url));
}
function escapeHTML(value) {
    return String(value || "").replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
}
function animeSession(url) {
    var match = String(url || "").match(/\/anime\/([^/?#]+)/i);
    return match ? match[1] : "";
}
async function search(keyword) {
    var query = String(keyword || "").trim();
    if (!query) return JSON.stringify([]);
    var endpoint = BASE + "/api?m=search&q=" +
        encodeURIComponent(query);
    var data = await json(endpoint);
    var rows = Array.isArray(data.data) ? data.data : [];
    var results = rows.map(function (item) {
        return {
            title: escapeHTML(item.title || "Unknown anime"),
            image: absolute(item.poster || ""),
            href: absolute("/anime/" + (item.session || ""))
        };
    }).filter(function (item) {
        return item.href !== absolute("/anime/");
    });
    return JSON.stringify(results);
}
async function details(url) {
    var html = await text(url);
    function meta(property) {
        var escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        var re = new RegExp(
            '<meta[^>]+(?:property|name)=["\\']' + escaped +
            '["\\'][^>]+content=["\\']([^"\\']*)["\\']',
            "i"
        );
        var match = html.match(re);
        return match ? escapeHTML(match[1]) : "";
    }
    return JSON.stringify([{
        description: meta("og:description") || meta("description"),
        aliases: meta("og:title"),
        airdate: ""
    }]);
}
async function episodes(url) {
    var session = animeSession(url);
    if (!session) {
        throw new Error("Cannot identify the AnimePahe anime session.");
    }
    // Read the anime page to obtain the release API's numeric ID.
    var html = await text(url);
    var idMatch = html.match(/data-poster=["'](\d+)["']/i);
    if (!idMatch) {
        idMatch = html.match(/[?&]id=(\d+)/i);
    }
    if (!idMatch) {
        throw new Error(
            "Could not identify the release ID. " +
            "AnimePahe's page format may have changed."
        );
    }
    var id = idMatch[1];
    var endpoint = BASE +
        "/api?m=release&id=" + encodeURIComponent(id) +
        "&sort=episode_asc&page=1";
    var data = await json(endpoint);
    var rows = Array.isArray(data.data) ? data.data : [];
    var result = rows.map(function (item) {
        return {
            number: String(item.episode || item.number || ""),
            href: absolute(
                "/play/" + session + "/" +
                (item.session || item.id || "")
            )
        };
    }).filter(function (item) {
        return item.number !== "";
    });
    return JSON.stringify(result);
}
return {
    search: search,
    details: details,
    episodes: episodes
};

})();

async function searchResults(keyword) {
return await AnimePahe.search(keyword);
}

async function extractDetails(url) {
return await AnimePahe.details(url);
}

async function extractEpisodes(url) {
return await AnimePahe.episodes(url);
}

async function extractStreamUrl(url) {
throw new Error(
“AnimePahe playback has not been implemented yet. “ +
“Search and episode support must be tested first.”
);
}
