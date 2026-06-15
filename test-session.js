const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_KEY = '47f8d9e2-3a6c-4b8e-9d1f-5c7a2e8b4f6d';
const BASE_URL = 'http://127.0.0.1:3000';

// ============ CONFIGURATION ============
// Use the SAME user ID that was created and ready
const USER_ID = 'test_user_1781186806130';  // Replace with your actual ready user ID
const CUSTOMER_NUMBER = '923006468177';      // Customer's WhatsApp number
const PDF_FILE_PATH = 'C:\\Users\\AsimAli\\Downloads\\HUjvHJ.pdf';  // Your PDF file path
const CAPTION = '📑 Here is your invoice. Thank you for your business!';
// ======================================

async function sendPDFInvoice() {
    console.log('\n' + '='.repeat(60));
    console.log('📄 SENDING PDF INVOICE');
    console.log('='.repeat(60));
    
    // Check if PDF file exists
    if (!fs.existsSync(PDF_FILE_PATH)) {
        console.error(`\n❌ PDF file not found: ${PDF_FILE_PATH}`);
        console.log('\n💡 Please:');
        console.log('   1. Update PDF_FILE_PATH in the script');
        console.log('   2. Make sure the PDF file exists');
        return;
    }
    
    const fileName = path.basename(PDF_FILE_PATH);
    const fileSize = (fs.statSync(PDF_FILE_PATH).size / 1024 / 1024).toFixed(2);
    
    console.log(`\n📁 PDF File: ${fileName}`);
    console.log(`📏 Size: ${fileSize} MB`);
    console.log(`📞 To: ${CUSTOMER_NUMBER}`);
    console.log(`👤 Using User: ${USER_ID}`);
    console.log(`💬 Caption: ${CAPTION}`);
    
    // First, check if the user session is ready
    console.log('\n📊 Checking session status...');
    try {
        const statusRes = await axios.get(`${BASE_URL}/api/session/status/${USER_ID}`, {
            headers: { 'x-api-key': API_KEY }
        });
        
        if (!statusRes.data.isReady) {
            console.log(`❌ Session not ready. Status: ${statusRes.data.status}`);
            console.log('Please scan QR code first using test-session.js');
            return;
        }
        
        console.log('✅ Session is ready!');
        
    } catch (err) {
        console.error(`❌ Failed to check status: ${err.message}`);
        return;
    }
    
    // Send the PDF
    console.log('\n📤 Sending PDF invoice...');
    
    const form = new FormData();
    form.append('userId', USER_ID);
    form.append('customerNumber', CUSTOMER_NUMBER);
    form.append('caption', CAPTION);
    form.append('file', fs.createReadStream(PDF_FILE_PATH));
    
    try {
        const sendRes = await axios.post(`${BASE_URL}/api/session/send`, form, {
            headers: {
                'x-api-key': API_KEY,
                ...form.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 120000  // 2 minutes for large files
        });
        
        console.log('\n✅ PDF SENT SUCCESSFULLY!');
        console.log(`   📨 Message ID: ${sendRes.data.messageId}`);
        console.log(`   📞 To: ${sendRes.data.to}`);
        console.log(`   📄 File: ${sendRes.data.fileName}`);
        console.log(`   🕐 Time: ${sendRes.data.timestamp}`);
        console.log('\n💬 Check your WhatsApp! The PDF should be delivered.');
        
    } catch (error) {
        console.error('\n❌ Failed to send PDF:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Error: ${error.response.data?.error}`);
            if (error.response.data?.tip) {
                console.log(`   💡 Tip: ${error.response.data.tip}`);
            }
        } else {
            console.error(`   ${error.message}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
}

// Run the function
sendPDFInvoice();