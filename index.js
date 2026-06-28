/*

  Made By Syfx
  Base : Baileys
  WhatsApp : wa.me/628xxxxxxxxxx

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

// Pairing Code
const usePairingCode = true

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

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } =
            await useMultiFileAuthState("./session")

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
            generateHighQualityLinkPreview: true
        })

        // Pairing Code
        if (usePairingCode && !sock.authState.creds.registered) {
            try {
                const phoneNumber = await question(
                    "Masukkan nomor WhatsApp diawali 62:\n"
                )

                const code = await sock.requestPairingCode(
                    phoneNumber.trim()
                )

                console.log(
                    chalk.green(`\nPairing Code: ${code}\n`)
                )
            } catch (err) {
                console.error("Pairing Error:", err)
            }
        }

        // Save Session
        sock.ev.on("creds.update", saveCreds)

        // Connection Update
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update

            if (connection === "connecting") {
                console.log(
                    chalk.yellow("Menghubungkan ke WhatsApp...")
                )
            }

            if (connection === "open") {
                console.log(
                    chalk.green(
                        "✓ Bot WhatsApp berhasil terhubung"
                    )
                )
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
                            "Session logout, hapus folder session lalu scan ulang."
                        )
                    )
                    return
                }

                setTimeout(() => {
                    connectToWhatsApp()
                }, 5000)
            }
        })

        // Message Handler
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const msg = m.messages[0]

                if (!msg) return
                if (!msg.message) return
                if (msg.key.fromMe) return

                // =====================================================
                // TAMBAHAN: Auto Centang 2 (Tanpa Centang Biru)
                // =====================================================
                // Mengirim status 'receipt' ke WhatsApp server
                // 'sender' = Pesan sampai server (Centang 2)
                await sock.readMessages([msg.key])
                // Jangan gunakan 'read' agar tidak menjadi centang biru
                // =====================================================

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

                // Handler
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
    } catch (err) {
        console.error("Main Error:", err)

        setTimeout(() => {
            connectToWhatsApp()
        }, 5000)
    }
}

// Anti Crash
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err)
})

process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err)
})

// Run Bot
connectToWhatsApp()
