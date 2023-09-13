const {
  default: makeWASocket,
  useMultiFileAuthState,
  Browsers,
  delay,
  DisconnectReason,
  makeInMemoryStore
} = require("@whiskeysockets/baileys");
const path = require("path");
let fs = require("fs");
let config = require("./config");
const pino = require("pino");
logger = pino({
  level: "silent",
});
const events = require("./lib/events");
const { 
  serialize, 
  Greetings,
  Base, 
  Image, 
  Video, 
  Sticker, 
  ReplyMessage,
  Message 
} = require("./lib");

const store = makeInMemoryStore({
        logger: pino().child({ level: "silent", stream: "store" }),
    });
    
fs.readdirSync(__dirname + "/lib/db/").forEach((db) => {
  if (path.extname(db).toLowerCase() == ".js") {
    require(__dirname + "/lib/db/" + db);
  }
});

let cc = config.SESSION_ID.replace(/Asena~;;;/g, "");
async function MakeSession(){
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    if(cc.length<30){
    const axios = require('axios');
    let { data } = await axios.get('https://paste.c-net.org/'+cc)
    await fs.writeFileSync(__dirname + '/auth_info_baileys/creds.json', atob(data), "utf8")    
    } else {
	 var c = atob(cc)
         await fs.writeFileSync(__dirname + '/auth_info_baileys/creds.json', c, "utf8")    
    }
}
}
MakeSession()
const connect = async () => {
  console.log("Asena 2.0.1");
  config.DATABASE.sync();
  console.log("Installing Plugins...✅");
  fs.readdirSync(__dirname + "/plugins").forEach((plugin) => {
    if (path.extname(plugin).toLowerCase() == ".js") {
      require(__dirname + "/plugins/" + plugin);
    }
  });
  console.log("✅ Plugins Installed!");

  const Asena = async () => {
    useMultiFileAuthState(__dirname + '/auth_info_baileys/');
    let conn = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: pino({
        level: "silent",
      }),
      browser: Browsers.macOS("Desktop"),
      downloadHistory: false,
      syncFullHistory: false,
    });
    store.bind(conn.ev)
setInterval(() => {
    store.writeToFile(__dirname+"/store.json");
  }, 30 * 1000);

    conn.ev.on("connection.update", async (s) => {
      const { connection, lastDisconnect } = s;
      if (connection === "connecting") {
      }
      if (connection === "open") {
        console.log("Session Restored!..✅");
        let str = `\`\`\`Asena connected \nversion : ${
          require(__dirname + "/package.json").version
        }\nTotal Plugins : ${events.commands.length}\nWorktype: ${
          config.MODE
        }\`\`\``;
        conn.sendMessage(conn.user.id, {
          text: str,
        });
      }

      if (connection === "close") {
        const { error, message } = lastDisconnect.error?.output.payload;
        if (
          lastDisconnect.error?.output?.statusCode !==
          DisconnectReason.loggedOut
        ) {
          await delay(300);
          Asena();
          console.log("reconnecting...");
        } else {
          console.log("connection closed\nDevice logged out.");
          await delay(3000);
          process.exit(0);
        }
      }
    });

    conn.ev.on("creds.update", saveCreds);

    conn.ev.on("group-participants.update", async (data) => {
      Greetings(data, conn);
    });
    conn.ev.on("messages.upsert", async (m) => {
      if (m.type !== "notify") return;
      let msg = await serialize(
        JSON.parse(JSON.stringify(m.messages[0])),
        conn
      );
      if (!msg) return;
      let text_msg = msg.body;
      if (text_msg && config.LOGS)
        console.log(
          `At : ${
            msg.from.endsWith("@g.us")
              ? (await conn.groupMetadata(msg.from)).subject
              : msg.from
          }\nFrom : ${msg.sender}\nMessage:${text_msg}`
        );
      events.commands.map(async (command) => {
        if (
          command.fromMe &&
          !config.SUDO.split(",").includes(
            msg.sender.split("@")[0] || !msg.isSelf
          )
        ) {
          return;
        }

        let comman = text_msg
          ? text_msg[0].toLowerCase() + text_msg.slice(1).trim()
          : "";
        msg.prefix = new RegExp(config.HANDLERS).test(text_msg)
          ? text_msg[0].toLowerCase()
          : ",";

        let whats;
        switch (true) {
          case command.pattern && command.pattern.test(comman):
            let match;
            try {
              match = text_msg
                .replace(new RegExp(command.pattern, "i"), "")
                .trim();
            } catch {
              match = false;
            }
            whats = new Message(conn, msg);
            command.function(whats, match, msg, conn);
            break;

          case text_msg && command.on === "text":
            whats = new Message(conn, msg);
            command.function(whats, text_msg, msg, conn, m);
            break;

          case command.on === "image" || command.on === "photo":
            if (msg.type === "imageMessage") {
              whats = new Image(conn, msg);
              command.function(whats, text_msg, msg, conn, m);
            }
            break;

          case command.on === "sticker":
            if (msg.type === "stickerMessage") {
              whats = new Sticker(conn, msg);
              command.function(whats, msg, conn, m);
            }
            break;
          case command.on === "video":
            if (msg.type === "videoMessage") {
              whats = new Video(conn, msg);
              command.function(whats, msg, conn, m);
            }
            break;

          default:
            break;
        }
      });
    });
    return conn;
  };
  Asena().catch(error => {
    console.log(error)
  });
};

connect();
