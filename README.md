# Sunroom API Request Sender

A Node.js application that sends POST requests to the Sunroom API using phone numbers from a text file and routing requests through a proxy.

## Features

- Reads phone numbers from a text file (`numbers.txt`)
- Sends POST requests to the Sunroom API endpoint
- Uses proxy for all requests
- Configurable delay between requests
- Error handling and logging
- Parallel request processing (in parallel.js)

## Prerequisites

- Node.js (v12 or higher)
- npm (Node Package Manager)

## Installation

1. Clone this repository or download the files
2. Install dependencies:

```bash
npm install
```

## Configuration

The application uses environment variables for configuration. You can modify these in the `.env` file:

- `PROXY_SERVER`: The proxy server address and port
- `PROXY_USERNAME`: Username for proxy authentication
- `PROXY_PASSWORD`: Password for proxy authentication
- `API_URL`: The Sunroom API endpoint
- `REQUEST_DELAY`: Delay between requests in milliseconds

## Usage

1. Make sure your phone numbers are in the `numbers.txt` file (one number per line)
2. Run the application:

```bash
# Run the basic version
npm start

# Or run the advanced version with additional features
npm run advanced

# Or run the parallel version for concurrent requests
npm run parallel
```

## Advanced Features

The advanced version (`advanced.js`) includes additional features:

- **Retry Mechanism**: Automatically retries failed requests with exponential backoff
- **Progress Tracking**: Saves progress to a JSON file to resume from where it left off if interrupted
- **Statistics**: Displays detailed statistics including estimated time remaining
- **Graceful Shutdown**: Handles interruptions by saving progress before exiting

To configure the advanced features, you can modify these additional environment variables in the `.env` file:

- `MAX_RETRIES`: Maximum number of retry attempts for failed requests
- `PROGRESS_FILE`: File path to save progress information

## Parallel Processing

The parallel version (`parallel.js`) includes all the advanced features plus:

- **Concurrent Requests**: Sends multiple requests in parallel to improve throughput
- **Batch Processing**: Processes phone numbers in batches with configurable concurrency
- **Thread Identification**: Logs include thread ID for easier debugging
- **Optimized Time Estimation**: Estimates remaining time based on concurrency level

To configure the parallel processing, you can modify this additional environment variable in the `.env` file:

- `CONCURRENCY`: Number of parallel requests to send simultaneously (default: 5)

## Customizing the Request Payload

To customize the data sent in the POST request, modify the `sendRequest` function in `index.js`. Update the request body object to match the API requirements.

## Error Handling

The application includes error handling for:
- File reading errors
- Network request failures
- API response errors

All errors are logged to the console.

## License

ISC 