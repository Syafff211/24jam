/*
  Made By Syfx (Fixed by Colin)
  Base : Baileys
  Mode: C2 (Centang 2) - TANPA Centang Biru
*/

const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys")

const pino = require("pino")
const chalk = require("chalk")
const readline = require("readline")
const fs = require("fs")

const SESSION_DIR = "./session"
const RECONNECT_DELAY = 5000

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

function clearSession() {
    if (fs.existsSync(SESSION_DIR)) {
        const backup = `./session_backup_${Date.now()}`
        fs.renameSync(SESSION_DIR, backup)
        console.log(chalk.yellow(`[!] Session dibackup ke ${backup}`))
    }
    fs.mkdirSync(SESSION_DIR, { recursive: true })
}

async function connectToWhatsApp() {
    try {
        if (process.argv.includes("--new")) {
            clearSession()
        }

        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
        const { version, isLatest } = await fetchLatestBaileysVersion()

        console.log(chalk.cyan(`Using WhatsApp v${version.join(".")} | Latest: ${isLatest}`))

        const sock = makeWASocket({
            auth: state,
            version,
            printQRInTerminal: true,
            logger: pino({ level: "silent" }),
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            keepAliveIntervalMs: 30000,
            connectTimeoutMs: 60000
        })

        sock.ev.on("creds.update", saveCreds)

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update

            if (qr) {
                console.log(chalk.yellow("\n[!] Scan QR Code:"))
                console.log(chalk.green(qr))
            }

            if (connection === "connecting") {
                console.log(chalk.yellow("Menghubungkan..."))
            }

            if (connection === "open") {
                console.log(chalk.green("\n[✓] Bot ONLINE"))
                console.log(chalk.green(`[✓] User: ${sock.user?.name || sock.user?.id}`))
                console.log(chalk.green(`[✓] Mode: C2 (Centang 2) - TANPA Centang Biru`))
                console.log(chalk.green(`[✓] HP bisa dimatikan, bot tetap jalan\n`))
                
                // Kirim presence online
                try {
                    await sock.sendPresenceUpdate('available')
                } catch (e) {}
            }

            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode
                console.log(chalk.red(`[!] Disconnect: ${reason}`))
                
                if (reason === DisconnectReason.loggedOut) {
                    console.log(chalk.red("[!] Logout. Jalankan dengan --new"))
                    return
                }
                
                setTimeout(() => connectToWhatsApp(), RECONNECT_DELAY)
            }
        })

        // =========================================================
        // MESSAGE HANDLER - TANPA READ RECEIPT (TIDAK CENTANG BIRU)
        // =========================================================
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const msg = m.messages[0]
                if (!msg) return
                if (!msg.message) return
                if (msg.key.fromMe) return

                // ===================================================
                // TIDAK ADA readMessages ATAU sendReadReceipt DI SINI
                // Server WhatsApp OTOMATIS memberi centang 2 (C2)
                // ===================================================

                const body =
                    msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    msg.message?.imageMessage?.caption ||
                    msg.message?.videoMessage?.caption ||
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
        setTimeout(() => connectToWhatsApp(), RECONNECT_DELAY)
    }
}

process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err)
    setTimeout(() => connectToWhatsApp(), 5000)
})

process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err)
    setTimeout(() => connectToWhatsApp(), 5000)
})

console.log(chalk.green("=== WhatsApp Bot - C2 ONLY (No Blue Tick) ==="))
console.log(chalk.yellow("Mode: Centang 2 otomatis, tanpa centang biru\n"))
connectToWhatsApp()
