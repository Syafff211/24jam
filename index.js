/*
  Made By Syfx (Modified by Colin)
  Base : Baileys
  WhatsApp : wa.me/628xxxxxxxxxx
  Fitur: Auto C2 (Centang 2) meski HP mati
*/

// Import Module
const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys")

const pino = require("pino")
const chalk = require("chalk")
const readline = require("readline")
const fs = require("fs")
const path = require("path")

// Konfigurasi
const usePairingCode = true
const SESSION_DIR = "./session"
const AUTO_READ = true // Centang 2 otomatis
const MARK_READ = false // False = tidak centang biru, True = centang biru
const RECONNECT_DELAY = 3000 // 3 detik

// Input Terminal
async function question(text) {
    process.stdout.write(text)
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })
    return new Promise((resolve) => {
        rl.question("", (answer) => {
            rl.close()
            resolve(answer)
        })
    })
}

// Fungsi untuk mengirim read receipt (centang 2)
async function sendReadReceipt(sock, msg) {
    try {
        if (!msg.key.remoteJid) return
        if (msg.key.fromMe) return
        if (!AUTO_READ) return

        // Kirim ack ke server WhatsApp (centang 2)
        await sock.readMessages([msg.key])
        
        // Opsional: kirim centang biru jika MARK_READ true
        if (MARK_READ) {
            await sock.sendReadReceipt(msg.key.remoteJid, msg.key.participant, [msg.key.id])
        }
        
        // Log
        console.log(chalk.gray(`[✓] Auto C2 untuk pesan dari ${msg.pushName || msg.key.remoteJid}`))
    } catch (err) {
        // Error biasa diabaikan agar tidak crash
        console.log(chalk.red(`[!] Gagal kirim C2: ${err.message}`))
    }
}

// Fungsi untuk mengirim presence online (keep-alive)
async function sendPresence(sock) {
    try {
        await sock.sendPresenceUpdate('available')
        console.log(chalk.gray('[✓] Presence update: online'))
    } catch (err) {
        // Diabaikan
    }
}

// Fungsi utama connect
async function connectToWhatsApp() {
    try {
        // Cek session exist
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true })
        }

        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
        const { version, isLatest } = await fetchLatestBaileysVersion()

        console.log(chalk.cyan(`Using WhatsApp v${version.join(".")} | Latest: ${isLatest}`))

        const sock = makeWASocket({
            auth: state,
            version,
            printQRInTerminal: !usePairingCode,
            logger: pino({ level: "silent" }),
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            // Keep alive settings
            keepAliveIntervalMs: 30000, // 30 detik
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 30000
        })

        // Pairing Code
        if (usePairingCode && !sock.authState.creds.registered) {
            try {
                const phoneNumber = await question("Masukkan nomor WhatsApp diawali 62:\n")
                const code = await sock.requestPairingCode(phoneNumber.trim())
                console.log(chalk.green(`\nPairing Code: ${code}\n`))
                console.log(chalk.yellow(`[!] HP bisa dimatikan setelah pairing sukses. Bot akan tetap online.`))
            } catch (err) {
                console.error("Pairing Error:", err)
                setTimeout(() => connectToWhatsApp(), RECONNECT_DELAY)
                return
            }
        }

        // Save Session
        sock.ev.on("creds.update", saveCreds)

        // ============================================================
        // TAMBAHAN: Auto C2 dan Keep-Alive
        // ============================================================
        
        // Kirim presence online setiap 2 menit (keep-alive)
        setInterval(() => {
            if (sock && sock.user) {
                sendPresence(sock).catch(() => {})
            }
        }, 120000)

        // Connection Update
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update

            if (connection === "connecting") {
                console.log(chalk.yellow("Menghubungkan ke WhatsApp..."))
            }

            if (connection === "open") {
                console.log(chalk.green("✓ Bot WhatsApp berhasil terhubung (C2 aktif)"))
                console.log(chalk.green(`✓ Login sebagai: ${sock.user?.name || sock.user?.id || "Unknown"}`))
                console.log(chalk.green(`✓ HP bisa dimatikan, bot tetap online 24/7`))
                // Kirim presence online
                sendPresence(sock).catch(() => {})
            }

            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode
                const errorMsg = lastDisconnect?.error?.message || ""

                console.log(chalk.red(`Koneksi terputus. Reason: ${reason} | ${errorMsg}`))

                // Jika logout, hapus session
                if (reason === DisconnectReason.loggedOut || errorMsg.includes("logged out")) {
                    console.log(chalk.red("Session logout, hapus folder session lalu pairing ulang."))
                    // Backup session lama
                    if (fs.existsSync(SESSION_DIR)) {
                        const backup = `./session_backup_${Date.now()}`
                        fs.renameSync(SESSION_DIR, backup)
                        console.log(chalk.yellow(`Session dibackup ke ${backup}`))
                    }
                    return
                }

                // Reconnect otomatis
                console.log(chalk.yellow(`Mencoba reconnect dalam ${RECONNECT_DELAY/1000} detik...`))
                setTimeout(() => {
                    connectToWhatsApp()
                }, RECONNECT_DELAY)
            }
        })

        // ============================================================
        // MESSAGE HANDLER + AUTO C2
        // ============================================================
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const msg = m.messages[0]
                if (!msg) return
                if (!msg.message) return
                if (msg.key.fromMe) return

                // =====================================================
                // AUTO CENTANG 2 (C2) - SEBELUM PROSES PESAN
                // =====================================================
                await sendReadReceipt(sock, msg)

                // Ambil isi pesan
                const body = 
                    msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    msg.message?.imageMessage?.caption ||
                    msg.message?.videoMessage?.caption ||
                    msg.message?.documentMessage?.caption ||
                    ""

                const pushname = msg.pushName || "No Name"

                const colors = ["red", "green", "yellow", "blue", "magenta", "cyan", "white"]
                const randomColor = colors[Math.floor(Math.random() * colors.length)]

                console.log(
                    chalk.yellow.bold("Credit : Syfx"),
                    chalk.green.bold("[ WhatsApp ]"),
                    chalk[randomColor](pushname),
                    chalk[randomColor](" : "),
                    chalk.white(body)
                )

                // Handler (lenwy)
                try {
                    delete require.cache[require.resolve("./lenwy")]
                    require("./lenwy")(sock, m)
                } catch (err) {
                    console.error("Handler Error:", err)
                }

            } catch (err) {
                console.error("Message Error:", err)
            }
        })

        // ============================================================
        // TAMBAHAN: Health Check untuk memastikan bot tetap running
        // ============================================================
        setInterval(() => {
            if (sock && sock.user) {
                console.log(chalk.gray(`[✓] Health check: bot online | User: ${sock.user.id}`))
            } else {
                console.log(chalk.red("[✗] Health check: bot offline, mencoba reconnect..."))
                connectToWhatsApp()
            }
        }, 300000) // 5 menit

    } catch (err) {
        console.error("Main Error:", err)
        setTimeout(() => {
            connectToWhatsApp()
        }, RECONNECT_DELAY)
    }
}

// Anti Crash dengan restart otomatis
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err)
    setTimeout(() => connectToWhatsApp(), 5000)
})

process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err)
    setTimeout(() => connectToWhatsApp(), 5000)
})

// Run Bot
console.log(chalk.green("=== WhatsApp Bot (Auto C2 - HP Mati Tetap Jalan) ==="))
console.log(chalk.yellow("Fitur: Centang 2 otomatis, keep-alive, auto reconnect"))
connectToWhatsApp()
