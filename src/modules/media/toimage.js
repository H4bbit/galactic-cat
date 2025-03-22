// Importação dos módulos essenciais
const fs = require("fs");
const path = require("path");
const util = require("util");
const { exec } = require("child_process");
const execProm = util.promisify(exec);


const tempDir = path.join(__dirname, "..", "..", "temp");
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

async function processImage(client, info, sender, from, isSticker, isQuotedSticker, config, getFileBuffer) {
    try {
        const userMessageReport = async msg => {
            await client.sendMessage(from, { text: msg }, { quoted: info });
        };


        //se for sticker converte em imagem 
        if (isQuotedSticker) {
            const encmedia = isQuotedSticker ? info.message.extendedTextMessage.contextInfo.quotedMessage.stickerMessage : info.message.stickerMessage;

            const mediaBuffer = await getFileBuffer(encmedia, "sticker");
            console.log(mediaBuffer);
            const mediaPath = path.join(tempDir, `temp_file_${Date.now()}.webp`);
            fs.writeFileSync(mediaPath, mediaBuffer);

            const outputPath = path.join(tempDir, `image_${Date.now()}.jpg`);

            await execProm(`ffmpeg -i "${mediaPath}" "${outputPath}"`);
            await client.sendMessage(from, { image: fs.readFileSync(outputPath) }, { quoted: info });
            fs.unlinkSync(mediaPath);
            fs.unlinkSync(outputPath);
        } else {
            return await userMessageReport("Marque um sticker para converter em imagem!");
        }

    } catch (error) {
        console.error("Erro ao processar a imagem:", error);
        client.sendMessage(
            from,
            { text: "❌ Ocorreu um erro ao processar a imagem" },
            { quoted: info }
        );
    }
}


module.exports = { processImage };
