import { extractServers } from "../extractors/streamInfo.extractor.js";

export const getServers = async (req) => {
  try {
    const { ep } = req.query;
    let servers = await extractServers(ep);

    // ✅ Ensure Vidnest is always included
    const alreadyHasVidnest = servers.some(
      (s) => s.serverName.toLowerCase() === "vidnest"
    );

    if (!alreadyHasVidnest) {
      servers.push({
        type: "dub",   // fixed as dub/Hindi
        data_id: ep,   // use ep as identifier
        server_id: "vidnest",
        serverName: "Vidnest",
      });
    }

    return servers;
  } catch (e) {
    console.error(e);
    return e;
  }
};
