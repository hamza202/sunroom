const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
require('dotenv').config();

// Configuration from environment variables
const PROXY_SERVER = process.env.PROXY_SERVER || 'as.2a5c7a83de539ea5.abcproxy.vip:4950';
const PROXY_USERNAME = process.env.PROXY_USERNAME || 'Bwrka67HY5-zone-star-region-gb';
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || '72237663';
const API_URL = process.env.API_URL || 'https://rpc.sunroom.so/twirp/sunroom.api.Api/CreatePhoneVerification';
const REQUEST_DELAY = parseInt(process.env.REQUEST_DELAY || '1000', 10);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);
const PROGRESS_FILE = process.env.PROGRESS_FILE || 'progress.json';

// Create proxy agent with authentication
const proxyUrl = `http://${PROXY_USERNAME}:${PROXY_PASSWORD}@${PROXY_SERVER}`;
const proxyAgent = new HttpsProxyAgent(proxyUrl);

// Statistics tracking
const stats = {
  total: 0,
  processed: 0,
  successful: 0,
  failed: 0,
  startTime: null,
  lastProcessedIndex: -1
};

// Read phone numbers from file
async function readPhoneNumbers() {
  try {
    const filePath = path.join(__dirname, 'numbers.txt');
    const data = fs.readFileSync(filePath, 'utf8');
    // Split by newline and filter out empty lines, then clean each number
    const numbers = data.split('\n')
      .filter(number => number.trim() !== '')
      .map(number => number.trim().replace(/[\r\n]/g, '')); // Remove any \r or \n characters
    stats.total = numbers.length;
    return numbers;
  } catch (error) {
    console.error('Error reading phone numbers file:', error);
    return [];
  }
}

// Load progress from file if exists
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      const progress = JSON.parse(data);
      stats.lastProcessedIndex = progress.lastProcessedIndex || -1;
      stats.processed = progress.processed || 0;
      stats.successful = progress.successful || 0;
      stats.failed = progress.failed || 0;
      console.log(`Loaded progress: Processed ${stats.processed}/${stats.total} numbers`);
      return true;
    }
  } catch (error) {
    console.error('Error loading progress:', error);
  }
  return false;
}

// Save progress to file
function saveProgress() {
  try {
    const progress = {
      lastProcessedIndex: stats.lastProcessedIndex,
      processed: stats.processed,
      successful: stats.successful,
      failed: stats.failed,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

// Send POST request to API with retry mechanism
async function sendRequest(phoneNumber, retryCount = 0) {
  // Add + sign before the phone number
  const formattedPhoneNumber = `+${phoneNumber}`;
  
  try {
    console.log(`Sending request for phone number: ${formattedPhoneNumber}`);
    
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
        httpsAgent: proxyAgent,
        timeout: 30000 // 30 seconds timeout
      }
    );
    
    console.log(`Response for ${formattedPhoneNumber}: Status ${response.status}`);
    // Print response data
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    stats.successful++;
    return response.data;
  } catch (error) {
    console.error(`Error sending request for ${formattedPhoneNumber}:`, error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      console.log(`Retrying ${formattedPhoneNumber} in ${retryDelay}ms (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return sendRequest(phoneNumber, retryCount + 1);
    } else {
      console.error(`Max retries reached for ${formattedPhoneNumber}`);
      stats.failed++;
      return null;
    }
  }
}

// Display progress and statistics
function displayStats() {
  const elapsedTime = (new Date() - stats.startTime) / 1000; // in seconds
  const remainingNumbers = stats.total - stats.processed;
  const averageTimePerNumber = stats.processed > 0 ? elapsedTime / stats.processed : 0;
  const estimatedTimeRemaining = remainingNumbers * averageTimePerNumber;
  
  const hours = Math.floor(estimatedTimeRemaining / 3600);
  const minutes = Math.floor((estimatedTimeRemaining % 3600) / 60);
  const seconds = Math.floor(estimatedTimeRemaining % 60);
  
  console.log('\n--- Progress Statistics ---');
  console.log(`Processed: ${stats.processed}/${stats.total} (${Math.round(stats.processed/stats.total*100)}%)`);
  console.log(`Successful: ${stats.successful}, Failed: ${stats.failed}`);
  console.log(`Elapsed time: ${Math.round(elapsedTime)} seconds`);
  console.log(`Estimated time remaining: ${hours}h ${minutes}m ${seconds}s`);
  console.log('---------------------------\n');
}

// Process phone numbers with delay between requests
async function processPhoneNumbers() {
  const phoneNumbers = await readPhoneNumbers();
  if (phoneNumbers.length === 0) {
    console.error('No phone numbers found. Exiting.');
    return;
  }
  
  console.log(`Found ${phoneNumbers.length} phone numbers to process`);
  
  // Load progress if available
  const hasProgress = loadProgress();
  const startIndex = hasProgress ? stats.lastProcessedIndex + 1 : 0;
  
  stats.startTime = new Date();
  
  // Setup interval for displaying stats
  const statsInterval = setInterval(() => {
    displayStats();
    saveProgress(); // Save progress periodically
  }, 10000); // Every 10 seconds
  
  // Process each phone number
  for (let i = startIndex; i < phoneNumbers.length; i++) {
    const phoneNumber = phoneNumbers[i];
    console.log(`Processing ${i+1}/${phoneNumbers.length}: ${phoneNumber}`);
    
    try {
      await sendRequest(phoneNumber);
      stats.processed++;
      stats.lastProcessedIndex = i;
      
      // Save progress after each successful processing
      if (i % 5 === 0) { // Save every 5 numbers
        saveProgress();
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
    } catch (error) {
      console.error(`Failed to process ${phoneNumber}:`, error);
      stats.failed++;
    }
  }
  
  // Final stats and cleanup
  clearInterval(statsInterval);
  displayStats();
  saveProgress();
  console.log('All phone numbers processed');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nProcess interrupted. Saving progress...');
  displayStats();
  saveProgress();
  process.exit(0);
});

// Start processing
processPhoneNumbers().catch(error => {
  console.error('Error in main process:', error);
  saveProgress();
}); 