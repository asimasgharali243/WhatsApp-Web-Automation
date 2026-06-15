const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { getClient, isClientReady } = require('./whatsappClient');
const { validateApiKey, logApiUsage } = require('./middleware/auth');
const { recordApiKeyUsage } = require('./services/apiKeyService');
const config = require('./config');

const router = express.Router();

// Apply API key validation to all routes
router.use(validateApiKey);
router.use(logApiUsage);

// ============ USER SESSION STORAGE ============
const userSessions = new Map(); // userId -> { client, phoneNumber, status, sessionId, createdAt, qrCode }
const sessionQRs = new Map();   // userId -> qrDataUrl
const sessionStatus = new Map(); // userId -> status

// Directory for user sessions
const USER_SESSIONS_DIR = path.join(process.cwd(), 'user_sessions');

if (!fs.existsSync(USER_SESSIONS_DIR)) {
    fs.mkdirSync(USER_SESSIONS_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, config.temp.path);
    },
    filename: (req, file, cb) => {
        const uniqueId = uuidv4();
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueId}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: config.temp.maxFileSize },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF and images are allowed.'));
        }
    }
});

// ============ CORE SESSION MANAGEMENT ============

// 1. Create/Initiate a session for a user (returns QR code)
router.post('/session/create', async (req, res) => {
    const { userId, phoneNumber } = req.body;
    
    console.log(`\n🔄 CREATING SESSION FOR USER: ${userId}`);
    console.log(`   Phone Number: ${phoneNumber}`);
    
    if (!userId || !phoneNumber) {
        return res.status(400).json({
            success: false,
            error: 'userId and phoneNumber are required'
        });
    }
    
    // Check if user already has an active and ready session
    if (userSessions.has(userId)) {
        const existing = userSessions.get(userId);
        const status = sessionStatus.get(userId);
        
        if (status === 'ready') {
            console.log(`   ✅ User ${userId} already has a READY session`);
            return res.json({
                success: true,
                userId,
                phoneNumber: existing.phoneNumber,
                sessionId: existing.sessionId,
                status: 'ready',
                isReady: true,
                message: 'Session already exists and is ready to use',
                createdAt: existing.createdAt
            });
        }
        
        // If session exists but not ready, return existing QR
        const existingQR = sessionQRs.get(userId);
        if (existingQR) {
            console.log(`   📱 Returning existing QR code for ${userId}`);
            return res.json({
                success: true,
                userId,
                phoneNumber: existing.phoneNumber,
                sessionId: existing.sessionId,
                status: sessionStatus.get(userId) || 'awaiting_scan',
                isReady: false,
                message: 'Session exists. Scan QR code to authenticate.',
                qrCode: existingQR,
                qrCodeImageUrl: `/api/session/qr-image/${userId}`,
                instruction: 'Scan this QR code with WhatsApp on your phone'
            });
        }
    }
    
    // Create new session
    try {
        const sessionId = `session_${userId}_${Date.now()}`;
        const sessionPath = path.join(USER_SESSIONS_DIR, userId);
        
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }
        
        console.log(`   🤖 Creating WhatsApp client...`);
        
        const client = new Client({
            authStrategy: new LocalAuth({
                dataPath: sessionPath
            }),
            puppeteer: {
                headless: false,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            },
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
            }
        });
        
        // Store session info
        userSessions.set(userId, {
            client,
            phoneNumber,
            status: 'initializing',
            createdAt: new Date().toISOString(),
            userId,
            sessionId
        });
        
        sessionStatus.set(userId, 'initializing');
        
        // QR Code event - This is where QR is generated for the user
        // client.on('qr', async (qr) => {
        //     console.log(`\n📱 QR CODE GENERATED FOR USER: ${userId}`);
        //     sessionStatus.set(userId, 'awaiting_scan');
            
        //     const sessionData = userSessions.get(userId);
        //     if (sessionData) {
        //         sessionData.status = 'awaiting_scan';
        //         userSessions.set(userId, sessionData);
        //     }
            
        //     // Generate QR as data URL (base64) for API response
        //     try {
        //         const qrDataUrl = await qrcode.toDataURL(qr);
        //         sessionQRs.set(userId, qrDataUrl);
        //         console.log(`   ✅ QR code generated (${qrDataUrl.length} chars)`);
        //     } catch (err) {
        //         console.error(`   ❌ QR generation error:`, err.message);
        //     }
        // });
        
        // QR Code event - Fixed for large QR strings
client.on('qr', async (qr) => {
    console.log(`\n📱 QR CODE GENERATED FOR USER: ${userId}`);
    sessionStatus.set(userId, 'awaiting_scan');
    
    const sessionData = userSessions.get(userId);
    if (sessionData) {
        sessionData.status = 'awaiting_scan';
        userSessions.set(userId, sessionData);
    }
    
    // Generate QR as data URL (base64) for API response
    try {
        // Use a more robust QR generation method
        const QRCode = require('qrcode');
        
        // Options for better handling of large QR codes
        const qrOptions = {
            errorCorrectionLevel: 'L', // Lower error correction for smaller QR
            margin: 1,
            width: 300,
            type: 'image/png'
        };
        
        const qrDataUrl = await QRCode.toDataURL(qr, qrOptions);
        sessionQRs.set(userId, qrDataUrl);
        console.log(`   ✅ QR code generated (${(qrDataUrl.length / 1024).toFixed(1)} KB)`);
        
        // Also save QR to file for easier access
        const qrFilePath = path.join(__dirname, '../temp', `qr-${userId}.png`);
        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(qrFilePath, Buffer.from(base64Data, 'base64'));
        console.log(`   💾 QR also saved to: temp/qr-${userId}.png`);
        
    } catch (err) {
        console.error(`   ❌ QR generation error:`, err.message);
        // Fallback: just store the raw QR string
        sessionQRs.set(userId, null);
    }
});
        // Authentication successful - User scanned the QR
        client.on('authenticated', () => {
            console.log(`\n🔐 USER ${userId} AUTHENTICATED SUCCESSFULLY!`);
            console.log(`   WhatsApp session is now active`);
            sessionStatus.set(userId, 'authenticated');
            const sessionData = userSessions.get(userId);
            if (sessionData) {
                sessionData.status = 'authenticated';
                userSessions.set(userId, sessionData);
            }
        });
        
        // Session is ready - Can now send messages
        client.on('ready', () => {
            console.log(`\n✅ USER ${userId} SESSION IS READY!`);
            console.log(`   WhatsApp number: ${phoneNumber}`);
            console.log(`   Can now send invoices`);
            sessionStatus.set(userId, 'ready');
            const sessionData = userSessions.get(userId);
            if (sessionData) {
                sessionData.status = 'ready';
                userSessions.set(userId, sessionData);
            }
        });
        
        // Auth failure
        client.on('auth_failure', (msg) => {
            console.error(`❌ Auth failed for ${userId}:`, msg);
            sessionStatus.set(userId, 'auth_failed');
        });
        
        // Disconnected
        client.on('disconnected', (reason) => {
            console.log(`⚠️ User ${userId} disconnected:`, reason);
            sessionStatus.set(userId, 'disconnected');
            const sessionData = userSessions.get(userId);
            if (sessionData) {
                sessionData.status = 'disconnected';
                userSessions.set(userId, sessionData);
            }
        });
        
        // Initialize the client
        await client.initialize();
        console.log(`   🚀 Client initialization started for ${userId}`);
        
        // Wait a moment for QR to generate
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const qrDataUrl = sessionQRs.get(userId);
        
        if (!qrDataUrl) {
            console.log(`   ⚠️ QR not ready yet, will be available soon`);
        }
        
        res.json({
            success: true,
            userId,
            phoneNumber,
            sessionId,
            status: 'awaiting_scan',
            isReady: false,
            message: 'Session created. Please scan the QR code with WhatsApp.',
            qrCode: qrDataUrl || null,
            qrCodeImageUrl: `/api/session/qr-image/${userId}`,
            statusCheckUrl: `/api/session/status/${userId}`,
            instruction: '1. Open WhatsApp on your phone\n2. Go to Settings → Linked Devices\n3. Tap "Link a Device"\n4. Scan the QR code above'
        });
        
    } catch (error) {
        console.error(`❌ Session creation failed:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Get QR code as base64 (for web display)
router.get('/session/qr/:userId', async (req, res) => {
    const { userId } = req.params;
    
    const qrDataUrl = sessionQRs.get(userId);
    
    if (!qrDataUrl) {
        const session = userSessions.get(userId);
        if (!session) {
            return res.status(404).json({ 
                success: false, 
                error: 'Session not found. Create session first using POST /api/session/create' 
            });
        }
        return res.status(404).json({
            success: false,
            error: 'QR code not available yet. Please wait a few seconds.',
            status: sessionStatus.get(userId)
        });
    }
    
    res.json({
        success: true,
        qrCode: qrDataUrl,
        userId,
        status: sessionStatus.get(userId),
        instruction: 'Scan this QR code with WhatsApp on your phone'
    });
});

// 3. Get QR code as image (for direct download)
router.get('/session/qr-image/:userId', async (req, res) => {
    const { userId } = req.params;
    
    const qrDataUrl = sessionQRs.get(userId);
    
    if (!qrDataUrl) {
        return res.status(404).json({ success: false, error: 'QR code not available' });
    }
    
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="qr-${userId}.png"`);
    res.send(imgBuffer);
});

// 4. Check session status (to know when QR is scanned and session is ready)
router.get('/session/status/:userId', async (req, res) => {
    const { userId } = req.params;
    
    const session = userSessions.get(userId);
    const status = sessionStatus.get(userId);
    
    if (!session) {
        return res.status(404).json({ 
            success: false, 
            error: 'Session not found. Create session first using POST /api/session/create' 
        });
    }
    
    const isReady = status === 'ready';
    
    res.json({
        success: true,
        userId,
        phoneNumber: session.phoneNumber,
        sessionId: session.sessionId,
        status: status || session.status,
        isReady: isReady,
        createdAt: session.createdAt,
        message: isReady ? 'Session is ready! You can now send invoices.' : 'Session pending. Please scan QR code.'
    });
});

// 5. Send invoice using user's session (only works when session is ready)
router.post('/session/send', upload.single('file'), async (req, res) => {
    let tempFilePath = null;
    
    try {
        const { userId, customerNumber, caption } = req.body;
        const file = req.file;
        
        console.log(`\n📤 SENDING INVOICE FROM USER: ${userId}`);
        console.log(`   To: ${customerNumber}`);
        
        if (!userId) {
            if (file?.path) await fs.remove(file.path);
            return res.status(400).json({ success: false, error: 'userId is required' });
        }
        
        if (!customerNumber) {
            if (file?.path) await fs.remove(file.path);
            return res.status(400).json({ success: false, error: 'customerNumber is required' });
        }
        
        if (!file) {
            return res.status(400).json({ success: false, error: 'File is required' });
        }
        
        // Get user session
        const session = userSessions.get(userId);
        const status = sessionStatus.get(userId);
        
        if (!session) {
            await fs.remove(file.path);
            return res.status(404).json({
                success: false,
                error: `No session found for user: ${userId}`,
                tip: 'Create session first: POST /api/session/create'
            });
        }
        
        if (status !== 'ready') {
            await fs.remove(file.path);
            return res.status(400).json({
                success: false,
                error: `Session not ready. Current status: ${status}`,
                tip: 'Please scan QR code first. Check status: GET /api/session/status/' + userId,
                qrCodeUrl: `/api/session/qr/${userId}`
            });
        }
        
        const cleanNumber = customerNumber.toString().replace(/\D/g, '');
        if (cleanNumber.length < 10) {
            await fs.remove(file.path);
            return res.status(400).json({ success: false, error: 'Invalid phone number format' });
        }
        
        tempFilePath = file.path;
        const fileName = file.originalname;
        const chatId = `${cleanNumber}@c.us`;
        const media = MessageMedia.fromFilePath(tempFilePath);
        
        // Send message
        const result = await session.client.sendMessage(chatId, media, {
            caption: caption || `📄 Invoice from ${userId}: ${fileName}`
        });
        
        await fs.remove(tempFilePath);
        
        console.log(`   ✅ Sent! Message ID: ${result.id.id}`);
        
        res.json({
            success: true,
            messageId: result.id.id,
            to: cleanNumber,
            fileName: fileName,
            userId,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`❌ Failed to send:`, error.message);
        if (tempFilePath && await fs.pathExists(tempFilePath)) {
            await fs.remove(tempFilePath);
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. Get all user sessions
router.get('/sessions', async (req, res) => {
    const sessionsList = [];
    
    for (const [userId, session] of userSessions) {
        sessionsList.push({
            userId,
            phoneNumber: session.phoneNumber,
            status: sessionStatus.get(userId) || session.status,
            isReady: sessionStatus.get(userId) === 'ready',
            createdAt: session.createdAt,
            sessionId: session.sessionId
        });
    }
    
    res.json({
        success: true,
        sessions: sessionsList,
        total: sessionsList.length,
        timestamp: new Date().toISOString()
    });
});

// 7. Disconnect/Delete a session
router.delete('/session/:userId', async (req, res) => {
    const { userId } = req.params;
    
    const session = userSessions.get(userId);
    
    if (session && session.client) {
        await session.client.destroy();
        console.log(`🔌 Session destroyed for user: ${userId}`);
    }
    
    userSessions.delete(userId);
    sessionQRs.delete(userId);
    sessionStatus.delete(userId);
    
    // Clean up session directory
    const sessionPath = path.join(USER_SESSIONS_DIR, userId);
    if (fs.existsSync(sessionPath)) {
        await fs.remove(sessionPath);
    }
    
    res.json({
        success: true,
        message: `Session for user ${userId} disconnected and removed`
    });
});

// 8. Poll session status (for frontend to know when ready)
router.get('/session/wait/:userId', async (req, res) => {
    const { userId } = req.params;
    const maxAttempts = 30; // 30 seconds max wait
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        const status = sessionStatus.get(userId);
        
        if (status === 'ready') {
            return res.json({
                success: true,
                userId,
                isReady: true,
                status: 'ready',
                message: 'Session is ready! You can now send invoices.'
            });
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
    }
    
    res.json({
        success: true,
        userId,
        isReady: false,
        status: sessionStatus.get(userId) || 'unknown',
        message: 'Session not ready yet. Please scan QR code.'
    });
});

// ============ LEGACY/MAIN CLIENT ENDPOINTS ============

router.post('/send', upload.single('file'), async (req, res) => {
    let tempFilePath = null;
    
    try {
        const { customerNumber, caption } = req.body;
        const file = req.file;
        
        if (!customerNumber) {
            if (file?.path) await fs.remove(file.path);
            return res.status(400).json({ success: false, error: 'customerNumber is required' });
        }
        
        if (!file) {
            return res.status(400).json({ success: false, error: 'File is required' });
        }
        
        const cleanNumber = customerNumber.toString().replace(/\D/g, '');
        if (cleanNumber.length < 10) {
            await fs.remove(file.path);
            return res.status(400).json({ success: false, error: 'Invalid phone number format' });
        }
        
        if (!isClientReady()) {
            await fs.remove(file.path);
            return res.status(503).json({ 
                success: false, 
                error: 'WhatsApp client not ready',
                tip: 'Main WhatsApp client not connected'
            });
        }
        
        tempFilePath = file.path;
        const fileName = file.originalname;
        const client = getClient();
        const chatId = `${cleanNumber}@c.us`;
        const media = MessageMedia.fromFilePath(tempFilePath);
        
        const result = await client.sendMessage(chatId, media, {
            caption: caption || `📄 Invoice: ${fileName}`
        });
        
        await fs.remove(tempFilePath);
        
        res.json({
            success: true,
            messageId: result.id.id,
            to: cleanNumber,
            fileName: fileName,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`❌ Failed:`, error.message);
        if (tempFilePath && await fs.pathExists(tempFilePath)) {
            await fs.remove(tempFilePath);
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ STATUS ENDPOINTS ============

router.get('/status', async (req, res) => {
    res.json({
        success: true,
        whatsapp_ready: isClientReady(),
        user_sessions: {
            total: userSessions.size,
            ready: Array.from(sessionStatus.values()).filter(s => s === 'ready').length,
            awaiting_scan: Array.from(sessionStatus.values()).filter(s => s === 'awaiting_scan').length,
            sessions: Array.from(userSessions.values()).map(s => ({
                userId: s.userId,
                phoneNumber: s.phoneNumber,
                status: sessionStatus.get(s.userId) || s.status
            }))
        },
        timestamp: new Date().toISOString()
    });
});

router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        service: 'WhatsApp Invoice Server',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        whatsapp_ready: isClientReady(),
        user_sessions: userSessions.size
    });
});

// Load existing sessions on startup
async function loadExistingUserSessions() {
    if (!fs.existsSync(USER_SESSIONS_DIR)) return;
    
    const sessions = fs.readdirSync(USER_SESSIONS_DIR);
    
    for (const session of sessions) {
        const sessionPath = path.join(USER_SESSIONS_DIR, session);
        if (fs.statSync(sessionPath).isDirectory()) {
            console.log(`📱 Loading existing user session: ${session}`);
            
            try {
                const client = new Client({
                    authStrategy: new LocalAuth({ dataPath: sessionPath }),
                    puppeteer: { headless: false, args: ['--no-sandbox'] }
                });
                
                userSessions.set(session, {
                    client,
                    phoneNumber: session,
                    status: 'loading',
                    createdAt: new Date().toISOString(),
                    userId: session,
                    sessionId: `session_${session}`
                });
                
                sessionStatus.set(session, 'loading');
                
                client.on('ready', () => {
                    console.log(`✅ Loaded existing session for: ${session}`);
                    sessionStatus.set(session, 'ready');
                    const data = userSessions.get(session);
                    if (data) data.status = 'ready';
                });
                
                client.on('disconnected', () => sessionStatus.set(session, 'disconnected'));
                
                await client.initialize();
            } catch (error) {
                console.error(`Failed to load session ${session}:`, error.message);
            }
        }
    }
}

loadExistingUserSessions();

module.exports = router;