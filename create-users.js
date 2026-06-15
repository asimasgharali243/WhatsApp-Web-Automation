// create-users.js
const axios = require('axios');

const API_KEY = '47f8d9e2-3a6c-4b8e-9d1f-5c7a2e8b4f6d';
const BASE_URL = 'http://localhost:3000';

async function createUserSession(userId, phoneNumber) {
  try {
    const response = await axios.post(`${BASE_URL}/api/user/session/init`, {
      userId: userId,
      phoneNumber: phoneNumber
    }, {
      headers: { 'x-api-key': API_KEY }
    });
    
    console.log(`✅ Created session for ${userId}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed for ${userId}:`, error.response?.data || error.message);
  }
}

async function checkUserStatus(userId) {
  try {
    const response = await axios.get(`${BASE_URL}/api/user/session/status/${userId}`, {
      headers: { 'x-api-key': API_KEY }
    });
    
    console.log(`📊 ${userId}: ${response.data.status} - Ready: ${response.data.isReady}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to get status for ${userId}`);
  }
}

async function sendAsUser(userId, customerNumber, filePath) {
  const FormData = require('form-data');
  const fs = require('fs');
  
  const form = new FormData();
  form.append('userId', userId);
  form.append('customerNumber', customerNumber);
  form.append('caption', `Invoice from ${userId}`);
  form.append('file', fs.createReadStream(filePath));
  
  try {
    const response = await axios.post(`${BASE_URL}/api/user/send`, form, {
      headers: {
        'x-api-key': API_KEY,
        ...form.getHeaders()
      }
    });
    
    console.log(`✅ Sent from ${userId}: Job ${response.data.jobId}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to send from ${userId}:`, error.response?.data || error.message);
  }
}

// Example: Create multiple business users
async function setupMultiTenant() {
  console.log('🏢 Setting up multi-tenant WhatsApp system\n');
  
  // Create sessions for different businesses
  await createUserSession('business_acme', '923401669334');
  await createUserSession('business_techcorp', '923006468177');
  
  console.log('\n📱 QR codes generated. Scan each with respective WhatsApp accounts.\n');
  
  // Wait for QR scanning
  console.log('Waiting 30 seconds for scanning...\n');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  // Check status
  await checkUserStatus('business_acme');
  await checkUserStatus('business_techcorp');

  
  // Send invoice from business_acme to a customer
  await sendAsUser('business_acme', '923001234567', 'C:\\Users\\AsimAli\\Downloads\\HUjvHJ.pdf');
}

setupMultiTenant();