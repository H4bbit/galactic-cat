/*
* Este arquivo é responsável por iniciar a conexão com o WhatsApp.
* Ele é executado automaticamente quando o bot é iniciado.
*/

/**
 * @module auth/connection
 * @description
 * Este módulo configura a conexão do socket do WhatsApp utilizando a biblioteca Baileys.
 *
 * Ele importa os seguintes elementos do pacote "@whiskeysockets/baileys":
 * - makeWASocket (exportação padrão): Função para inicializar uma nova conexão de socket do WhatsApp.
 * - Browsers: Enumeração dos tipos de navegadores suportados que podem ser usados para simular um ambiente de cliente.
 * - makeInMemoryStore: Função para criar um armazenamento em memória para gerenciar o estado da sessão ou conexão.
 *
 * @requires @whiskeysockets/baileys
 */


const { default: makeWASocket, Browsers, makeInMemoryStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const path = require("path");
const NodeCache = require("node-cache");
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });
const RECONNECT_INITIAL_DELAY = 2000;
const RECONNECT_MAX_DELAY = 60000;
let reconnectAttempts = 0;
let metricsIntervalId = null;

const logger = require("../utils/logger");
const participantsUpdate = require("./participantsUpdate");
const messageUpsert = require("./messagesUpsert");

const patchInteractiveMessage = message => {
  return message?.interactiveMessage
    ? {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadataVersion: 2,
              deviceListMetadata: {},
            },
            ...message,
          },
        },
      }
    : message;
};

const scheduleReconnect = () => {
  reconnectAttempts++;
  const delay = Math.min(RECONNECT_INITIAL_DELAY * 2 ** reconnectAttempts, RECONNECT_MAX_DELAY);
  setTimeout(() => connectToWhatsApp(), delay);
};

const registerAllEventHandlers = (client, saveCreds) => {
  const simpleEvents = {
    "chats.upsert": () => {},
    "contacts.upsert": () => {},
  };

  Object.entries(simpleEvents).forEach(([event, handler]) => client.ev.on(event, handler));

  const groupEvents = {
    "groups.update": async ([event]) => {
      const metadata = await client.groupMetadata(event.id);
      groupCache.set(event.id, metadata);
    },

    "group-participants.update": async event => {
      await participantsUpdate.handleParticipantsUpdate(event, client, groupCache);
    },
  };

  Object.entries(groupEvents).forEach(([event, handler]) => client.ev.on(event, handler));

  client.ev.process(async events => {
    const eventHandlers = {
      "connection.update": async data => await handleConnectionUpdate(data, client),

      "creds.update": async data => {
        await saveCreds();
      },

      "messages.upsert": async data => {
        messageUpsert(data, client);
        require(path.join(__dirname, "..", "controllers", "botController.js"))(data, client);
      },
    };

    for (const [event, data] of Object.entries(events)) {
      try {
        if (eventHandlers[event]) {
          await eventHandlers[event](data);
        }
      } catch (error) {
        logger.error(`Erro ao processar o evento ${event}: ${error.message}`);
      }
    }
  });
};

const handleConnectionUpdate = async (update, client) => {
  try {
    const { connection } = update;
    if (connection === "open") {
      logger.info("✅ Conexão aberta com sucesso. Bot disponível.");
      reconnectAttempts = 0;

      const config = require("../config/options.json");
      await client.sendMessage(config.owner.number, {
        text: "🟢 O bot foi iniciado com sucesso.",
      });
      logger.info("🛠️ Mensagem de status enviada para o proprietário.");
    }
    if (connection === "close") {
      if (metricsIntervalId) {
        clearInterval(metricsIntervalId);
        metricsIntervalId = null;
      }
      scheduleReconnect();
    }
  } catch (error) {
    scheduleReconnect();
  }
};

const connectToWhatsApp = async () => {
  try {
    const connectionLogs = path.join(__dirname, "temp");
    const { state, saveCreds } = await useMultiFileAuthState(connectionLogs);
    logger.info("🌐 Iniciando a conexão com o WhatsApp...");

    const client = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: true,
      mobile: false,
      browser: Browsers.macOS("Desktop"),
      syncFullHistory: true,
      cachedGroupMetadata: async jid => groupCache.get(jid),
      patchMessageBeforeSending: patchInteractiveMessage,
    });

    const store = makeInMemoryStore({});
    store.bind(client.ev);
    registerAllEventHandlers(client, saveCreds);
  } catch (error) {
    scheduleReconnect();
    logger.error(`🔴 Erro ao iniciar a conexão: ${error.message}`);
    throw new Error("Erro ao iniciar a conexão com o WhatsApp:", error);
  }
};

connectToWhatsApp().catch(async error => {
  scheduleReconnect();
  logger.error(`🔴 Erro ao iniciar a conexão: ${error.message}`);
  throw new Error("Error ao inciar a conexão com o WhatsApp:", error);
});
