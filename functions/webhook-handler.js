// functions/webhook-handler.js

const axios = require('axios');
const { getCountryName } = require('../countryTranslator'); // Adjust the path accordingly

// ... [other code remains the same] ...

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
        [columnMap.timestamp]: { date: payload.timestamp.split('T')[0] },
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
                            [columnMap.status]: { label: 'Subscription Created' },
                            [columnMap.planId]: payload.plan_id ? payload.plan_id.toString() : '',
                        },
                        boardId,
                        MONDAY_API_TOKEN
                    );
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
                }
                break;
            default:
                console.log('Ignoring unhandled event type:', notificationType);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ message: 'Event type ignored.' }),
                };
        }  // <-- Added closing brace for switch statement
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
};  // Closing brace for exports.handler
