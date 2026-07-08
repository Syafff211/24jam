/*

  Made By Syfx
  Base : Baileys
  WhatsApp : wa.me/628xxxxxxxxxx
  MODIFIKASI: Auto C2 (Centang 2) tanpa centang biru, HP mati tetap jalan

*/

// Import Module
const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("baileys")

const pino = require("pino")
const chalk = require("chalk")
const readline = require("readline")
const fs = require("fs")

// =============================================================
// KONFIGURASI
// =============================================================
const usePairingCode = true
const SESSION_DIR = "./session"
const RECONNECT_DELAY = 5000

// =============================================================
// INPUT TERMINAL
// =============================================================
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

// =============================================================
// FUNGSI AUTO C2 (CENTANG 2) - TANPA BIRU
// =============================================================
async function sendDeliveryReceipt(sock, msg) {
    try {
        if (!msg.key.remoteJid) return
        if (msg.key.fromMe) return
        
        // HANYA kirim ack ke server WhatsApp = CENTANG 2
        // TIDAK pakai readMessages() = TIDAK CENTANG BIRU
        await sock.sendReceipt(msg.key.remoteJid, msg.key.participant, [msg.key.id], 'delivery')
        
        console.log(chalk.gray(`[✓] Auto C2 untuk: ${msg.pushName || msg.key.remoteJid}`))
    } catch (err) {
        // Abaikan error, tetap lanjut
    }
}

// =============================================================
// FUNGSI KEEP-ALIVE (AGAR TETAP ONLINE 24/7)
// =============================================================
async function keepAlive(sock) {
    try {
        await sock.sendPresenceUpdate('available')
        console.log(chalk.gray('[✓] Presence: online'))
    } catch (err) {
        // Abaikan
    }
}

// =============================================================
// MAIN BOT
// =============================================================
async function connectToWhatsApp() {
    try {
        const { state, saveCreds } =
            await useMultiFileAuthState(SESSION_DIR)

        const { version, isLatest } =
            await fetchLatestBaileysVersion()

        console.log(
            chalk.cyan(
                `Using WhatsApp v${version.join(".")} | Latest: ${isLatest}`
            )
        )

        const sock = makeWASocket({
            auth: state,
            version,
            printQRInTerminal: !usePairingCode,
            logger: pino({ level: "silent" }),
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            // Tambahan untuk keep-alive
            keepAliveIntervalMs: 30000,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000
        })

        // =============================================================
        // PAIRING CODE
        // =============================================================
        if (usePairingCode && !sock.authState.creds.registered) {
            try {
                const phoneNumber = await question(
                    "Masukkan nomor WhatsApp (contoh: 6281234567890):\n"
                )

                // Bersihkan nomor
                let cleanNumber = phoneNumber.trim()
                cleanNumber = cleanNumber.replace(/[^0-9]/g, "")
                if (cleanNumber.startsWith("0")) {
                    cleanNumber = "62" + cleanNumber.substring(1)
                }

                const code = await sock.requestPairingCode(cleanNumber)

                console.log(
                    chalk.green(`\n✓ PAIRING CODE: ${code}`)
                )
                console.log(
                    chalk.yellow(`Masukkan kode di HP > WhatsApp > Perangkat Tertaut > Tautkan Perangkat\n`)
                )
            } catch (err) {
                console.error("Pairing Error:", err)
            }
        }

        // =============================================================
        // SAVE SESSION
        // =============================================================
        sock.ev.on("creds.update", saveCreds)

        // =============================================================
        // CONNECTION UPDATE
        // =============================================================
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update

            if (connection === "connecting") {
                console.log(
                    chalk.yellow("Menghubungkan ke WhatsApp...")
                )
            }

            if (connection === "open") {
                console.log(
                    chalk.green("✓ Bot WhatsApp berhasil terhubung")
                )
                console.log(
                    chalk.green(`✓ User: ${sock.user?.name || sock.user?.id}`)
                )
                console.log(
                    chalk.green("✓ MODE: Auto C2 (Centang 2) - TANPA Centang Biru")
                )
                console.log(
                    chalk.green("✓ HP bisa dimatikan, bot tetap jalan 24/7\n")
                )
                
                // Kirim presence online
                await keepAlive(sock)
            }

            if (connection === "close") {
                const reason =
                    lastDisconnect?.error?.output?.statusCode

                console.log(
                    chalk.red(
                        `Koneksi terputus. Reason: ${reason}`
                    )
                )

                if (reason === DisconnectReason.loggedOut) {
                    console.log(
                        chalk.red(
                            "Session logout, hapus folder session lalu jalankan ulang."
                        )
                    )
                    return
                }

                console.log(
                    chalk.yellow(`Reconnect dalam ${RECONNECT_DELAY/1000} detik...`)
                )
                setTimeout(() => {
                    connectToWhatsApp()
                }, RECONNECT_DELAY)
            }
        })

        // =============================================================
        // MESSAGE HANDLER + AUTO C2
        // =============================================================
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const msg = m.messages[0]

                if (!msg) return
                if (!msg.message) return
                if (msg.key.fromMe) return

                // =====================================================
                // AUTO C2 (CENTANG 2) - TANPA CENTANG BIRU
                // =====================================================
                await sendDeliveryReceipt(sock, msg)

                const body =
                    msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    msg.message?.imageMessage?.caption ||
                    msg.message?.videoMessage?.caption ||
                    ""

                const pushname =
                    msg.pushName || "No Name"

                const colors = [
                    "red",
                    "green",
                    "yellow",
                    "blue",
                    "magenta",
                    "cyan",
                    "white"
                ]

                const randomColor =
                    colors[
                        Math.floor(
                            Math.random() * colors.length
                        )
                    ]

                console.log(
                    chalk.yellow.bold("Credit : Syfx"),
                    chalk.green.bold("[ WhatsApp ]"),
                    chalk[randomColor](pushname),
                    chalk[randomColor](" : "),
                    chalk.white(body)
                )

                // =====================================================
                // HANDLER lenwy
                // =====================================================
                try {
                    delete require.cache[
                        require.resolve("./lenwy")
                    ]

                    require("./lenwy")(sock, m)
                } catch (err) {
                    console.error(
                        "Handler Error:",
                        err
                    )
                }
            } catch (err) {
                console.error(
                    "Message Error:",
                    err
                )
            }
        })

        // =============================================================
        // KEEP-ALIVE SETIAP 2 MENIT
        // =============================================================
        setInterval(() => {
            if (sock && sock.user) {
                keepAlive(sock).catch(() => {})
            }
        }, 120000)

        // =============================================================
        // HEALTH CHECK SETIAP 5 MENIT
        // =============================================================
        setInterval(() => {
            if (!sock || !sock.user) {
                console.log(chalk.red("[!] Bot offline, reconnect..."))
                connectToWhatsApp()
            }
        }, 300000)

    } catch (err) {
        console.error("Main Error:", err)

        setTimeout(() => {
            connectToWhatsApp()
        }, RECONNECT_DELAY)
    }
}

// =============================================================
// ANTI CRASH + AUTO RESTART
// =============================================================
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err)
    setTimeout(() => {
        connectToWhatsApp()
    }, 5000)
})

process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err)
    setTimeout(() => {
        connectToWhatsApp()
    }, 5000)
})

// =============================================================
// RUN BOT
// =============================================================
console.log(chalk.green("=== WhatsApp Bot - Auto C2 (HP Mati Tetap Jalan) ==="))
console.log(chalk.yellow("Fitur: Centang 2 otomatis, keep-alive, auto reconnect\n"))
connectToWhatsApp()
