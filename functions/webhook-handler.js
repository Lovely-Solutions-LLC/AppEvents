// functions/webhook-handler.js

const axios = require('axios');
const { getCountryName } = require('../countryTranslator'); // Adjust the path accordingly

// Board ID mapping based on app ID
const boardIdMapping = {
  '10142077': '7517528529', // Status Label Descriptions
  '10126111': '7517444546', // Update Templates
  '10147286': '7517579690', // Facebook Embedded
  '10172591': '7540627206',
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
  status: 'status74__1',
  maxUsers: 'account_max_users__1',
  accountId: 'text2__1',
  planId: 'text21__1',
  country: 'country__1',
  accountTier: 'status__1',
};

// Function to split full name into first and last name
const splitName = (fullName) => {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: '', lastName: '' };
  }
  const names = fullName.trim().split(' ');
  const firstName = names.slice(0, -1).join(' ') || '';
  const lastName = names.slice(-1).join(' ') || '';
  return { firstName, lastName };
};

// Function to create a new item in Monday.com
const createMondayItem = async (itemName, columnValues, boardId, MONDAY_API_TOKEN) => {
  // ... [rest of your code for createMondayItem]
};

// Function to get item ID by account ID
const getItemIdByAccountId = async (accountId, boardId, MONDAY_API_TOKEN) => {
  // ... [rest of your code for getItemIdByAccountId]
};

// Function to update multiple column values for an existing item in Monday.com
const updateMondayItem = async (itemId, columnValues, boardId, MONDAY_API_TOKEN) => {
  // ... [rest of your code for updateMondayItem]
};

exports.handler = async (event, context) => {
  // Enable CORS if necessary
  const headers = {
    'Access-Control-Allow-Origin': '*', // Adjust the origin as needed
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    // Handle CORS preflight request
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Monday.com API token
  const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;

  if (!MONDAY_API_TOKEN) {
    console.error('MONDAY_API_TOKEN is not set in environment variables.');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server configuration error.' }),
    };
  }

  // Parse the webhook payload
  let data;
  try {
    data = JSON.parse(event.body);
  } catch (error) {
    console.error('Error parsing request body:', error);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request body' }),
    };
  }

  console.log('Webhook received:', JSON.stringify(data, null, 2)); // Log entire webhook payload for visibility

  const notificationType = data.type;
  const payload = data.data;

  if (!payload || !payload.user_name || !payload.app_id) {
    console.error('Invalid payload data:', JSON.stringify(payload, null, 2));
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid payload data' }),
    };
  }

  const { firstName, lastName } = splitName(payload.user_name);
  const boardId = boardIdMapping[payload.app_id];

  if (!boardId) {
    console.error('No board mapping found for app:', payload.app_id);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'No board mapping found for app.' }),
    };
  }

  // Build the column values dynamically using the column mapping
  const accountTier = payload.account_tier || 'free'; // Set default value to 'free' if account_tier is null or undefined
  const columnValues = {
    [columnMap.email]: { email: payload.user_email, text: payload.user_email },
    [columnMap.firstName]: firstName,
    [columnMap.lastName]: lastName,
    [columnMap.timestamp]: { date: payload.timestamp ? payload.timestamp.split('T')[0] : '' },
    [columnMap.slug]: payload.account_slug || '',
    [columnMap.companyName]: payload.account_name || '',
    [columnMap.appId]: payload.app_id.toString(),
    [columnMap.cluster]: payload.user_cluster || '',
    [columnMap.maxUsers]: payload.account_max_users ? payload.account_max_users.toString() : '',
    [columnMap.accountId]: payload.account_id ? payload.account_id.toString() : '',
    [columnMap.planId]: payload.plan_id ? payload.plan_id.toString() : '',
    [columnMap.country]: {
      countryCode: payload.user_country || '',
      countryName: getCountryName(payload.user_country) || '',
    },
    [columnMap.accountTier]: { label: accountTier }, // Use default or valid value
  };

  console.log('Column values for Monday item operation:', JSON.stringify(columnValues, null, 2)); // Log all column values

  try {
    switch (notificationType) {
      case 'install':
        console.log('Handling "install" event.');
        await createMondayItem(
          payload.account_name || 'Unnamed Account',
          columnValues,
          boardId,
          MONDAY_API_TOKEN
        );
        break;
      // ... [rest of your switch cases]
      default:
        console.log('Ignoring unhandled event type:', notificationType);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Event type ignored.' }),
        };
    }
  } catch (error) {
    console.error('Error handling webhook event:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error handling webhook event.' }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: 'Webhook processed successfully.' }),
  };
};
