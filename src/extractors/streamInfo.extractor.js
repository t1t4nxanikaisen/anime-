import axios from "axios";
import * as cheerio from "cheerio";
import { v1_base_url } from "../utils/base_v1.js";
import { decryptSources_v1 } from "../parsers/decryptors/decrypt_v1.decryptor.js";

export async function extractServers(id) {
  try {
    const resp = await axios.get(
      `https://${v1_base_url}/ajax/v2/episode/servers?episodeId=${id}`
    );
    const $ = cheerio.load(resp.data.html);
    const serverData = [];

    $(".server-item").each((index, element) => {
      const data_id = $(element).attr("data-id");
      const server_id = $(element).attr("data-server-id");
      const type = $(element).attr("data-type");
      const serverName = $(element).find("a").text().trim();

      serverData.push({
        type,
        data_id,
        server_id,
        serverName,
      });
    });

    // ✅ Inject Vidnest manually
    serverData.push({
      type: "dub", // or "hindi" if you want it fixed
      data_id: id, // reuse the same id
      server_id: "vidnest",
      serverName: "Vidnest",
    });

    return serverData;
  } catch (error) {
    console.log(error);
    return [];
  }
}

async function extractStreamingInfo(id, name, type, fallback) {
  try {
    const servers = await extractServers(id.split("?ep=").pop());

    // ✅ Handle Vidnest separately
    if (name.toLowerCase() === "vidnest") {
      const epID = id.split("?ep=").pop();
      const anilistId = servers[0]?.data_id || id; // fallback if needed
      const lang = "hindi"; // force Hindi
      const vidnestUrl = `https://vidnest.fun/anime/${anilistId}/${epID}/${lang}`;

      const { data: vnPage } = await axios.get(vidnestUrl);
      let decryptedSources = null;

      // Try extracting .m3u8
      let vnMatch = vnPage.match(/(https[^"']+\.m3u8)/);
      if (vnMatch) {
        decryptedSources = [{ file: vnMatch[1] }];
      }

      // Try extracting "file:"
      if (!decryptedSources) {
        vnMatch = vnPage.match(/file:\s*"([^"]+)"/);
        if (vnMatch) {
          decryptedSources = [{ file: vnMatch[1] }];
        }
      }

      // Try extracting "sources" JSON
      if (!decryptedSources) {
        const srcMatch = vnPage.match(/sources:\s*(\[[^\]]+\])/);
        if (srcMatch) {
          const sources = JSON.parse(srcMatch[1]);
          decryptedSources = [sources[0]];
        }
      }

      return {
        streamingLink: {
          id,
          type,
          link: {
            file: decryptedSources?.[0]?.file ?? "",
            type: "hls",
          },
          tracks: [],
          intro: null,
          outro: null,
          server: "Vidnest",
        },
        servers,
      };
    }

    // ✅ Default handling for Megaplay, Vidwish, etc.
    let requestedServer = servers.filter(
      (server) =>
        server.serverName.toLowerCase() === name.toLowerCase() &&
        server.type.toLowerCase() === type.toLowerCase()
    );

    if (requestedServer.length === 0) {
      requestedServer = servers.filter(
        (server) =>
          server.serverName.toLowerCase() === name.toLowerCase() &&
          server.type.toLowerCase() === "raw"
      );
    }

    if (requestedServer.length === 0) {
      throw new Error(
        `No matching server found for name: ${name}, type: ${type}`
      );
    }

    const streamingLink = await decryptSources_v1(
      id,
      requestedServer[0].data_id,
      name,
      type,
      fallback
    );

    return { streamingLink, servers };
  } catch (error) {
    console.error("An error occurred:", error);
    return { streamingLink: [], servers: [] };
  }
}

export { extractStreamingInfo };
