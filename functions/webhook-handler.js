// functions/webhook-handler.js

const axios = require('axios');
const { getCountryName } = require('../countryTranslator'); // Adjust the path if necessary

// Board ID mapping based on app ID
const boardIdMapping = {
  '10142077': '7517528529', // Board ID for App 10142077 (Status Label Descriptions)
  '10126111': '7517444546', // Board ID for App 10126111 (Update Templates)
  '10147286': '7517579690', // Board ID for App 10147286 (Facebook Embedded)
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
  status: 'status74__1', // Status updates
  maxUsers: 'account_max_users__1',
  accountId: 'text2__1',
  planId: 'text21__1',
  country: 'country__1',
  accountTier: 'status__1', // Account tier
};

// Function to split full name into first and last name
const splitName = (fullName) => {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: '', lastName: '' };
  }
  const names = fullName.trim().split(' ');
  const firstName = names.slice(0, -1).join(' ') || names[0] || '';
  const lastName = names.slice(-1).join(' ') || '';
  return { firstName, lastName };
};

// Function to create a new item in Monday.com
const createMondayItem = async (itemName, columnValues, boardId) => {
  // Ensure valid status labels for the account tier
  const validStatusLabels = ['pro', 'standard', 'enterprise', 'free', 'basic'];
  if (!validStatusLabels.includes(columnValues[columnMap.accountTier]?.label)) {
    console.warn(
      `Invalid status label "${columnValues[columnMap.accountTier]?.label}". Setting default value "free".`
    );
    columnValues[columnMap.accountTier] = { label: 'free' }; // Set default value
  }

  const columnValuesString = JSON.stringify(columnValues).replace(/\"/g, '\\"');
  const query = `
    mutation {
      create_item (
        board_id: ${boardId},
        item_name: "${itemName}",
        column_values: "${columnValuesString}"
      ) {
        id
        name
      }
    }
  `;

  console.log('Creating a new item in Monday.com with the following details:');
  console.log('Item Name:', itemName);
  console.log('Column Values:', JSON.stringify(columnValues, null, 2)); // Log all column values
  console.log('Board ID:', boardId);

  try {
    const response = await axios.post(
      'https://api.monday.com/v2',
      { query },
      {
        headers: {
          Authorization: MONDAY_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Response from Monday.com:', JSON.stringify(response.data, null, 2));

    // Check if the response contains the expected data structure
    if (response.data && response.data.data && response.data.data.create_item) {
      console.log(
        'Item created successfully in Monday.com. Response data:',
        JSON.stringify(response.data.data.create_item, null, 2)
      );
      return response.data.data.create_item.id; // Return the new item ID for future updates
    } else {
      console.error('Unexpected response structure from Monday.com:', JSON.stringify(response.data, null, 2));
      throw new Error('Failed to create item: Unexpected response structure.');
    }
  } catch (error) {
    console.error(
      'Error creating item in Monday.com:',
      error.response ? error.response.data : error.message
    );
    throw error;
  }
};

// Function to get item ID by account ID
const getItemIdByAccountId = async (accountId, boardId) => {
  // Construct a valid GraphQL query using items to get items from the board with the account ID column value
  const query = `
    query {
      boards(ids: ${boardId}) {
        items(limit: 500) {
          id
          name
          column_values(ids: "${columnMap.accountId}") {
            text
          }
        }
      }
    }
  `;

  console.log('GraphQL query for getItemIdByAccountId:\n', query); // Log the query for troubleshooting
  console.log(`Fetching item ID for account ID: ${accountId} on board ID: ${boardId}`);

  try {
    const response = await axios.post(
      'https://api.monday.com/v2',
      { query },
      {
        headers: {
          Authorization: MONDAY_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(
      'Response from Monday.com for getItemIdByAccountId:',
      JSON.stringify(response.data, null, 2)
    );

    if (response.data && response.data.data && response.data.data.boards.length > 0) {
      const items = response.data.data.boards[0].items;

      console.log('Items on board:', JSON.stringify(items, null, 2)); // Log all items for debugging

      // Find item where the column with id "accountId" matches the given accountId
      const item = items.find((item) =>
        item.column_values.some((column) => column.text === accountId.toString())
      );

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
    console.error(
      'Error finding item by account ID:',
      error.response ? error.response.data : error.message
    );
    throw error;
  }
};

// Function to update multiple column values for an existing item in Monday.com
const updateMondayItem = async (itemId, columnValues, boardId) => {
  // Construct the column values string for GraphQL query
  const columnValuesString = JSON.stringify(columnValues).replace(/\"/g, '\\"');

  const query = `
    mutation {
      change_multiple_column_values (
        board_id: ${boardId},
        item_id: ${itemId},
        column_values: "${columnValuesString}"
      ) {
        id
      }
    }
  `;

  console.log('GraphQL Query for updateMondayItem:\n', query); // Log the GraphQL query for troubleshooting

  try {
    const response = await axios.post(
      'https://api.monday.com/v2',
      { query },
      {
        headers: {
          Authorization: MONDAY_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(
      'Item updated successfully in Monday.com. Response data:',
      JSON.stringify(response.data, null, 2)
    );
  } catch (error) {
    console.error(
      'Error updating item in Monday.com:',
      error.response ? error.response.data : error.message
    );
    throw error;
  }
};

// Export the handler function
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
  console.log('Received notificationType:', notificationType);

  const payload = data.data;

  if (!payload || !payload.app_id) {
    console.error('Invalid payload data:', JSON.stringify(payload, null, 2));
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid payload data' }),
    };
  }

  const { firstName, lastName } = splitName(payload.user_name || '');
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
    [columnMap.email]: { email: payload.user_email || '', text: payload.user_email || '' },
    [columnMap.firstName]: firstName,
    [columnMap.lastName]: lastName,
    [columnMap.timestamp]: { date: payload.timestamp ? payload.timestamp.split('T')[0] : '' },
    [columnMap.slug]: payload.account_slug || '',
    [columnMap.companyName]: payload.account_name || '',
    [columnMap.appId]: payload.app_id.toString(),
    [columnMap.cluster]: payload.user_cluster || '',
    [columnMap.maxUsers]: payload.account_max_users
      ? payload.account_max_users.toString()
      : '',
    [columnMap.accountId]: payload.account_id ? payload.account_id.toString() : '',
    [columnMap.planId]: payload.plan_id ? payload.plan_id.toString() : '',
    [columnMap.country]: {
      countryCode: payload.user_country || '',
      countryName: getCountryName(payload.user_country) || '',
    },
    [columnMap.accountTier]: { label: accountTier }, // Use default or valid value
  };

  console.log(
    'Column values for Monday item operation:',
    JSON.stringify(columnValues, null, 2)
  ); // Log all column values

  try {
    switch (notificationType) {
      case 'install':
        console.log('Handling "install" event.');
        await createMondayItem(
          payload.account_name || 'Unnamed Account',
          columnValues,
          boardId
        );
        break;
      case 'uninstall':
        console.log('Handling "uninstall" event.');
        const uninstallItemId = await getItemIdByAccountId(
          payload.account_id,
          boardId
        );
        if (uninstallItemId) {
          await updateMondayItem(
            uninstallItemId,
            { [columnMap.status]: { label: 'Uninstalled' } },
            boardId
          );
        } else {
          console.error(`No item found with account ID: ${payload.account_id}`);
        }
        break;
      case 'app_subscription_created':
        console.log('Handling "app_subscription_created" event.');
        const createdSubscriptionItemId = await getItemIdByAccountId(
          payload.account_id,
          boardId
        );
        if (createdSubscriptionItemId) {
          await updateMondayItem(
            createdSubscriptionItemId,
            {
              [columnMap.status]: { label: 'Subscription Created' }, // Update the status column
              [columnMap.planId]: payload.plan_id ? payload.plan_id.toString() : '', // Update the plan ID column
            },
            boardId
          );
        }
        break;
      case 'app_subscription_cancelled':
        console.log('Handling "app_subscription_cancelled" event.');
        const cancelledSubscriptionItemId = await getItemIdByAccountId(
          payload.account_id,
          boardId
        );
        if (cancelledSubscriptionItemId) {
          await updateMondayItem(
            cancelledSubscriptionItemId,
            { [columnMap.status]: { label: 'Subscription Cancelled' } },
            boardId
          );
        }
        break;
      case 'app_subscription_renewed':
        console.log('Handling "app_subscription_renewed" event.');
        const renewedSubscriptionItemId = await getItemIdByAccountId(
          payload.account_id,
          boardId
        );
        if (renewedSubscriptionItemId) {
          await updateMondayItem(
            renewedSubscriptionItemId,
            { [columnMap.status]: { label: 'Subscription Renewed' } },
            boardId
          );
        }
        break;
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
