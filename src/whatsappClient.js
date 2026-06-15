// const { Client, LocalAuth } = require('whatsapp-web.js');
// const qrcode = require('qrcode-terminal');
// const logger = require('./utils/logger');
// const config = require('./config');

// let client;
// let isReady = false;

// const initClient = async () => {
//   console.log('\n🔄 Starting WhatsApp client...\n');
  
//   try {
//     // Official recommended configuration
//     client = new Client({
//       authStrategy: new LocalAuth({
//         dataPath: config.whatsapp.sessionPath,
//       }),
//       puppeteer: {
//         headless: config.whatsapp.headless, // Set to true for production
//         args: [
//           '--no-sandbox',
//           '--disable-setuid-sandbox',
//           '--disable-dev-shm-usage',
//           '--disable-accelerated-2d-canvas',
//           '--disable-gpu',
//           '--window-size=800,600', // Smaller window for better performance

//                     '--disable-background-timer-throttling',
//           '--disable-backgrounding-occluded-windows',
//           '--disable-renderer-backgrounding',
//           '--disable-infobars',

//         ],
//         // Increase timeout for slow connections
//         timeout: 60000,
//       },
//       // Official web version cache configuration
//       webVersionCache: {
//         type: 'remote',
//         remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
//       },
//       // Additional options from official docs
//       qrMaxRetries: 3,
//       takeoverOnConflict: true,
//       takeoverTimeoutMs: 60000,
//     });

//     // QR Code event - Official way to handle QR
//     client.on('qr', (qr) => {
//       console.log('\n' + '='.repeat(60));
//       console.log('📱 SCAN THIS QR CODE WITH YOUR WHATSAPP');
//       console.log('='.repeat(60));
//       // Generate QR in terminal (official method)
//       qrcode.generate(qr, { small: true });
//       console.log('='.repeat(60));
//       console.log('\n📍 Steps:');
//       console.log('1. Open WhatsApp on your phone');
//       console.log('2. Tap Menu (3 dots) → Linked Devices');
//       console.log('3. Tap "Link a Device"');
//       console.log('4. Scan the QR code above\n');
      
//       // Also emit event for API routes
//       client.emit('qr_generated', qr);
//     });

//     // Authentication successful
//     client.on('authenticated', () => {
//       console.log('✅ Authenticated! Session saved.');
//       isReady = false; // Not ready until 'ready' event
//     });

//     // Session is ready
//     client.on('ready', () => {
//       isReady = true;
//       console.log('\n' + '='.repeat(60));
//       console.log('✅ WHATSAPP CLIENT IS READY!');
//       console.log('='.repeat(60));
//       console.log('📱 You can now send invoices\n');
//     });

//     // Auth failure
//     client.on('auth_failure', (msg) => {
//       console.error('❌ Auth failed:', msg);
//       isReady = false;
//     });

//     // Disconnected
//     client.on('disconnected', (reason) => {
//       console.log('⚠️ Disconnected:', reason);
//       isReady = false;
      
//       // Auto-reconnect logic from official docs
//       if (reason === 'NAVIGATION') {
//         console.log('🔄 Reconnecting...');
//         client.initialize();
//       }
//     });

//     // Error handling
//     client.on('error', (err) => {
//       console.error('❌ Client error:', err.message);
//       isReady = false;
//     });

//     // Initialize the client
//     await client.initialize();
//     console.log('✅ Client initialized successfully');
    
//   } catch (error) {
//     console.error('❌ Failed to initialize client:', error.message);
//     throw error;
//   }
  
//   return client;
// };

// const getClient = () => {
//   if (!client) throw new Error('Client not initialized');
//   return client;
// };

// const isClientReady = () => isReady;

// module.exports = { initClient, getClient, isClientReady };

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const config = require('./config');

let client;
let isReady = false;

const initClient = async () => {
  console.log('\n🔄 Starting WhatsApp client...\n');
  console.log(`   Headless mode: ${config.whatsapp.headless ? 'ON (Fully Background)' : 'OFF (Visible)'}`);
  
  try {
    // Prepare Puppeteer arguments for true headless mode
    const puppeteerArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=800,600',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-infobars',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-sync',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-translate',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
    ];
    
    // Add headless specific arguments
    if (config.whatsapp.headless) {
      puppeteerArgs.push('--headless=new'); // Use new headless mode
      puppeteerArgs.push('--hide-scrollbars');
      puppeteerArgs.push('--mute-audio');
      puppeteerArgs.push('--no-sandbox');
    }
    
    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: config.whatsapp.sessionPath,
      }),
      puppeteer: {
        headless: config.whatsapp.headless,
        args: puppeteerArgs,
        defaultViewport: null,
        timeout: 60000,
        // Important: These settings help with headless
        ignoreHTTPSErrors: true,
        dumpio: false,
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
      },
      qrMaxRetries: 3,
      takeoverOnConflict: true,
      takeoverTimeoutMs: 60000,
    });

    // QR Code event
    client.on('qr', (qr) => {
      console.log('\n' + '='.repeat(60));
      console.log('📱 SCAN THIS QR CODE WITH YOUR WHATSAPP');
      console.log('='.repeat(60));
      
      // Only show QR in terminal if headless is false
      if (!config.whatsapp.headless) {
        qrcode.generate(qr, { small: true });
      } else {
        console.log('   HEADLESS MODE ACTIVE');
        console.log('   Get QR code from: http://localhost:3000/qr');
        console.log('   Or check file: qr-code.html');
        
        // Save QR to file for headless mode
        const fs = require('fs');
        const htmlContent = `<!DOCTYPE html>
        <html>
        <head><title>WhatsApp QR Code</title></head>
        <body style="text-align:center;font-family:Arial;padding:20px;">
            <h1>📱 Scan to Connect WhatsApp</h1>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}" />
            <p>1. Open WhatsApp on your phone</p>
            <p>2. Go to Settings → Linked Devices</p>
            <p>3. Tap "Link a Device"</p>
            <p>4. Scan this QR code</p>
        </body>
        </html>`;
        fs.writeFileSync('qr-code.html', htmlContent);
        console.log('   💾 QR also saved to: qr-code.html');
      }
      
      console.log('='.repeat(60));
      console.log('\n📍 Steps:');
      console.log('1. Open WhatsApp on your phone');
      console.log('2. Go to Settings → Linked Devices');
      console.log('3. Tap "Link a Device"');
      console.log('4. Scan the QR code\n');
      
      client.emit('qr_generated', qr);
    });

    // Authentication successful
    client.on('authenticated', () => {
      console.log('✅ Authenticated! Session saved.');
      isReady = false;
    });

    // Session is ready
    client.on('ready', () => {
      isReady = true;
      console.log('\n' + '='.repeat(60));
      console.log('✅ WHATSAPP CLIENT IS READY!');
      console.log('='.repeat(60));
      console.log(`📱 Running in ${config.whatsapp.headless ? 'HEADLESS (Background - No Window)' : 'VISIBLE'} mode`);
      console.log('📱 You can now send invoices\n');
    });

    // Auth failure
    client.on('auth_failure', (msg) => {
      console.error('❌ Auth failed:', msg);
      isReady = false;
    });

    // Disconnected
    client.on('disconnected', (reason) => {
      console.log('⚠️ Disconnected:', reason);
      isReady = false;
      
      if (reason === 'NAVIGATION') {
        console.log('🔄 Reconnecting in 5 seconds...');
        setTimeout(() => {
          client.initialize();
        }, 5000);
      }
    });

    // Error handling
    client.on('error', (err) => {
      console.error('❌ Client error:', err.message);
      if (!err.message.includes('detached Frame')) {
        isReady = false;
      }
    });

    await client.initialize();
    console.log('✅ Client initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize client:', error.message);
    throw error;
  }
  
  return client;
};

const getClient = () => {
  if (!client) throw new Error('Client not initialized');
  return client;
};

const isClientReady = () => isReady;

module.exports = { initClient, getClient, isClientReady };