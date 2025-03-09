const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
require('dotenv').config();

// Configuration from environment variables
const PROXY_SERVER = process.env.PROXY_SERVER || 'as.2a5c7a83de539ea5.abcproxy.vip:4950';
const PROXY_USERNAME = process.env.PROXY_USERNAME || 'Bwrka67HY5-zone-star-region-us';
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || '72237663';
const API_URL = process.env.API_URL || 'https://rpc.sunroom.so/twirp/sunroom.api.Api/CreatePhoneVerification';
const REQUEST_DELAY = parseInt(process.env.REQUEST_DELAY || '1000', 10);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);
const PROGRESS_FILE = process.env.PROGRESS_FILE || 'progress.json';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '5', 10); // Number of parallel requests

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
  lastProcessedIndices: []
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
      stats.lastProcessedIndices = progress.lastProcessedIndices || [];
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
      lastProcessedIndices: stats.lastProcessedIndices,
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
async function sendRequest(phoneNumber, index, retryCount = 0) {
  // Add + sign before the phone number
  const formattedPhoneNumber = `+${phoneNumber}`;
  
  try {
    console.log(`[Thread ${index % CONCURRENCY + 1}] Sending request for phone number: ${formattedPhoneNumber}`);
    
    // Create the payload as JSON object with the phone number as the value
    const payload = {
      "phone": formattedPhoneNumber
    };
    
    // Print the payload to console
    console.log(`[Thread ${index % CONCURRENCY + 1}] Request payload:`, JSON.stringify(payload, null, 2));
    
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
    
    console.log(`[Thread ${index % CONCURRENCY + 1}] Response for ${formattedPhoneNumber}: Status ${response.status}`);
    // Print response data
    console.log(`[Thread ${index % CONCURRENCY + 1}] Response data:`, JSON.stringify(response.data, null, 2));
    
    stats.successful++;
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`[Thread ${index % CONCURRENCY + 1}] Error sending request for ${formattedPhoneNumber}:`, error.message);
    
    if (error.response) {
      console.error(`[Thread ${index % CONCURRENCY + 1}] Response status:`, error.response.status);
      console.error(`[Thread ${index % CONCURRENCY + 1}] Response data:`, error.response.data);
    }
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      console.log(`[Thread ${index % CONCURRENCY + 1}] Retrying ${formattedPhoneNumber} in ${retryDelay}ms (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return sendRequest(phoneNumber, index, retryCount + 1);
    } else {
      console.error(`[Thread ${index % CONCURRENCY + 1}] Max retries reached for ${formattedPhoneNumber}`);
      stats.failed++;
      return { success: false, error: error.message };
    }
  }
}

// Display progress and statistics
function displayStats() {
  const elapsedTime = (new Date() - stats.startTime) / 1000; // in seconds
  const remainingNumbers = stats.total - stats.processed;
  const averageTimePerNumber = stats.processed > 0 ? elapsedTime / stats.processed : 0;
  const estimatedTimeRemaining = remainingNumbers * (averageTimePerNumber / CONCURRENCY);
  
  const hours = Math.floor(estimatedTimeRemaining / 3600);
  const minutes = Math.floor((estimatedTimeRemaining % 3600) / 60);
  const seconds = Math.floor(estimatedTimeRemaining % 60);
  
  console.log('\n--- Progress Statistics ---');
  console.log(`Processed: ${stats.processed}/${stats.total} (${Math.round(stats.processed/stats.total*100)}%)`);
  console.log(`Successful: ${stats.successful}, Failed: ${stats.failed}`);
  console.log(`Concurrency: ${CONCURRENCY} parallel requests`);
  console.log(`Elapsed time: ${Math.round(elapsedTime)} seconds`);
  console.log(`Estimated time remaining: ${hours}h ${minutes}m ${seconds}s`);
  console.log('---------------------------\n');
}

// Process a batch of phone numbers in parallel
async function processBatch(phoneNumbers, startIndex, batchSize) {
  const batch = phoneNumbers.slice(startIndex, startIndex + batchSize);
  const promises = batch.map((phoneNumber, i) => {
    const index = startIndex + i;
    return sendRequest(phoneNumber, index)
      .then(result => {
        stats.processed++;
        if (!stats.lastProcessedIndices.includes(index)) {
          stats.lastProcessedIndices.push(index);
        }
        return { index, result };
      })
      .catch(error => {
        console.error(`Failed to process ${phoneNumber}:`, error);
        stats.failed++;
        return { index, error };
      });
  });
  
  // Wait for all promises to resolve with a small delay between each request
  const results = [];
  for (let i = 0; i < promises.length; i++) {
    if (i > 0) {
      // Add a small delay between starting each request to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY / CONCURRENCY));
    }
    // Start the next request
    results.push(promises[i]);
  }
  
  return Promise.all(results);
}

// Process all phone numbers with parallel requests
async function processPhoneNumbers() {
  const phoneNumbers = await readPhoneNumbers();
  if (phoneNumbers.length === 0) {
    console.error('No phone numbers found. Exiting.');
    return;
  }
  
  console.log(`Found ${phoneNumbers.length} phone numbers to process`);
  console.log(`Using concurrency level: ${CONCURRENCY} parallel requests`);
  
  // Load progress if available
  loadProgress();
  
  // Determine which indices have already been processed
  const processedIndices = new Set(stats.lastProcessedIndices);
  const remainingIndices = [];
  for (let i = 0; i < phoneNumbers.length; i++) {
    if (!processedIndices.has(i)) {
      remainingIndices.push(i);
    }
  }
  
  console.log(`Remaining numbers to process: ${remainingIndices.length}`);
  
  stats.startTime = new Date();
  
  // Setup interval for displaying stats
  const statsInterval = setInterval(() => {
    displayStats();
    saveProgress(); // Save progress periodically
  }, 10000); // Every 10 seconds
  
  // Process in batches of CONCURRENCY
  for (let i = 0; i < remainingIndices.length; i += CONCURRENCY) {
    const batchIndices = remainingIndices.slice(i, i + CONCURRENCY);
    console.log(`Processing batch ${Math.floor(i/CONCURRENCY) + 1}/${Math.ceil(remainingIndices.length/CONCURRENCY)}`);
    
    try {
      await processBatch(phoneNumbers, i, CONCURRENCY);
      
      // Save progress after each batch
      saveProgress();
      
      // Add a delay between batches if specified
      if (REQUEST_DELAY > 0 && i + CONCURRENCY < remainingIndices.length) {
        console.log(`Waiting ${REQUEST_DELAY}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
      }
    } catch (error) {
      console.error(`Error processing batch:`, error);
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