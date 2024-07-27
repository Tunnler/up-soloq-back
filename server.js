const express = require("express");
const fs = require("fs");
const axios = require("axios");
const cron = require("node-cron");
const cors = require("cors"); 

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());

const RIOT_API_KEY = "RGAPI-2ef0c92e-925b-4bf4-9988-6a6ff1e6898d"; // Reemplaza esto con tu clave de API de Riot ;)
const players = [
  { streamer: "Alexander Condori", username: "TTV Grix", tag: "SOLOQ", rol: "adc" },
  { streamer: "David Ortega", username: "MiniJurajo", tag: "SQC", rol: "adc" },
  { streamer: "Saul Mimbela", username: "saul", tag: "SQC", rol: "mid" },
  { streamer: "Kevin Julca", username: "Z1TR3X", tag: "SQC", rol: "mid" },
  { streamer: "Mauricio Cortez", username: "maucore", tag: "SQC", rol: "adc" },
  { streamer: "Jerry Porras", username: "Pushliner", tag: "54678", rol: "jungle" },
  { streamer: "Xavier Huerta", username: "sinjungla", tag: "3322", rol: "jungle" },
  { streamer: "Gianlucca Pagano", username: "Shianlocs", tag: "SQC", rol: "jungle" },
  { streamer: "Eric Cristobal", username: "Garismunaskyo2", tag: "SQC", rol: "jungle" },
  { streamer: "Carlos Ayala", username: "ElPorkisssssssss", tag: "SQC", rol: "adc" },
  { streamer: "Sebastian Droguett", username: "DroguettS", tag: "SQC", rol: "adc" },
  { streamer: "Johao Mendoza", username: "Littksluvkat", tag: "SOLO", rol: "mid" },
  { streamer: "Marcelo Loaiza", username: "Makumba", tag: "0809", rol: "mid" },
];

const batchSize = 5; // Tamaño del lote de jugadores que se actualizarán cada vez
const updateInterval = 5000; // Intervalo de tiempo entre actualizaciones de lotes (en milisegundos)

const getPUUID = async (username, tag) => {
  const response = await axios.get(
    `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${username}/${tag}?api_key=${RIOT_API_KEY}`
  );
  return response.data.puuid;
};

const getSummonerByPUUID = async (puuid) => {
  const response = await axios.get(
    `https://la2.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${RIOT_API_KEY}`
  );
  return response.data;
};

const getRankedStatsBySummonerId = async (summonerId) => {
  const response = await axios.get(
    `https://la2.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}?api_key=${RIOT_API_KEY}`
  );
  return response.data;
};

const fetchPlayerStats = async (batch) => {
  const statsPromises = batch.map(async (player) => {
    try {
      const puuid = await getPUUID(player.username, player.tag);
      const summoner = await getSummonerByPUUID(puuid);
      const stats = await getRankedStatsBySummonerId(summoner.id);
      const soloStats = stats.find(
        (stat) => stat.queueType === "RANKED_SOLO_5x5"
      );
      return {
        streamer: player.streamer,
        summonerName: player.username,
        tag: player.tag,
        encryptedSummonerId: player.encryptedSummonerId,
        rol: player.rol,
        profileIconId: summoner.profileIconId,
        summonerLevel: summoner.summonerLevel,
        rankedStats: soloStats || null,
      };
    } catch (error) {
      console.error(
        `Error fetching stats for ${player.username}: ${error.message}`
      );
      return { summonerName: player.username, error: true };
    }
  });

  return Promise.all(statsPromises);
};

const updatePlayerStatsBatch = async (startIndex) => {
  const batch = players.slice(startIndex, startIndex + batchSize);
  const playerStats = await fetchPlayerStats(batch);
  return playerStats;
};

const updateAllPlayerStats = async () => {
  try {
    let startIndex = 0;
    const totalPlayers = players.length;
    const allPlayerStats = [];

    while (startIndex < totalPlayers) {
      const playerStats = await updatePlayerStatsBatch(startIndex);
      allPlayerStats.push(...playerStats);
      startIndex += batchSize;

      // Espera un tiempo antes de actualizar el siguiente lote
      await new Promise((resolve) => setTimeout(resolve, updateInterval));
    }

    fs.writeFileSync(
      "playerStats.json",
      JSON.stringify(allPlayerStats, null, 2)
    );
    console.log(
      "Todos los datos de los jugadores se han actualizado correctamente."
    );
  } catch (error) {
    console.error(
      "Error al actualizar las estadísticas del jugador:",
      error.message
    );
  }
};

// Actualizar datos al iniciar el servidor
updateAllPlayerStats();

// Actualizar datos cada 5 minutos
cron.schedule("*/5 * * * *", updateAllPlayerStats);

// Ruta para obtener las estadísticas (ahora será la ruta principal)
app.get("/", (req, res) => {
  fs.readFile("playerStats.json", "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Failed to read data" });
    }
    res.json(JSON.parse(data));
  });
});

// Ruta para servir riot.txt
app.get("//riot.txt", (req, res) => {
  fs.readFile("riot.txt", "utf8", (err, data) => {
    if (err) {
      console.error("Error al leer riot.txt:", err);
      return res.status(500).send("Error interno del servidor");
    }
    res.send(data);
  });
});

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
