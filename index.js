/*
  WHATSAPP BOT – PAIRING CODE STABIL
  Versi Baileys 6.5.0
  Support semua negara
*/

const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
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
        fs.rmSync(SESSION_DIR, { recursive: true, force: true })
        console.log(chalk.yellow("[!] Session dihapus"))
    }
    fs.mkdirSync(SESSION_DIR, { recursive: true })
}

async function connectToWhatsApp(phoneNumber) {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
        
        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: "silent" }),
            browser: ["Chrome", "Windows", "10"],
            printQRInTerminal: false,
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000
        })

        sock.ev.on("creds.update", saveCreds)

        // =========================================================
        // PAIRING CODE – METODE MANUAL
        // =========================================================
        let pairingSent = false

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update

            if (connection === "open") {
                console.log(chalk.green(`\n[✓] BOT ONLINE – ${sock.user?.name || sock.user?.id}`))
                console.log(chalk.green(`[✓] Mode: C2 – TANPA Centang Biru`))
                console.log(chalk.green(`[✓] HP bisa dimatikan\n`))
                return
            }

            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode
                console.log(chalk.red(`[!] Disconnect: ${reason}`))
                if (reason === 401 || reason === DisconnectReason.loggedOut) {
                    console.log(chalk.red("[!] Session invalid. Hapus session dan jalankan ulang."))
                    return
                }
                setTimeout(() => connectToWhatsApp(phoneNumber), RECONNECT_DELAY)
            }
        })

        // =========================================================
        // REQUEST PAIRING CODE – PASTI JALAN
        // =========================================================
        // Tunggu sampai socket siap
        setTimeout(async () => {
            try {
                if (!sock.authState.creds.registered) {
                    console.log(chalk.cyan(`[!] Meminta pairing untuk: ${phoneNumber}`))
                    
                    // Method pairing yang benar di Baileys
                    const code = await sock.requestPairingCode(phoneNumber)
                    
                    console.log(chalk.green(`\n[✓] PAIRING CODE: ${code}`))
                    console.log(chalk.yellow(`[!] Masukkan kode di HP > WhatsApp > Perangkat Tertaut > Tautkan Perangkat\n`))
                    
                    pairingSent = true
                }
            } catch (err) {
                console.error(chalk.red(`[!] Gagal: ${err.message}`))
                console.log(chalk.yellow("[!] Coba metode QR sebagai fallback..."))
                
                // Fallback: tampilkan QR
                sock.ev.on("connection.update", (upd) => {
                    if (upd.qr) {
                        console.log(chalk.green(`\n[✓] SCAN QR CODE:\n${upd.qr}\n`))
                        console.log(chalk.yellow("[!] Scan dengan WhatsApp > Perangkat Tertaut > Tautkan Perangkat\n"))
                    }
                })
            }
        }, 3000)

        // =========================================================
        // MESSAGE HANDLER – TANPA CENTANG BIRU
        // =========================================================
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

                // Panggil handler
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

    } catch (err) {
        console.error("Main Error:", err)
        setTimeout(() => connectToWhatsApp(phoneNumber), RECONNECT_DELAY)
    }
}

// =========================================================
// MAIN
// =========================================================
console.log(chalk.green("=== WHATSAPP BOT – PAIRING CODE STABIL ===\n"))

;(async () => {
    // Hapus session jika --new
    if (process.argv.includes("--new")) {
        clearSession()
    }

    const raw = await question("Masukkan nomor (kode negara + nomor, tanpa +): ")
    
    // Bersihkan nomor
    let phone = raw.trim().replace(/[\s\-\(\)\.]/g, "").replace(/\D/g, "")
    if (phone.startsWith("0")) phone = "62" + phone.substring(1)
    
    console.log(chalk.cyan(`[!] Nomor: ${phone}\n`))
    
    await connectToWhatsApp(phone)
})()
