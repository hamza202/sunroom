const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
require('dotenv').config();

// Proxy configuration from environment variables
const PROXY_SERVER = process.env.PROXY_SERVER || 'proxy.geonode.io:9000';
const PROXY_USERNAME = process.env.PROXY_USERNAME || 'geonode_ZmFHDeiROw-type-residential-country-gb';
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || 'aecd1a20-faab-469f-8af0-6b6f4d8e129c';
const API_URL = process.env.API_URL || 'https://rpc.sunroom.so/twirp/sunroom.api.Api/CreatePhoneVerification';
const REQUEST_DELAY = parseInt(process.env.REQUEST_DELAY || '1000', 10);

// Read proxies from file
async function readProxies() {
  try {
    const filePath = path.join(__dirname, 'proxyscrape_premium_http_proxies.txt');
    const data = fs.readFileSync(filePath, 'utf8');
    // Split by newline and filter out empty lines
    return data.split('\n')
      .filter(proxy => proxy.trim() !== '')
      .map(proxy => proxy.trim());
  } catch (error) {
    console.error('Error reading proxies file:', error);
    return [];
  }
}

// Create proxy agent with proxy from file or use default
async function createProxyAgent() {
  const proxies = await readProxies();
  
  // If proxies are available, use a random one from the file
  if (proxies.length > 0) {
    const randomIndex = Math.floor(Math.random() * proxies.length);
    const randomProxy = proxies[randomIndex];
    console.log(`Using random proxy: ${randomProxy}`);
    return new HttpsProxyAgent(`http://${randomProxy}`);
  }
  
  // Fallback to default proxy with authentication if no proxies in file
  console.log('No proxies found in file, using default proxy');
  const proxyUrl = `http://${PROXY_USERNAME}:${PROXY_PASSWORD}@${PROXY_SERVER}`;
  return new HttpsProxyAgent(proxyUrl);
}

// Read phone numbers from file
async function readPhoneNumbers() {
  try {
    const filePath = path.join(__dirname, 'numbers.txt');
    const data = fs.readFileSync(filePath, 'utf8');
    // Split by newline and filter out empty lines, then clean each number
    return data.split('\n')
      .filter(number => number.trim() !== '')
      .map(number => number.trim().replace(/[\r\n]/g, '')); // Remove any \r or \n characters
  } catch (error) {
    console.error('Error reading phone numbers file:', error);
    return [];
  }
}

// Send POST request to API
async function sendRequest(phoneNumber) {
  // Add + sign before the phone number
  const formattedPhoneNumber = `+${phoneNumber}`;
  
  try {
    console.log(`Sending request for phone number: ${formattedPhoneNumber}`);
    
    // Get a proxy agent
    const proxyAgent = await createProxyAgent();
    
    // Create the payload as JSON object with the phone number as the value
    const payload = {
      "phone": formattedPhoneNumber
    };
    
    // Print the payload to console
    console.log('Request payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(API_URL, 
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        httpsAgent: proxyAgent
      }
    );
    
    console.log(`Response for ${formattedPhoneNumber}:`, response.status);
    // Print response data
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error(`Error sending request for ${formattedPhoneNumber}:`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Process phone numbers with delay between requests
async function processPhoneNumbers() {
  const phoneNumbers = await readPhoneNumbers();
  console.log(`Found ${phoneNumbers.length} phone numbers to process`);
  
  for (let i = 0; i < phoneNumbers.length; i++) {
    const phoneNumber = phoneNumbers[i];
    console.log(`Processing ${i+1}/${phoneNumbers.length}: ${phoneNumber}`);
    
    try {
      await sendRequest(phoneNumber);
      
      // Add delay between requests from environment variable
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
    } catch (error) {
      console.error(`Failed to process ${phoneNumber}:`, error);
    }
  }
  
  console.log('All phone numbers processed');
}

// Start processing
processPhoneNumbers().catch(error => {
  console.error('Error in main process:', error);
}); 