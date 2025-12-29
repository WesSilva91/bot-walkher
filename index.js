import { makeWASocket, useMultiFileAuthState, jidNormalizedUser } from "@whiskeysockets/baileys";
import fs from "fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";


const prefix = "!";
const NumberDono = "5511999999999"; // Coloque seu número do WhatsApp

// Lista negra de usuários banidos
let blacklist = [];

// Mensagens programadas por comando
let scheduledMessages = [];

// Mensagens de boas-vindas e despedida
let welcomeMessage = "👋 Bem-vindo ao grupo!";
let goodbyeMessage = "😢 Adeus! Até a próxima.";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    browser: ["Walkher", "Chrome", "1.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  // Conexão
  sock.ev.on("connection.update", update => {
    if (update.connection === "open") {
      console.log("✅ Walkher conectado ao WhatsApp");
    }
  });

  // Listener de mensagens
  sock.ev.on("messages.upsert", async upsert => {
    const msg = upsert.messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith("@g.us");
    const sender = jidNormalizedUser(msg.key.participant || msg.key.sender || msg.key.remoteJid);

    // ====================== RESPOSTA AUTOMÁTICA NO PRIVADO ======================
    if (!isGroup) {
      if (!blacklist.includes(sender)) {
        await sock.sendMessage(from, {
          text: "🤖 Olá! Eu sou apenas um bot de trabalho.\n" +
                "Para vendas ou aluguel, entre em contato com o dono: 019996282444"
        });
      }
      return; // Evita processar comandos privados
    }

    // Prefixo e comando
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    if (!body.startsWith(prefix)) return;

    const command = body.slice(prefix.length).trim().split(/ +/)[0].toLowerCase();
    const args = body.slice(prefix.length).trim().split(/ +/).slice(1);

    // Verifica se é dono ou admin
    const botNumber = jidNormalizedUser(await sock.user.id);
    const isOwner = sender === `${NumberDono}@s.whatsapp.net`;

    let groupAdmins = [];
    let metadata;
    try {
      metadata = await sock.groupMetadata(from);
      groupAdmins = metadata.participants.filter(p => p.admin).map(a => a.jid);
    } catch {
      console.log("⚠️ Não foi possível obter metadata do grupo");
    }
    const isAdmin = groupAdmins.includes(sender);

    // Função para enviar resposta
    async function reply(text) {
      return sock.sendMessage(from, { text }, { quoted: msg });
    }

    // ====================== COMANDOS ======================

    // BANIR COM LISTA NEGRA
    if (command === "ban") {
      if (!isAdmin && !isOwner) return reply("❌ Apenas admins podem usar este comando!");
      const target = args[0];
      if (!target) return reply("❌ Marque ou passe o número do usuário para banir.");
      const targetJid = target.includes("@") ? target : target.replace(/\D/g,"") + "@s.whatsapp.net";
      if (!isGroup) return reply("❌ Comando só funciona em grupos.");
      if (!groupAdmins.includes(targetJid)) {
        blacklist.push(targetJid);
        await sock.groupParticipantsUpdate(from, [targetJid], "remove");
        return reply(`✅ Usuário ${targetJid} removido e adicionado à lista negra.`);
      } else {
        return reply("❌ Não é possível banir outro admin.");
      }
    }

    // REMOVER SEM LISTA NEGRA
    if (command === "kick") {
      if (!isAdmin && !isOwner) return reply("❌ Apenas admins podem usar este comando!");
      const target = args[0];
      if (!target) return reply("❌ Marque ou passe o número do usuário para remover.");
      const targetJid = target.includes("@") ? target : target.replace(/\D/g,"") + "@s.whatsapp.net";
      await sock.groupParticipantsUpdate(from, [targetJid], "remove");
      return reply(`✅ Usuário ${targetJid} removido do grupo.`);
    }

    // LISTAR ADMINS
    if (command === "admins") {
      if (!isGroup) return reply("❌ Este comando só funciona em grupos.");
      const adminsList = groupAdmins.map(a => `@${a.split("@")[0]}`).join("\n");
      return sock.sendMessage(from, { text: `👮 Admins do grupo:\n${adminsList}`, mentions: groupAdmins });
    }

    // COMANDO BOT PERFIL (imagem)
    if (command === "botperfil" || command === "perfilbot") {
      try {
        let botJid = sock.user.id;
        let botNome = "Walkher";
        let versao = "1.0.0";
        let criador = "Raposa";
        let uptime = process.uptime();
        const tempo = (seg) => {
          let h = Math.floor(seg / 3600);
          let m = Math.floor((seg % 3600) / 60);
          let s = Math.floor(seg % 60);
          return `${h}h ${m}m ${s}s`;
        };
        const canvas = createCanvas(800, 450);
        const ctx = canvas.getContext("2d");

        // Fundo
        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#22d3ee";
        ctx.fillRect(0, 0, canvas.width, 90);

        ctx.font = "bold 38px Sans";
        ctx.fillStyle = "#020617";
        ctx.fillText("BOT WALKHER", 30, 60);

        let foto;
        try {
          foto = await sock.profilePictureUrl(botJid, "image");
        } catch {
          foto = "https://i.imgur.com/2QZ9R8N.png";
        }

        const avatar = await loadImage(foto);
        ctx.save();
        ctx.beginPath();
        ctx.arc(130, 260, 75, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 55, 185, 150, 150);
        ctx.restore();

        // Textos
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "bold 28px Sans";
        ctx.fillText(botNome, 260, 185);
        ctx.font = "22px Sans";
        ctx.fillText(`🤖 Número: ${botJid.split("@")[0]}`, 260, 225);
        ctx.fillText(`⚙️ Versão: ${versao}`, 260, 265);
        ctx.fillText(`👑 Criador: ${criador}`, 260, 305);
        ctx.fillText(`⏱️ Online: ${tempo(uptime)}`, 260, 345);
        ctx.font = "18px Sans";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText("Bot Walkher • Sistema Automático", 260, 385);

        await sock.sendMessage(from, {
          image: canvas.toBuffer(),
          caption: "🤖 Perfil oficial do Bot Walkher"
        });
      } catch (err) {
        console.error(err);
        reply("❌ Erro ao gerar perfil do bot.");
      }
    }

    // LISTAR TODOS OS COMANDOS
    if (command === "comandos") {
      const listaComandos = `
✅ Comandos do Walkher:
!ping - Testa se o bot está online
!admins - Lista admins do grupo
!ban - Banir usuário com lista negra
!kick - Remover usuário sem lista negra
!del - Apagar mensagem marcada
!abrir - Abrir grupo com mensagem de boas-vindas
!fechar - Fechar grupo com mensagem de despedida
!botperfil / !perfilbot - Mostra perfil do bot
!chuva <mensagem> - Programar mensagem a ser enviada manualmente
      `;
      return reply(listaComandos);
    }

    // MENSAGENS PROGRAMADAS POR COMANDO
    if (command === "chuva") {
      if (!isAdmin && !isOwner) return reply("❌ Apenas admins podem usar este comando!");
      if (!args.length) return reply("❌ Escreva a mensagem a ser enviada.");
      const msgText = args.join(" ");
      scheduledMessages.push({ from, text: msgText });
      return reply("✅ Mensagem adicionada para envio manual.");
    }

  }); // fim messages.upsert

}

startBot();
