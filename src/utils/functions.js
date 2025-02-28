/* eslint-disable no-async-promise-executor */
/* eslint-disable no-undef */
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const axios = require("axios");
const cfonts = require("cfonts");
const fetch = require("node-fetch");

const getBuffer = async (url, opcoes) => {
  try {
    opcoes ? opcoes : {};
    const post = await axios({
      method: "get",
      url,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.128 Safari/537.36",
        DNT: 1,
        "Upgrade-Insecure-Request": 1,
      },
      ...opcoes,
      responseType: "arraybuffer",
    });
    return post.data;
  } catch (e) {
    console.log(e);
  }
};

const getFileBuffer = async (mediakey, MediaType) => {
  const stream = await downloadContentFromMessage(mediakey, MediaType);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
};

const fetchJson = (url, options) =>
  new Promise(async (resolve, reject) => {
    fetch(url, options)
      .then((response) => response.json())
      .then((json) => {
        resolve(json);
      })
      .catch((err) => {
        reject(err);
      });
  });

function getGroupAdmins(participants) {
  admins = [];
  for (let i of participants) {
    if (i.admin == "admin") admins.push(i.id);
    if (i.admin == "superadmin") admins.push(i.id);
  }
  return admins;
}

const getFormattedTime = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

module.exports = {
  getBuffer,
  getFileBuffer,
  fetchJson,
  getGroupAdmins,
  getFormattedTime
};
