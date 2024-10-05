// functions/webhook-handler.js

const axios = require('axios');
const { getCountryName } = require('../countryTranslator'); // Adjust the path if necessary

// Monday.com API token
const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;

// Board ID mapping based on app ID
const boardIdMapping = {
  '10142077': '7517528529', // Board ID for App 10142077 (Status Label Descriptions)
  '10126111': '7517444546', // Board ID for App 10126111 (Update Templates)
  '10147286': '7517579690',  // Board ID for App 10147286 (Facebook Embedded)
  '10172591': '7540627206', // Board ID for App 10172591 (Ultimate Team Productivity Tool)
};

// Column IDs (Same across all boards)
const columnMap = {
  email: 'email__1',
  firstName: 'text8__1',
  lastName: 'text9__1',
  timestamp: 'date4',
  slug: 'text__1',
  companyName: 'text1__1',
  appId: 'text3__1',
  cluster: 'text0__1',
  status: 'status74__1', // Reverted back to the original status column for status updates
  maxUsers: 'account_max_users__1',
  accountId: 'text2__1',
  planId: 'text21__1',
  country: 'country__1',
  accountTier: 'status__1', // Separate status column specifically for account tier
};

// [Other functions remain the same]

// Function to get item ID by account ID
const getItemIdByAccountId = async (accountId, boardId) => {
  // Construct a valid GraphQL query using items_page to get items from the board with the account ID column value
  const query = `
    query {
      boards(ids: ${boardId}) {
        items_page(limit: 500) {
          items {
            id
            name
            column_values(ids: "${columnMap.accountId}") {
              text
            }
          }
        }
      }
    }
  `;

  console.log('GraphQL query for getItemIdByAccountId:\n', query); // Log the query for troubleshooting
  console.log(`Fetching item ID for account ID: ${accountId} on board ID: ${boardId}`);

  try {
    const response = await axios.post('https://api.monday.com/v2', { query }, {
      headers: {
        Authorization: MONDAY_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    console.log('Response from Monday.com for getItemIdByAccountId:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.data && response.data.data.boards.length > 0) {
      const items = response.data.data.boards[0].items_page.items;

      console.log('Items on board:', JSON.stringify(items, null, 2)); // Log all items for debugging

      // Find item where the column with id "accountId" matches the given accountId
      const item = items.find(item => item.column_values.some(column => column.text === accountId.toString()));

      if (item) {
        console.log(`Found item with ID: ${item.id} for account ID: ${accountId}`);
        return item.id; // Return the ID of the matching item
      } else {
        console.error(`No items found with account ID: ${accountId} on board: ${boardId}`);
        return null;
      }
    } else {
      console.error('Invalid response structure:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Error finding item by account ID:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// [Rest of your code remains unchanged]

