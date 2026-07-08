/*
  Made By Syfx (Fixed by Colin)
  Base : Baileys
  Fix: Pairing Code & Auto C2
*/

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

// ========== KONFIGURASI ==========
const SESSION_DIR = "./session"
const AUTO_READ = true
const MARK_READ = false
const RECONNECT_DELAY = 5000

// ========== INPUT ==========
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

// ========== HAPUS SESSION LAMA ==========
function clearSession() {
    if (fs.existsSync(SESSION_DIR)) {
        const backup = `./session_backup_${Date.now()}`
        fs.renameSync(SESSION_DIR, backup)
        console.log(chalk.yellow(`[!] Session lama dibackup ke ${backup}`))
        console.log(chalk.yellow("[!] Buat session baru..."))
    }
    fs.mkdirSync(SESSION_DIR, { recursive: true })
}

// ========== AUTO C2 ==========
async function sendReadReceipt(sock, msg) {
    try {
        if (!msg.key.remoteJid) return
        if (msg.key.fromMe) return
        if (!AUTO_READ) return

        await sock.readMessages([msg.key])
        if (MARK_READ) {
            await sock.sendReadReceipt(msg.key.remoteJid, msg.key.participant, [msg.key.id])
        }
    } catch (err) {
        // Diabaikan
    }
}

// ========== MAIN ==========
async function connectToWhatsApp() {
    try {
        // Hapus session jika pairing gagal
        const forceNew = process.argv.includes("--new")
        if (forceNew) {
            console.log(chalk.yellow("[!] Force new session mode"))
            clearSession()
        }

        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
        const { version, isLatest } = await fetchLatestBaileysVersion()

        console.log(chalk.cyan(`Using WhatsApp v${version.join(".")} | Latest: ${isLatest}`))

        const sock = makeWASocket({
            auth: state,
            version,
            printQRInTerminal: true, // SELALU tampilkan QR sebagai fallback
            logger: pino({ level: "silent" }),
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            keepAliveIntervalMs: 30000,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 30000
        })

        // ========== PAIRING CODE - VERSI STABIL ==========
        let pairingCodeSent = false

        // Event untuk menangkap pairing code
        sock.ev.on("connection.update", async (update) => {
            const { connection, qr, pairingCode } = update

            // Jika ada QR, tampilkan di terminal (fallback)
            if (qr && !pairingCodeSent) {
                console.log(chalk.yellow("\n[!] Scan QR Code ini jika pairing code tidak masuk:"))
                console.log(chalk.green(qr))
                console.log(chalk.yellow("Scan dengan WhatsApp > Linked Devices > Link a Device\n"))
            }

            // Jika pairing code tersedia (method baru)
            if (pairingCode && !pairingCodeSent) {
                console.log(chalk.green(`\n[✓] Pairing Code: ${pairingCode}`))
                console.log(chalk.yellow(`[!] Masukkan kode ini di WhatsApp > Linked Devices > Link a Device`))
                pairingCodeSent = true
            }

            if (connection === "open") {
                console.log(chalk.green("\n[✓] Bot WhatsApp berhasil terhubung!"))
                console.log(chalk.green(`[✓] User: ${sock.user?.name || sock.user?.id || "Unknown"}`))
                console.log(chalk.green(`[✓] HP bisa dimatikan, bot tetap online 24/7`))
                console.log(chalk.green(`[✓] Auto C2 aktif untuk semua pesan\n`))
            }

            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode
                const errorMsg = lastDisconnect?.error?.message || ""

                console.log(chalk.red(`[!] Koneksi terputus: ${reason} | ${errorMsg}`))

                if (reason === DisconnectReason.loggedOut || errorMsg.includes("logged out")) {
                    console.log(chalk.red("[!] Session logout. Jalankan ulang dengan --new"))
                    clearSession()
                    return
                }

                setTimeout(() => connectToWhatsApp(), RECONNECT_DELAY)
            }
        })

        // ========== PAIRING MANUAL (LEBIH ANDAL) ==========
        // Metode: langsung request pairing setelah konek
        sock.ev.on("connection.update", async (update) => {
            const { connection } = update

            // Saat pertama kali connect dan belum registered
            if (connection === "connecting" && !sock.authState.creds.registered) {
                // Tunggu 3 detik, lalu minta pairing via terminal
                setTimeout(async () => {
                    if (!sock.authState.creds.registered) {
                        try {
                            console.log(chalk.cyan("\n[?] Masukkan nomor WhatsApp (format: 628xxxxxxxxxx):"))
                            const phoneNumber = await question("Nomor: ")
                            
                            // Bersihkan nomor
                            let cleanNumber = phoneNumber.trim()
                            if (cleanNumber.startsWith("0")) {
                                cleanNumber = "62" + cleanNumber.substring(1)
                            }
                            if (cleanNumber.startsWith("+")) {
                                cleanNumber = cleanNumber.substring(1)
                            }
                            // Hapus semua non-digit
                            cleanNumber = cleanNumber.replace(/\D/g, "")
                            
                            console.log(chalk.cyan(`[!] Request pairing untuk ${cleanNumber}...`))
                            
                            const code = await sock.requestPairingCode(cleanNumber)
                            console.log(chalk.green(`\n[✓] PAIRING CODE: ${code}`))
                            console.log(chalk.yellow(`[!] Masukkan kode ${code} di HP WhatsApp > Linked Devices > Link a Device\n`))
                            
                            pairingCodeSent = true
                        } catch (err) {
                            console.error(chalk.red(`[!] Gagal request pairing: ${err.message}`))
                            console.log(chalk.yellow("[!] Coba scan QR code di terminal sebagai alternatif."))
                        }
                    }
                }, 3000)
            }
        })

        // ========== SAVE SESSION ==========
        sock.ev.on("creds.update", saveCreds)

        // ========== MESSAGE HANDLER + AUTO C2 ==========
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const msg = m.messages[0]
                if (!msg) return
                if (!msg.message) return
                if (msg.key.fromMe) return

                // Auto C2
                await sendReadReceipt(sock, msg)

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

                // Handler
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

        // ========== KEEP-ALIVE ==========
        setInterval(() => {
            if (sock && sock.user) {
                sock.sendPresenceUpdate('available').catch(() => {})
            }
        }, 120000)

        setInterval(() => {
            if (!sock || !sock.user) {
                console.log(chalk.red("[!] Bot offline, reconnect..."))
                connectToWhatsApp()
            }
        }, 300000)

    } catch (err) {
        console.error("Main Error:", err)
        setTimeout(() => connectToWhatsApp(), RECONNECT_DELAY)
    }
}

// ========== ANTI CRASH ==========
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err)
    setTimeout(() => connectToWhatsApp(), 5000)
})

process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err)
    setTimeout(() => connectToWhatsApp(), 5000)
})

// ========== RUN ==========
console.log(chalk.green("=== WhatsApp Bot - Pairing Fix + Auto C2 ==="))
console.log(chalk.yellow("Mode: QR Fallback + Pairing Manual"))
console.log(chalk.yellow("Jika pairing code tidak masuk, scan QR di terminal\n"))

// Jika ada argumen --new, hapus session
if (process.argv.includes("--new")) {
    clearSession()
}

connectToWhatsApp()
