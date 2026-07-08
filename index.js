/*
  WHATSAPP BOT – PAIRING CODE UNTUK SEMUA NEGARA
  Support: +1, +44, +62, +81, +91, +55, +234, dll.
  Mode: C2 (Centang 2) – TANPA Centang Biru
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

// =============================================================
// INPUT DARI TERMINAL
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
// BERSIHKAN NOMOR – SUPPORT SEMUA NEGARA
// =============================================================
function cleanPhoneNumber(raw) {
    let cleaned = raw.trim()
    
    // Hapus semua spasi, tanda kurung, strip, titik
    cleaned = cleaned.replace(/[\s\-\(\)\.]/g, "")
    
    // Jika diawali +, pertahankan
    if (cleaned.startsWith("+")) {
        cleaned = cleaned.substring(1) // ambil angka setelah +
    }
    
    // Hapus semua karakter non-digit (kecuali + sudah dihapus)
    cleaned = cleaned.replace(/\D/g, "")
    
    // Pastikan tidak kosong
    if (!cleaned || cleaned.length < 8) {
        throw new Error("Nomor terlalu pendek. Minimal 8 digit termasuk kode negara.")
    }
    
    // Jika tidak diawali kode negara (0-9), tapi kita sudah punya angka
    // Biarkan apa adanya – user harus memasukkan kode negara
    
    return cleaned
}

// =============================================================
// HAPUS SESSION LAMA
// =============================================================
function clearSession() {
    if (fs.existsSync(SESSION_DIR)) {
        const backup = `./session_backup_${Date.now()}`
        fs.renameSync(SESSION_DIR, backup)
        console.log(chalk.yellow(`[!] Session lama dibackup ke ${backup}`))
    }
    fs.mkdirSync(SESSION_DIR, { recursive: true })
}

// =============================================================
// CONNECT KE WHATSAPP
// =============================================================
async function connectToWhatsApp(phoneNumber) {
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
            printQRInTerminal: false, // HANYA PAIRING CODE
            logger: pino({ level: "silent" }),
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            keepAliveIntervalMs: 30000,
            connectTimeoutMs: 60000
        })

        sock.ev.on("creds.update", saveCreds)

        // =============================================================
        // PAIRING CODE OTOMATIS – UNTUK SEMUA NEGARA
        // =============================================================
        let pairingRequested = false

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, pairingCode } = update

            // Jika pairing code muncul dari event
            if (pairingCode) {
                console.log(chalk.green(`\n[✓] PAIRING CODE: ${pairingCode}`))
                console.log(chalk.yellow(`[!] Buka WhatsApp > Perangkat Tertaut > Tautkan Perangkat`))
                console.log(chalk.yellow(`[!] Masukkan kode: ${pairingCode}\n`))
            }

            if (connection === "connecting") {
                console.log(chalk.yellow("Menghubungkan ke WhatsApp..."))
            }

            if (connection === "open") {
                console.log(chalk.green(`\n[✓] BOT ONLINE – ${sock.user?.name || sock.user?.id}`))
                console.log(chalk.green(`[✓] Support semua negara – kode negara apapun`))
                console.log(chalk.green(`[✓] Mode: C2 (Centang 2) – TANPA Centang Biru`))
                console.log(chalk.green(`[✓] HP bisa dimatikan, bot jalan 24/7\n`))
                
                try {
                    await sock.sendPresenceUpdate('available')
                } catch (e) {}
            }

            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode
                console.log(chalk.red(`[!] Koneksi terputus: ${reason}`))
                
                if (reason === DisconnectReason.loggedOut) {
                    console.log(chalk.red("[!] Logout. Jalankan ulang dengan --new"))
                    return
                }
                
                setTimeout(() => connectToWhatsApp(phoneNumber), RECONNECT_DELAY)
            }
        })

        // =============================================================
        // REQUEST PAIRING CODE – MANUAL DENGAN NOMOR DARI INPUT
        // =============================================================
        sock.ev.on("connection.update", async (update) => {
            // Saat koneksi mulai, dan belum registered, minta pairing
            if (update.connection === "connecting" && !sock.authState.creds.registered && !pairingRequested) {
                pairingRequested = true
                
                try {
                    console.log(chalk.cyan(`[!] Meminta pairing code untuk nomor: ${phoneNumber}`))
                    
                    // Request pairing code
                    const code = await sock.requestPairingCode(phoneNumber)
                    
                    console.log(chalk.green(`\n[✓] PAIRING CODE: ${code}`))
                    console.log(chalk.yellow(`[!] Masukkan kode ${code} di HP WhatsApp > Perangkat Tertaut > Tautkan Perangkat`))
                    console.log(chalk.yellow(`[!] Jika tidak muncul, coba ketik manual di HP.\n`))
                    
                } catch (err) {
                    console.error(chalk.red(`[!] Gagal request pairing: ${err.message}`))
                    console.log(chalk.yellow("[!] Pastikan nomor benar dan koneksi internet stabil."))
                    console.log(chalk.yellow("[!] Coba jalankan ulang dengan nomor yang benar."))
                    pairingRequested = false
                }
            }
        })

        // =============================================================
        // MESSAGE HANDLER – C2 TANPA BIRU
        // =============================================================
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const msg = m.messages[0]
                if (!msg) return
                if (!msg.message) return
                if (msg.key.fromMe) return

                // TIDAK ADA readMessages – centang 2 otomatis dari server

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
        setTimeout(() => connectToWhatsApp(phoneNumber), RECONNECT_DELAY)
    }
}

// =============================================================
// ANTI CRASH
// =============================================================
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err)
    setTimeout(() => {
        const phone = process.env.LAST_PHONE || "6281234567890"
        connectToWhatsApp(phone)
    }, 5000)
})

process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err)
    setTimeout(() => {
        const phone = process.env.LAST_PHONE || "6281234567890"
        connectToWhatsApp(phone)
    }, 5000)
})

// =============================================================
// MAIN – EKSEKUSI
// =============================================================
console.log(chalk.green("=== WHATSAPP BOT – PAIRING CODE UNTUK SEMUA NEGARA ==="))
console.log(chalk.yellow("Support: +1 (US), +44 (UK), +62 (Indonesia), +81 (Jepang), dll."))
console.log(chalk.yellow("Format: kode negara + nomor, contoh: 6281234567890 atau 447912345678\n"))

;(async () => {
    // Hapus session jika argumen --new
    if (process.argv.includes("--new")) {
        clearSession()
    }

    // Minta nomor HP
    const rawNumber = await question("Masukkan nomor WhatsApp (dengan kode negara, tanpa +): ")
    
    let phoneNumber
    try {
        phoneNumber = cleanPhoneNumber(rawNumber)
        console.log(chalk.cyan(`[!] Nomor terdeteksi: ${phoneNumber}`))
        console.log(chalk.cyan(`[!] Kode negara: ${phoneNumber.substring(0, phoneNumber.length - 10)}...`))
    } catch (err) {
        console.log(chalk.red(`[!] Error: ${err.message}`))
        console.log(chalk.yellow("[!] Contoh format yang benar:"))
        console.log(chalk.yellow("  - Indonesia: 6281234567890"))
        console.log(chalk.yellow("  - US: 14151234567"))
        console.log(chalk.yellow("  - UK: 447912345678"))
        console.log(chalk.yellow("  - Jepang: 819012345678"))
        process.exit(1)
    }

    // Simpan untuk auto-reconnect
    process.env.LAST_PHONE = phoneNumber

    // Jalankan bot
    await connectToWhatsApp(phoneNumber)
})()
