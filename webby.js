const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { getCountryName } = require('./countryTranslator'); // Import the country translator

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Monday.com API token
const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;

// Board ID mapping based on app ID
const boardIdMapping = {
    '10142077': '7517528529', // Board ID for App 10142077 (Status Label Descriptions)
    '10126111': '7517444546', // Board ID for App 10126111 (Update Templates)
    '10147286': '7517579690'  // Board ID for App 10147286 (Facebook Embedded)
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
    accountTier: 'status__1' // Separate status column specifically for account tier
};

// Function to create a new item in Monday.com
const createMondayItem = async (itemName, columnValues, boardId) => {
    const columnValuesString = JSON.stringify(columnValues).replace(/\"/g, '\\"');
    const query = `
        mutation {
            create_item (
                board_id: ${boardId},
                item_name: "${itemName}",
                column_values: "${columnValuesString}"
            ) {
                id
            }
        }
    `;

    console.log('Creating a new item in Monday.com with the following details:');
    console.log('Item Name:', itemName);
    console.log('Column Values:', JSON.stringify(columnValues, null, 2));  // Log all column values
    console.log('Board ID:', boardId);

    try {
        const response = await axios.post('https://api.monday.com/v2', { query }, {
            headers: {
                Authorization: MONDAY_API_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        console.log('Item created successfully in Monday.com. Response data:', JSON.stringify(response.data, null, 2));
        return response.data.data.create_item.id; // Return the new item ID for future updates
    } catch (error) {
        console.error('Error creating item in Monday.com:', error.response ? error.response.data : error.message);
        throw error;
    }
};

// Function to get item ID by account ID
const getItemIdByAccountId = async (accountId, boardId) => {
    const query = `
        query {
            boards(ids: ${boardId}) {
                items_page {
                    items {
                        id
                        name
                        column_values(ids: ["text2__1"]) { // Uses accountId column to find the correct item
                            text
                        }
                    }
                }
            }
        }
    `;

    console.log(`Fetching item ID for account ID: ${accountId} on board ID: ${boardId}`);

    try {
        const response = await axios.post('https://api.monday.com/v2', { query }, {
            headers: {
                Authorization: MONDAY_API_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response from Monday.com for getItemIdByAccountId:', JSON.stringify(response.data, null, 2));

        if (response.data && response.data.data && response.data.data.boards.length > 0) {
            const items = response.data.data.boards[0].items_page.items;

            console.log('Items on board for uninstall event:', JSON.stringify(items, null, 2)); // Log all items for debugging

            // Find item where the column with id "text2__1" (account_id column) matches the given accountId
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

// Function to update an existing item in Monday.com
const updateMondayItem = async (itemId, columnValues, boardId) => {
    const columnValuesString = JSON.stringify(columnValues).replace(/\"/g, '\\"');
    const query = `
        mutation {
            change_column_values (
                board_id: ${boardId},
                item_id: ${itemId},
                column_values: "${columnValuesString}"
            ) {
                id
            }
        }
    `;

    console.log('GraphQL Query for updateMondayItem:\n', query);  // Log the entire GraphQL query for troubleshooting

    try {
        const response = await axios.post('https://api.monday.com/v2', { query }, {
            headers: {
                Authorization: MONDAY_API_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        console.log('Item updated successfully in Monday.com. Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error updating item in Monday.com:', error.response ? error.response.data : error.message);
        throw error;
    }
};

// Webhook endpoint
app.post('/webhook', async (req, res) => {
    console.log('Webhook received:', JSON.stringify(req.body, null, 2));  // Log entire webhook payload for visibility

    const notificationType = req.body.type;
    const data = req.body.data;

    const { firstName, lastName } = splitName(data.user_name);
    const boardId = boardIdMapping[data.app_id];

    if (!boardId) {
        console.error('No board mapping found for app:', data.app_id);
        res.sendStatus(400);
        return;
    }

    // Build the column values dynamically using the column mapping
    const columnValues = {
        [columnMap.email]: { email: data.user_email, text: data.user_email },
        [columnMap.firstName]: firstName,
        [columnMap.lastName]: lastName,
        [columnMap.timestamp]: { date: data.timestamp.split('T')[0] },
        [columnMap.slug]: data.account_slug,
        [columnMap.companyName]: data.account_name,
        [columnMap.appId]: data.app_id.toString(),
        [columnMap.cluster]: data.user_cluster,
        [columnMap.maxUsers]: data.account_max_users.toString(),
        [columnMap.accountId]: data.account_id.toString(),
        [columnMap.planId]: data.plan_id ? data.plan_id.toString() : '',
        [columnMap.country]: { countryCode: data.user_country, countryName: getCountryName(data.user_country) },
        [columnMap.accountTier]: { label: data.account_tier || 'Unknown' } // Populate account tier status label
    };

    console.log('Column values for Monday item operation:', JSON.stringify(columnValues, null, 2));  // Log all column values

    try {
        switch (notificationType) {
            case 'install':
                console.log('Handling "install" event.');
                await createMondayItem(data.account_name, columnValues, boardId);
                break;
            case 'uninstall':
                console.log('Handling "uninstall" event.');
                const uninstallItemId = await getItemIdByAccountId(data.account_id, boardId);
                if (uninstallItemId) {
                    await updateMondayItem(uninstallItemId, { [columnMap.status]: { label: 'Uninstalled' } }, boardId);
                }
                break;
            case 'app_subscription_created':
                console.log('Handling "app_subscription_created" event.');
                const createdSubscriptionItemId = await getItemIdByAccountId(data.account_id, boardId);
                if (createdSubscriptionItemId) {
                    await updateMondayItem(createdSubscriptionItemId, {
                        [columnMap.status]: { label: 'Subscription Created' },
                        [columnMap.planId]: data.plan_id ? data.plan_id.toString() : ''
                    }, boardId);
                }
                break;
            case 'app_subscription_cancelled':
                console.log('Handling "app_subscription_cancelled" event.');
                const cancelledSubscriptionItemId = await getItemIdByAccountId(data.account_id, boardId);
                if (cancelledSubscriptionItemId) {
                    await updateMondayItem(cancelledSubscriptionItemId, { [columnMap.status]: { label: 'Subscription Cancelled' } }, boardId);
                }
                break;
            case 'app_subscription_renewed':
                console.log('Handling "app_subscription_renewed" event.');
                const renewedSubscriptionItemId = await getItemIdByAccountId(data.account_id, boardId);
                if (renewedSubscriptionItemId) {
                    await updateMondayItem(renewedSubscriptionItemId, { [columnMap.status]: { label: 'Subscription Renewed' } }, boardId);
                }
                break;
            default:
                console.log('Ignoring unhandled event type:', notificationType);
                res.sendStatus(200);
                return;
        }
    } catch (error) {
        console.error('Error handling webhook event:', error);
    }

    res.sendStatus(200);
});

// Function to split full name into first and last name
const splitName = (fullName) => {
    const names = fullName.split(' ');
    const firstName = names.slice(0, -1).join(' ');
    const lastName = names.slice(-1).join(' ');
    return { firstName, lastName };
};

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
