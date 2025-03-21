// functions/webhook-handler.js

const axios = require('axios');
const { getCountryName } = require('../countryTranslator'); // Ensure this path is correct

// Board ID mapping based on app ID
const boardIdMapping = {
  '10142077': '7517528529', // Status Label Descriptions
  '10126111': '7517444546', // Update Templates
  '10147286': '7517579690', // Facebook Embedded
  '10172591': '7540627206', // Ultimate Team Productivity Tool
  '10233302': '7722486447', // Time Tracking Exports
  '10228966': '8371249876', // Aircall CRM Integration
};

// Column IDs (Ensure these match exactly with your Monday.com board's column IDs)
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

    console.log('Response from Monday.com for createMondayItem:', JSON.stringify(response.data, null, 2));

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
    query getItemByAccountId($boardId: ID!, $limit: Int!, $queryParams: ItemsQuery!) {
      boards(ids: [$boardId]) {
        items_page(limit: $limit, query_params: $queryParams) {
          cursor
          items {
            id
            name
            column_values {
              id
              text
            }
          }
        }
      }
    }
  `;

  const queryParams = {
    rules: [
      {
        column_id: columnMap.accountId,
        compare_value: [accountId.toString()],
        operator: 'any_of', // Changed from 'eq' to 'any_of'
      },
    ],
    operator: 'and',
  };

  const variables = {
    boardId: boardId.toString(),
    limit: 500, // Maximum allowed by Monday.com API
    queryParams,
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
      response.data.data.boards.length > 0 &&
      response.data.data.boards[0].items_page.items.length > 0
    ) {
      const items = response.data.data.boards[0].items_page.items;
      console.log(`Retrieved ${items.length} items matching account ID: ${accountId}`);

      for (const item of items) {
        const accountIdColumn = item.column_values.find(
          (column) => column.id === columnMap.accountId
        );
        console.log(
          `Item ID: ${item.id}, Account ID in item: ${accountIdColumn?.text}`
        );

        if (accountIdColumn && accountIdColumn.text === accountId.toString()) {
          console.log(
            `Found item with ID: ${item.id} for account ID: ${accountId}`
          );
          return item.id; // Return the ID of the matching item
        }
      }
    } else if (response.data && response.data.errors) {
      console.error('GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
      throw new Error('Failed to get item: ' + response.data.errors[0].message);
    } else {
      console.log(`No items found with account ID: ${accountId}`);
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
    mutation updateItem($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
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
    boardId: boardId.toString(),
    itemId: itemId.toString(),
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

    console.log(
      'Response from Monday.com for updateMondayItem:',
      JSON.stringify(response.data, null, 2)
    );

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
        const createdItemId = await createMondayItem(
          payload.account_name || 'Unnamed Account',
          columnValues,
          boardId,
          MONDAY_API_TOKEN
        );
        console.log(`Created item ID: ${createdItemId}`);
        break;

      case 'uninstall':
        console.log('Handling "uninstall" event.');
        let uninstallItemId = null;
        let attempts = 0;
        const maxAttempts = 3;
        const delay = 2000; // 2 seconds

        while (!uninstallItemId && attempts < maxAttempts) {
          attempts++;
          try {
            uninstallItemId = await getItemIdByAccountId(
              payload.account_id,
              boardId,
              MONDAY_API_TOKEN
            );
            if (!uninstallItemId) {
              console.log(`Attempt ${attempts}: Item not found. Retrying in ${delay}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          } catch (error) {
            console.error('Error during item retrieval:', error);
            break;
          }
        }

        if (uninstallItemId) {
          await updateMondayItem(
            uninstallItemId,
            { [columnMap.status]: { label: 'Uninstalled' } },
            boardId,
            MONDAY_API_TOKEN
          );
        } else {
          console.error(`No item found with account ID: ${payload.account_id} after ${attempts} attempts`);
        }
        break;

      case 'subscription_created':
        console.log('Handling "subscription_created" event.');
        let createdSubscriptionItemId = null;
        attempts = 0;
        while (!createdSubscriptionItemId && attempts < maxAttempts) {
          attempts++;
          try {
            createdSubscriptionItemId = await getItemIdByAccountId(
              payload.account_id,
              boardId,
              MONDAY_API_TOKEN
            );
            if (!createdSubscriptionItemId) {
              console.log(`Attempt ${attempts}: Item not found. Retrying in ${delay}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          } catch (error) {
            console.error('Error during item retrieval:', error);
            break;
          }
        }

        if (createdSubscriptionItemId) {
          await updateMondayItem(
            createdSubscriptionItemId,
            { [columnMap.status]: { label: 'Subscription Created' } },
            boardId,
            MONDAY_API_TOKEN
          );
        } else {
          console.error(`No item found with account ID: ${payload.account_id} after ${attempts} attempts`);
        }
        break;

      case 'subscription_cancelled':
        console.log('Handling "subscription_cancelled" event.');
        let cancelledSubscriptionItemId = null;
        attempts = 0;
        while (!cancelledSubscriptionItemId && attempts < maxAttempts) {
          attempts++;
          try {
            cancelledSubscriptionItemId = await getItemIdByAccountId(
              payload.account_id,
              boardId,
              MONDAY_API_TOKEN
            );
            if (!cancelledSubscriptionItemId) {
              console.log(`Attempt ${attempts}: Item not found. Retrying in ${delay}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          } catch (error) {
            console.error('Error during item retrieval:', error);
            break;
          }
        }

        if (cancelledSubscriptionItemId) {
          await updateMondayItem(
            cancelledSubscriptionItemId,
            { [columnMap.status]: { label: 'Subscription Cancelled' } },
            boardId,
            MONDAY_API_TOKEN
          );
        } else {
          console.error(`No item found with account ID: ${payload.account_id} after ${attempts} attempts`);
        }
        break;

      case 'subscription_renewed':
        console.log('Handling "subscription_renewed" event.');
        let renewedSubscriptionItemId = null;
        attempts = 0;
        while (!renewedSubscriptionItemId && attempts < maxAttempts) {
          attempts++;
          try {
            renewedSubscriptionItemId = await getItemIdByAccountId(
              payload.account_id,
              boardId,
              MONDAY_API_TOKEN
            );
            if (!renewedSubscriptionItemId) {
              console.log(`Attempt ${attempts}: Item not found. Retrying in ${delay}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          } catch (error) {
            console.error('Error during item retrieval:', error);
            break;
          }
        }

        if (renewedSubscriptionItemId) {
          await updateMondayItem(
            renewedSubscriptionItemId,
            { [columnMap.status]: { label: 'Subscription Renewed' } },
            boardId,
            MONDAY_API_TOKEN
          );
        } else {
          console.error(`No item found with account ID: ${payload.account_id} after ${attempts} attempts`);
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
