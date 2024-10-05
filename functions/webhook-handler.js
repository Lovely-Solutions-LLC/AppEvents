// functions/webhook-handler.js

const axios = require('axios');
const { getCountryName } = require('../countryTranslator'); // Adjust the path if necessary

// Board ID mapping based on app ID
const boardIdMapping = {
  '10142077': '7517528529', // Status Label Descriptions
  '10126111': '7517444546', // Update Templates
  '10147286': '7517579690', // Facebook Embedded
  '10172591': '7540627206', // Ultimate Team Productivity Tool
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
  const firstName = names.slice(0, -1).join(' ') || names[0] || '';
  const lastName = names.slice(-1).join(' ') || '';
  return { firstName, lastName };
};

// Function to create a new item in Monday.com
const createMondayItem = async (itemName, columnValues, boardId, MONDAY_API_TOKEN) => {
  console.log('Entered createMondayItem function');
  console.log('Item Name:', itemName);
  console.log('Board ID:', boardId);
  console.log('Column Values:', JSON.stringify(columnValues, null, 2));

  // Ensure valid status labels for the account tier
  const validStatusLabels = ['pro', 'standard', 'enterprise', 'free', 'basic'];
  if (!validStatusLabels.includes(columnValues[columnMap.accountTier]?.label)) {
    console.warn(
      `Invalid status label "${columnValues[columnMap.accountTier]?.label}". Setting default value "free".`
    );
    columnValues[columnMap.accountTier] = { label: 'free' }; // Set default value
  }

  // Mutation with correct variable types
  const query = `
    mutation createItem($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item(
        board_id: $boardId,
        item_name: $itemName,
        column_values: $columnValues
      ) {
        id
        name
      }
    }
  `;

  const variables = {
    boardId: boardId.toString(), // Ensure boardId is a string
    itemName,
    columnValues: JSON.stringify(columnValues),
  };

  console.log('GraphQL Query for createMondayItem:\n', query);
  console.log('Variables:', JSON.stringify(variables, null, 2));

  try {
    const response = await axios.post(
      'https://api.monday.com/v2',
      { query, variables },
      {
        headers: {
          Authorization: MONDAY_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Response from Monday.com:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.data && response.data.data.create_item) {
      console.log(
        'Item created successfully in Monday.com. Response data:',
        JSON.stringify(response.data.data.create_item, null, 2)
      );
      return response.data.data.create_item.id; // Return the new item ID for future updates
    } else if (response.data && response.data.errors) {
      console.error('GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
      throw new Error('Failed to create item: ' + response.data.errors[0].message);
    } else {
      console.error(
        'Unexpected response structure from Monday.com:',
        JSON.stringify(response.data, null, 2)
      );
      throw new Error('Failed to create item: Unexpected response structure.');
    }
  } catch (error) {
    console.error(
      'Error creating item in Monday.com:',
      error.response ? JSON.stringify(error.response.data, null, 2) : error.message
    );
    throw error;
  }
};

// Function to get item ID by account ID using items_page
const getItemIdByAccountId = async (accountId, boardId, MONDAY_API_TOKEN) => {
  console.log('Entered getItemIdByAccountId function');
  console.log('Account ID:', accountId);
  console.log('Board ID:', boardId);

  const query = `
    query getItemByAccountId($boardId: ID!, $columnId: String!, $limit: Int!) {
      boards(ids: [$boardId]) {
        items_page(limit: $limit) {
          items {
            id
            name
            column_values(ids: [$columnId]) {
              id
              text
            }
          }
        }
      }
    }
  `;

  const variables = {
    boardId: boardId.toString(),
    columnId: columnMap.accountId,
    limit: 500, // Adjust the limit as needed
  };

  console.log('GraphQL Query for getItemIdByAccountId:\n', query);
  console.log('Variables:', JSON.stringify(variables, null, 2));

  try {
    const response = await axios.post(
      'https://api.monday.com/v2',
      { query, variables },
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

    if (
      response.data &&
      response.data.data &&
      response.data.data.boards.length > 0
    ) {
      const items = response.data.data.boards[0].items_page.items;

      if (items && items.length > 0) {
        // Find the item with the matching accountId in the specified column
        const item = items.find((item) =>
          item.column_values.some(
            (column) =>
              column.id === columnMap.accountId &&
              column.text === accountId.toString()
          )
        );

        if (item) {
          console.log(`Found item with ID: ${item.id} for account ID: ${accountId}`);
          return item.id; // Return the ID of the matching item
        } else {
          console.error(`No items found with account ID: ${accountId} on board: ${boardId}`);
          return null;
        }
      } else {
        console.error(`No items found on board: ${boardId}`);
        return null;
      }
    } else if (response.data && response.data.errors) {
      console.error('GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
      throw new Error('Failed to get item: ' + response.data.errors[0].message);
    } else {
      console.error('Invalid response structure:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.error(
      'Error finding item by account ID:',
      error.response ? JSON.stringify(error.response.data, null, 2) : error.message
    );
    throw error;
  }
};

// Function to update multiple column values for an existing item in Monday.com
const updateMondayItem = async (itemId, columnValues, boardId, MONDAY_API_TOKEN) => {
  console.log('Entered updateMondayItem function');
  console.log('Item ID:', itemId);
  console.log('Board ID:', boardId);
  console.log('Column Values:', JSON.stringify(columnValues, null, 2));

  const query = `
    mutation updateItem($boardId: ID!, $itemId: Int!, $columnValues: JSON!) {
      change_multiple_column_values(
        board_id: $boardId,
        item_id: $itemId,
        column_values: $columnValues
      ) {
        id
      }
    }
  `;

  const variables = {
    boardId: boardId.toString(), // Ensure boardId is a string
    itemId: parseInt(itemId),
    columnValues: JSON.stringify(columnValues),
  };

  console.log('GraphQL Query for updateMondayItem:\n', query);
  console.log('Variables:', JSON.stringify(variables, null, 2));

  try {
    const response = await axios.post(
      'https://api.monday.com/v2',
      { query, variables },
      {
        headers: {
          Authorization: MONDAY_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Response from Monday.com for updateMondayItem:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.data && response.data.data.change_multiple_column_values) {
      console.log('Item updated successfully in Monday.com.');
    } else if (response.data && response.data.errors) {
      console.error('GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
      throw new Error('Failed to update item: ' + response.data.errors[0].message);
    } else {
      console.error(
        'Unexpected response structure from Monday.com:',
        JSON.stringify(response.data, null, 2)
      );
      throw new Error('Failed to update item: Unexpected response structure.');
    }
  } catch (error) {
    console.error(
      'Error updating item in Monday.com:',
      error.response ? JSON.stringify(error.response.data, null, 2) : error.message
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
          boardId,
          MONDAY_API_TOKEN
        );
        break;
      case 'uninstall':
        console.log('Handling "uninstall" event.');
        const uninstallItemId = await getItemIdByAccountId(
          payload.account_id,
          boardId,
          MONDAY_API_TOKEN
        );
        if (uninstallItemId) {
          await updateMondayItem(
            uninstallItemId,
            { [columnMap.status]: { label: 'Uninstalled' } },
            boardId,
            MONDAY_API_TOKEN
          );
        } else {
          console.error(`No item found with account ID: ${payload.account_id}`);
        }
        break;
      case 'app_subscription_created':
        console.log('Handling "app_subscription_created" event.');
        const createdSubscriptionItemId = await getItemIdByAccountId(
          payload.account_id,
          boardId,
          MONDAY_API_TOKEN
        );
        if (createdSubscriptionItemId) {
          await updateMondayItem(
            createdSubscriptionItemId,
            {
              [columnMap.status]: { label: 'Subscription Created' }, // Update the status column
              [columnMap.planId]: payload.plan_id ? payload.plan_id.toString() : '', // Update the plan ID column
            },
            boardId,
            MONDAY_API_TOKEN
          );
        } else {
          console.error(`No item found with account ID: ${payload.account_id}`);
        }
        break;
      case 'app_subscription_cancelled':
        console.log('Handling "app_subscription_cancelled" event.');
        const cancelledSubscriptionItemId = await getItemIdByAccountId(
          payload.account_id,
          boardId,
          MONDAY_API_TOKEN
        );
        if (cancelledSubscriptionItemId) {
          await updateMondayItem(
            cancelledSubscriptionItemId,
            { [columnMap.status]: { label: 'Subscription Cancelled' } },
            boardId,
            MONDAY_API_TOKEN
          );
        } else {
          console.error(`No item found with account ID: ${payload.account_id}`);
        }
        break;
      case 'app_subscription_renewed':
        console.log('Handling "app_subscription_renewed" event.');
        const renewedSubscriptionItemId = await getItemIdByAccountId(
          payload.account_id,
          boardId,
          MONDAY_API_TOKEN
        );
        if (renewedSubscriptionItemId) {
          await updateMondayItem(
            renewedSubscriptionItemId,
            { [columnMap.status]: { label: 'Subscription Renewed' } },
            boardId,
            MONDAY_API_TOKEN
          );
        } else {
          console.error(`No item found with account ID: ${payload.account_id}`);
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
