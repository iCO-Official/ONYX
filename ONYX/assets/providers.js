window.ONYX_PROVIDERS = (() => {
  const SEARCH_LIMIT = 12;

  function mapAppleTrack(item) {
    const previewUrl = item.previewUrl || "";
    return {
      id: `apple-${item.trackId || item.collectionId}`,
      title: item.trackName || item.collectionName || "Unknown track",
      artist: item.artistName || "Unknown artist",
      duration: Math.round((item.trackTimeMillis || 30000) / 1000),
      source: "Apple Previews",
      tags: ["APPLE", "PREVIEW"],
      streamUrl: previewUrl,
      artwork: item.artworkUrl100 ? item.artworkUrl100.replace("100x100", "512x512") : "",
      liked: false,
      externalUrl: item.trackViewUrl || item.collectionViewUrl || ""
    };
  }

  function mapSoundCloudTrack(item) {
    const artwork = item.artwork_url || item.user?.avatar_url || "";
    return {
      id: `soundcloud-${item.id}`,
      title: item.title || "Unknown track",
      artist: item.user?.username || "Unknown artist",
      duration: Math.max(1, Math.round((item.duration || 0) / 1000)),
      source: "SoundCloud",
      tags: ["SOUNDCLOUD", "CLIENT_ID"],
      streamUrl: "",
      artwork,
      liked: false,
      externalUrl: item.permalink_url || ""
    };
  }

  function uniqueById(items) {
    const seen = new Set();
    const output = [];
    for (const item of items) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      output.push(item);
    }
    return output;
  }

  async function requestJson(url, signal, message) {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  }

  function mapYouTubeTrack(item) {
    const videoId = item.id?.videoId || "";
    const title = item.snippet?.title || "Unknown track";
    const artist = item.snippet?.channelTitle || "Unknown channel";
    const artwork = item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || "";
    return {
      id: `youtube-${videoId || item.etag || Math.random().toString(36).slice(2)}`,
      title,
      artist,
      duration: 0,
      source: "YouTube",
      tags: ["YOUTUBE", "SEARCH"],
      streamUrl: "",
      artwork,
      liked: false,
      externalUrl: videoId ? `https://music.youtube.com/watch?v=${videoId}` : ""
    };
  }

  function mapJamendoTrack(item) {
    return {
      id: `jamendo-${item.id}`,
      title: item.name || "Unknown track",
      artist: item.artist_name || "Unknown artist",
      duration: Number(item.duration) || 30,
      source: "Jamendo",
      tags: ["JAMENDO", "OFFICIAL"],
      streamUrl: item.audio || item.audiodownload || "",
      artwork: item.image || "",
      liked: false,
      externalUrl: item.shareurl || item.shorturl || ""
    };
  }

  function mapDeezerTrack(item) {
    return {
      id: `deezer-${item.id}`,
      title: item.title || "Unknown track",
      artist: item.artist?.name || "Unknown artist",
      duration: Number(item.duration) || 30,
      source: "Deezer Previews",
      tags: ["DEEZER", "PREVIEW"],
      streamUrl: item.preview || "",
      artwork: item.album?.cover_xl || item.album?.cover_big || item.album?.cover_medium || "",
      liked: false,
      externalUrl: item.link || ""
    };
  }

  async function searchApple(term, signal) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${SEARCH_LIMIT}`;
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error("Apple search failed");
    const data = await response.json();
    return (data.results || []).map(mapAppleTrack).filter((track) => track.streamUrl);
  }

  async function searchJamendo(term, clientId, signal) {
    if (!clientId) return [];
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(clientId)}&format=json&limit=${SEARCH_LIMIT}&search=${encodeURIComponent(term)}&audioformat=mp31`;
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error("Jamendo search failed");
    const data = await response.json();
    return (data.results || []).map(mapJamendoTrack).filter((track) => track.streamUrl);
  }

  async function searchSoundCloud(term, clientId, signal) {
    if (!clientId) return [];
    const url = `/api/soundcloud/search?term=${encodeURIComponent(term)}&client_id=${encodeURIComponent(clientId)}`;

    const data = await requestJson(url, signal, "SoundCloud search failed");
    const rawCollection = Array.isArray(data) ? data : (data.collection || []);
    const tracks = rawCollection
      .filter((item) => item?.kind === "track" || item?.title)
      .map(mapSoundCloudTrack);
    return uniqueById(tracks).slice(0, SEARCH_LIMIT);
  }

  async function searchYouTube(term, apiKey, signal) {
    if (!apiKey) return [];
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${SEARCH_LIMIT}&q=${encodeURIComponent(`${term} music`)}&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error("YouTube search failed");
    const data = await response.json();
    return (data.items || []).map(mapYouTubeTrack).filter((track) => track.externalUrl);
  }

  async function searchDeezer(term, signal) {
    const url = `/api/deezer/search?term=${encodeURIComponent(term)}`;
    const data = await requestJson(url, signal, "Deezer search failed");
    return (data.data || []).map(mapDeezerTrack).filter((track) => track.streamUrl);
  }

  return {
    searchApple,
    searchJamendo,
    searchSoundCloud,
    searchYouTube,
    searchDeezer
  };
})();
