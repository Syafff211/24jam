/*
  WHATSAPP BOT – QR CODE ONLY (PASTI BERHASIL)
  Support semua negara
  Mode: C2 tanpa centang biru
*/

const {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys")

const pino = require("pino")
const chalk = require("chalk")
const fs = require("fs")

const SESSION_DIR = "./session"
const RECONNECT_DELAY = 5000

function clearSession() {
    if (fs.existsSync(SESSION_DIR)) {
        fs.rmSync(SESSION_DIR, { recursive: true, force: true })
        console.log(chalk.yellow("[!] Session dihapus"))
    }
    fs.mkdirSync(SESSION_DIR, { recursive: true })
}

async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
        
        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: "silent" }),
            browser: ["Chrome", "Windows", "10"],
            printQRInTerminal: true, // QR CODE AKTIF
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            markOnlineOnConnect: true
        })

        sock.ev.on("creds.update", saveCreds)

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update

            // TAMPILKAN QR
            if (qr) {
                console.log(chalk.green(`\n[✓] SCAN QR CODE DI BAWAH INI:`))
                console.log(chalk.yellow(qr))
                console.log(chalk.yellow(`\n[!] Buka WhatsApp > Perangkat Tertaut > Tautkan Perangkat`))
                console.log(chalk.yellow(`[!] Scan QR dengan HP\n`))
            }

            if (connection === "open") {
                console.log(chalk.green(`\n[✓] BOT ONLINE!`))
                console.log(chalk.green(`[✓] User: ${sock.user?.name || sock.user?.id}`))
                console.log(chalk.green(`[✓] Mode: C2 – TANPA Centang Biru`))
                console.log(chalk.green(`[✓] HP bisa dimatikan, bot jalan 24/7\n`))

                try {
                    await sock.sendPresenceUpdate('available')
                } catch (e) {}
            }

            if (connection === "close") {
                const statusCode = lastDisconnect?.error?.output?.statusCode
                console.log(chalk.red(`[!] Disconnect: ${statusCode}`))

                if (statusCode === 401 || statusCode === DisconnectReason.loggedOut) {
                    console.log(chalk.red("[!] Session invalid. Hapus session dan restart."))
                    clearSession()
                    return
                }

                setTimeout(() => startBot(), RECONNECT_DELAY)
            }
        })

        // =============================================================
        // MESSAGE HANDLER – TANPA BIRU
        // =============================================================
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const msg = m.messages[0]
                if (!msg || !msg.message || msg.key.fromMe) return

                const body =
                    msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    ""

                console.log(
                    chalk.green("[MSG]"),
                    chalk.yellow(msg.pushName || "Unknown"),
                    ":",
                    chalk.white(body)
                )

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

        // Keep-alive
        setInterval(() => {
            if (sock && sock.user) {
                sock.sendPresenceUpdate('available').catch(() => {})
            }
        }, 120000)

    } catch (err) {
        console.error("Main Error:", err)
        setTimeout(() => startBot(), RECONNECT_DELAY)
    }
}

// Anti crash
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err)
    setTimeout(() => startBot(), 5000)
})

process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err)
    setTimeout(() => startBot(), 5000)
})

// =============================================================
// MAIN
// =============================================================
console.log(chalk.green("=== WHATSAPP BOT – QR CODE (PASTI BERHASIL) ==="))
console.log(chalk.yellow("Support semua negara | C2 tanpa biru | Auto reconnect\n"))

if (process.argv.includes("--new")) {
    clearSession()
}

startBot()
