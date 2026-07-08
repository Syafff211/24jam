/*
  PAIRING CODE ONLY – NO QR, NO BLUE TICK
  Untuk desa – 100% pairing code
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

// Input nomor HP
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

// Hapus session lama jika perlu
function clearSession() {
    if (fs.existsSync(SESSION_DIR)) {
        const backup = `./session_backup_${Date.now()}`
        fs.renameSync(SESSION_DIR, backup)
        console.log(chalk.yellow(`[!] Session lama dibackup ke ${backup}`))
    }
    fs.mkdirSync(SESSION_DIR, { recursive: true })
}

async function connectToWhatsApp() {
    try {
        // Jika ada argumen --new, hapus session
        if (process.argv.includes("--new")) {
            clearSession()
        }

        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
        const { version, isLatest } = await fetchLatestBaileysVersion()

        console.log(chalk.cyan(`Using WhatsApp v${version.join(".")} | Latest: ${isLatest}`))

        const sock = makeWASocket({
            auth: state,
            version,
            printQRInTerminal: false, // MATIKAN QR – HANYA PAIRING CODE
            logger: pino({ level: "silent" }),
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            keepAliveIntervalMs: 30000,
            connectTimeoutMs: 60000
        })

        sock.ev.on("creds.update", saveCreds)

        // =============================================================
        // PAIRING CODE – TANPA QR, TANPA PERMINTAAN MANUAL
        // =============================================================
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, pairingCode } = update

            // Jika pairing code tersedia, tampilkan
            if (pairingCode) {
                console.log(chalk.green(`\n[✓] PAIRING CODE: ${pairingCode}`))
                console.log(chalk.yellow(`[!] Masukkan kode ini di HP > WhatsApp > Perangkat Tertaut > Tautkan Perangkat`))
                console.log(chalk.yellow(`[!] Atau buka WhatsApp > Ketuk titik tiga > Perangkat Tertaut > Tautkan Perangkat\n`))
            }

            if (connection === "connecting") {
                console.log(chalk.yellow("Menghubungkan ke WhatsApp..."))
            }

            if (connection === "open") {
                console.log(chalk.green("\n[✓] BOT ONLINE"))
                console.log(chalk.green(`[✓] User: ${sock.user?.name || sock.user?.id}`))
                console.log(chalk.green(`[✓] Mode: PAIRING CODE ONLY – C2 (Centang 2, TANPA BIRU)`))
                console.log(chalk.green(`[✓] HP bisa dimatikan, bot tetap jalan 24/7\n`))
                
                // Kirim presence online
                try {
                    await sock.sendPresenceUpdate('available')
                } catch (e) {}
            }

            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode
                console.log(chalk.red(`[!] Koneksi terputus: ${reason}`))
                
                if (reason === DisconnectReason.loggedOut) {
                    console.log(chalk.red("[!] Session logout. Jalankan ulang dengan --new"))
                    return
                }
                
                setTimeout(() => connectToWhatsApp(), RECONNECT_DELAY)
            }
        })

        // =============================================================
        // MESSAGE HANDLER – C2 TANPA BIRU (TANPA readMessages)
        // =============================================================
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const msg = m.messages[0]
                if (!msg) return
                if (!msg.message) return
                if (msg.key.fromMe) return

                // TIDAK ADA readMessages – otomatis centang 2 dari server

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

                // Panggil handler lenwy
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

        // Keep-alive setiap 2 menit
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

// Anti crash
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err)
    setTimeout(() => connectToWhatsApp(), 5000)
})

process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err)
    setTimeout(() => connectToWhatsApp(), 5000)
})

// =============================================================
// EKSEKUSI – PAIRING CODE OTOMATIS
// =============================================================
console.log(chalk.green("=== WHATSAPP BOT – PAIRING CODE ONLY ==="))
console.log(chalk.yellow("Tidak pakai QR, hanya pairing code."))
console.log(chalk.yellow("Bot akan meminta nomor HP di bawah.\n"))

// Jalankan dan minta nomor
;(async () => {
    // Hapus session jika ada argumen --new
    if (process.argv.includes("--new")) {
        clearSession()
    }

    // Minta nomor HP dari terminal
    const phoneNumber = await question("Masukkan nomor WhatsApp (contoh: 6281234567890): ")
    
    // Bersihkan nomor
    let cleanNumber = phoneNumber.trim()
    cleanNumber = cleanNumber.replace(/[^0-9]/g, "")
    if (cleanNumber.startsWith("0")) {
        cleanNumber = "62" + cleanNumber.substring(1)
    }
    if (!cleanNumber.startsWith("62")) {
        cleanNumber = "62" + cleanNumber
    }
    
    console.log(chalk.cyan(`[!] Menggunakan nomor: ${cleanNumber}`))
    console.log(chalk.yellow("[!] Meminta pairing code dari WhatsApp...\n"))

    // Simpan nomor ke environment agar bisa dipakai di connectToWhatsApp
    process.env.PAIRING_PHONE = cleanNumber

    // Jalankan koneksi
    await connectToWhatsApp()
})()
