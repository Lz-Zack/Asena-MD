const { Asena, isPublic} = require("../lib/");


Asena(
  {
    pattern: "ping",
    fromMe: isPublic,
    desc: "To check ping",
    type: "info",
  },
  async (message, match) => {
    const start = new Date().getTime();
    await message.reply("_Testing Bot Performance_");
    const end = new Date().getTime();
    return await message.reply(
      "_Ping" + (end - start) + "Ms_"
    );
  }
);
