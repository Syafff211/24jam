/*
  WHATSAPP BOT – FINAL
  Pairing Code + Auto Connect
  Support semua negara
*/

const {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")

const pino = require("pino")
const chalk = require("chalk")
const readline = require("readline")
const fs = require("fs")

const SESSION_DIR = "./session"
const RECONNECT_DELAY = 3000

// =============================================================
// INPUT
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
// BERSIHKAN NOMOR
// =============================================================
function cleanNumber(raw) {
    let cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, "")
    if (cleaned.startsWith("+")) cleaned = cleaned.substring(1)
    cleaned = cleaned.replace(/\D/g, "")
    if (cleaned.startsWith("0")) cleaned = "62" + cleaned.substring(1)
    if (cleaned.length < 8) throw new Error("Nomor terlalu pendek")
    return cleaned
}

// =============================================================
// HAPUS SESSION
// =============================================================
function clearSession() {
    if (fs.existsSync(SESSION_DIR)) {
        fs.rmSync(SESSION_DIR, { recursive: true, force: true })
        console.log(chalk.yellow("[!] Session dihapus"))
    }
    fs.mkdirSync(SESSION_DIR, { recursive: true })
}

// =============================================================
// CEK SESSION VALID
// =============================================================
function isSessionValid() {
    if (!fs.existsSync(SESSION_DIR)) return false
    const files = fs.readdirSync(SESSION_DIR)
    return files.some(f => f.includes("creds") || f.includes("auth"))
}

// =============================================================
// MAIN BOT
// =============================================================
async function startBot(phoneNumber) {
    console.log(chalk.cyan(`[!] Starting bot untuk: ${phoneNumber}`))

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: "silent" }),
        browser: ["Chrome", "Windows", "10"],
        printQRInTerminal: false,
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        markOnlineOnConnect: true
    })

    sock.ev.on("creds.update", saveCreds)

    // =============================================================
    // PAIRING CODE
    // =============================================================
    let pairingRequested = false
    let connected = false

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr, pairingCode } = update

        // TAMPILKAN PAIRING CODE
        if (pairingCode && !pairingRequested) {
            console.log(chalk.green(`\n[✓] PAIRING CODE: ${pairingCode}`))
            console.log(chalk.yellow(`[!] Masukkan di HP > WhatsApp > Perangkat Tertaut > Tautkan Perangkat`))
            console.log(chalk.yellow(`[!] Tunggu 10 detik setelah memasukkan kode...\n`))
            pairingRequested = true
        }

        // QR FALLBACK
        if (qr && !pairingRequested) {
            console.log(chalk.yellow(`\n[!] QR CODE (fallback):\n${qr}\n`))
            console.log(chalk.yellow(`[!] Scan QR dengan HP\n`))
        }

        // CONNECTED
        if (connection === "open") {
            connected = true
            console.log(chalk.green(`\n[✓] BOT ONLINE!`))
            console.log(chalk.green(`[✓] User: ${sock.user?.name || sock.user?.id}`))
            console.log(chalk.green(`[✓] Mode: C2 – TANPA Centang Biru`))
            console.log(chalk.green(`[✓] HP bisa dimatikan, bot jalan 24/7\n`))

            // Kirim presence
            try {
                await sock.sendPresenceUpdate('available')
            } catch (e) {}
        }

        // DISCONNECT
        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode
            const errorMsg = lastDisconnect?.error?.message || ""

            console.log(chalk.red(`[!] Disconnect: ${statusCode} | ${errorMsg}`))

            // Jika logout atau 401, hapus session
            if (statusCode === 401 || errorMsg.includes("logged out")) {
                console.log(chalk.red("[!] Session invalid. Hapus session dan restart."))
                clearSession()
                return
            }

            // Jika belum connected tapi pairing code sudah muncul,
            // coba reconnect dengan session yang sudah ada
            if (!connected && isSessionValid()) {
                console.log(chalk.yellow("[!] Session ditemukan, mencoba reconnect..."))
                setTimeout(() => startBot(phoneNumber), 2000)
                return
            }

            // Reconnect normal
            console.log(chalk.yellow(`[!] Reconnect dalam ${RECONNECT_DELAY/1000} detik...`))
            setTimeout(() => startBot(phoneNumber), RECONNECT_DELAY)
        }
    })

    // =============================================================
    // REQUEST PAIRING CODE – SETELAH SOCKET SIAP
    // =============================================================
    setTimeout(async () => {
        try {
            // Cek apakah sudah registered
            if (sock.authState.creds.registered) {
                console.log(chalk.green("[!] Session sudah terdaftar, menunggu koneksi..."))
                return
            }

            // Jika belum ada session dan pairing belum diminta
            if (!pairingRequested && !isSessionValid()) {
                console.log(chalk.cyan(`[!] Meminta pairing code untuk ${phoneNumber}...`))
                const code = await sock.requestPairingCode(phoneNumber)
                console.log(chalk.green(`\n[✓] PAIRING CODE: ${code}`))
                console.log(chalk.yellow(`[!] Masukkan kode di HP > WhatsApp > Perangkat Tertaut > Tautkan Perangkat`))
                console.log(chalk.yellow(`[!] Setelah memasukkan kode, bot akan connect otomatis.\n`))
                pairingRequested = true
            }
        } catch (err) {
            console.error(chalk.red(`[!] Gagal request pairing: ${err.message}`))
            console.log(chalk.yellow("[!] Coba metode QR..."))
            
            // Aktifkan QR
            sock.ev.on("connection.update", (upd) => {
                if (upd.qr) {
                    console.log(chalk.green(`\n[✓] SCAN QR:\n${upd.qr}\n`))
                }
            })
            
            // Restart dengan QR
            setTimeout(() => {
                const newSock = makeWASocket({
                    auth: state,
                    version,
                    logger: pino({ level: "silent" }),
                    browser: ["Chrome", "Windows", "10"],
                    printQRInTerminal: true,
                    syncFullHistory: false,
                    connectTimeoutMs: 60000
                })
                // Overwrite sock
                Object.assign(sock, newSock)
            }, 2000)
        }
    }, 3000)

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

    // =============================================================
    // KEEP-ALIVE
    // =============================================================
    setInterval(() => {
        if (sock && sock.user && connected) {
            sock.sendPresenceUpdate('available').catch(() => {})
        }
    }, 120000)

    // Health check
    setInterval(() => {
        if (!connected && isSessionValid()) {
            console.log(chalk.yellow("[!] Bot tidak terhubung tapi session ada. Coba reconnect..."))
            startBot(phoneNumber)
        }
    }, 30000)
}

// =============================================================
// ANTI CRASH
// =============================================================
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err)
    setTimeout(() => {
        const phone = process.env.LAST_PHONE || "6281234567890"
        startBot(phone)
    }, 5000)
})

process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err)
    setTimeout(() => {
        const phone = process.env.LAST_PHONE || "6281234567890"
        startBot(phone)
    }, 5000)
})

// =============================================================
// MAIN
// =============================================================
console.log(chalk.green("=== WHATSAPP BOT – FINAL (PAIRING + AUTO CONNECT) ==="))
console.log(chalk.yellow("Support semua negara | C2 tanpa biru | Auto reconnect\n"))

;(async () => {
    if (process.argv.includes("--new")) {
        clearSession()
    }

    // Jika session sudah ada, langsung jalan tanpa input
    if (isSessionValid()) {
        console.log(chalk.green("[!] Session ditemukan. Menjalankan bot..."))
        const phone = "6281234567890" // dummy, tidak dipakai
        process.env.LAST_PHONE = phone
        await startBot(phone)
        return
    }

    const raw = await question("Masukkan nomor (kode negara + nomor, tanpa +): ")
    
    let phone
    try {
        phone = cleanNumber(raw)
        console.log(chalk.cyan(`[!] Nomor: ${phone}\n`))
    } catch (err) {
        console.log(chalk.red(`[!] ${err.message}`))
        console.log(chalk.yellow("Contoh: 6281234567890 (Indonesia) atau 447912345678 (UK)"))
        process.exit(1)
    }

    process.env.LAST_PHONE = phone
    await startBot(phone)
})()
