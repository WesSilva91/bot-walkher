
import { createCanvas, loadImage } from 'canvas'
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState
} from '@whiskeysockets/baileys'

import qrcode from 'qrcode-terminal'
import { Boom } from '@hapi/boom'

async function startBot() {
  // 🔐 Autenticação
  const { state, saveCreds } = await useMultiFileAuthState('./auth')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  })

  // 💾 Salvar sessão
  sock.ev.on('creds.update', saveCreds)

  // 🔌 Conexão
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode

      if (reason !== DisconnectReason.loggedOut) {
        startBot()
      } else {
        console.log('❌ Bot deslogado.')
      }
    }

    if (connection === 'open') {
      console.log('✅ Walkher conectado com sucesso!')
    }
  })

  // 📩 RECEBER MENSAGENS
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    const msg = messages[0]
    if (!msg.message) return

    const from = msg.key.remoteJid
    const isGroup = from.endsWith('@g.us')
    const sender = msg.key.participant || msg.key.remoteJid

    // 📜 Texto da mensagem
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text

    if (!text || !text.startsWith('!')) return

    const command = text.trim().split(' ')[0].toLowerCase()
    console.log('📌 Comando:', command)
    // =========================
    // 📢 MENSAGENS AUTOMÁTICAS
    // =========================
    const autoMessages = {
      '!chuva': '🌧️ *Alerta de Chuva*\n\nPessoal, fiquem atentos! Possibilidade de chuva na região. Dirijam com cuidado.',
    }
    // 🔹 COMANDOS DE MENSAGEM AUTOMÁTICA
    if (autoMessages[command]) {
      await sock.sendMessage(from, {
        text: autoMessages[command]
      })
      return
    }
    // =========================
    // 🔹 CASE WALKHER
    // =========================
    if (command === 'botperfil' || command === 'perfilbot') {
      let botJid = sock.user.id
      let botNome = 'Walkher'
      let versao = '1.0.0'
      let criador = 'Raposa'
      let uptime = process.uptime()

      const tempo = (seg) => {
        let h = Math.floor(seg / 3600)
        let m = Math.floor((seg % 3600) / 60)
        let s = Math.floor(seg % 60)
        return `${h}h ${m}m ${s}s`
      }

      const canvas = createCanvas(800, 450)
      const ctx = canvas.getContext('2d')

      // Fundo
      ctx.fillStyle = '#020617'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Cabeçalho
      ctx.fillStyle = '#22d3ee'
      ctx.fillRect(0, 0, canvas.width, 90)

      ctx.font = 'bold 38px Sans'
      ctx.fillStyle = '#020617'
      ctx.fillText('BOT WALKHER', 30, 60)

      // Foto do bot
      let foto
      try {
        foto = await sock.profilePictureUrl(botJid, 'image')
      } catch {
        foto = 'https://i.imgur.com/2QZ9R8N.png'
      }

      const avatar = await loadImage(foto)
      ctx.save()
      ctx.beginPath()
      ctx.arc(130, 260, 75, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(avatar, 55, 185, 150, 150)
      ctx.restore()

      // Textos
      ctx.fillStyle = '#e5e7eb'
      ctx.font = 'bold 28px Sans'
      ctx.fillText(botNome, 260, 185)

      ctx.font = '22px Sans'
      ctx.fillText(`🤖 Número: ${botJid.split('@')[0]}`, 260, 225)
      ctx.fillText(`⚙️ Versão: ${versao}`, 260, 265)
      ctx.fillText(`👑 Criador: ${criador}`, 260, 305)
      ctx.fillText(`⏱️ Online: ${tempo(uptime)}`, 260, 345)

      // Rodapé
      ctx.font = '18px Sans'
      ctx.fillStyle = '#94a3b8'
      ctx.fillText('Bot Walkher • Sistema Automático', 260, 385)

      await sock.sendMessage(from, {
        image: canvas.toBuffer(),
        caption: '🤖 Perfil oficial do Bot Walkher'
      })
    }


    // =========================
    // 🔹 COMANDO PING
    // =========================
    if (command === '!ping') {
      await sock.sendMessage(from, {
        text: '🏓 Pong! Walkher está online.'
      })
      return
    }

    // =========================
    // 🔹 COMANDO ADMIN (grupo)
    // =========================
    if (command === '!admin') {

      if (!isGroup) {
        await sock.sendMessage(from, {
          text: '❌ Esse comando só funciona em grupos.'
        })
        return
      }

      const metadata = await sock.groupMetadata(from)
      const participants = metadata.participants || []

      const admins = participants
        .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
        .map(p => p.id)

      if (admins.length === 0) {
        await sock.sendMessage(from, {
          text: '⚠️ Nenhum admin encontrado.'
        })
        return
      }

      let resposta = '👮 *Admins do grupo:*\n\n'
      admins.forEach(id => {
        resposta += `• @${id.split('@')[0]}\n`
      })

      await sock.sendMessage(from, {
        text: resposta,
        mentions: admins
      })
    }
  })
}

// 🚀 Iniciar bot
startBot()
