app.post('/webhook', (req, res) => {
    console.log('Webhook received:', req.body);

    const notificationType = req.body.type;
    const data = req.body.data;

    let subject, text, columnValues, itemName;
    const { firstName, lastName } = splitName(data.user_name);
    const groupId = getGroupId(data.app_id);
    let statusLabel = data.account_tier ? data.account_tier.toLowerCase() : 'free'; // Set default value to 'free'

    columnValues = {
        email__1: { email: data.user_email, text: data.user_email },
        text8__1: firstName,
        text9__1: lastName,
        date4: { date: data.timestamp.split('T')[0] },
        text__1: data.account_slug,
        text1__1: data.account_name,
        text3__1: data.app_id.toString(),
        text0__1: data.user_cluster,
        status__1: { label: statusLabel },
        text7__1: data.account_max_users.toString(),
        text2__1: data.account_id.toString(),
        text21__1: data.plan_id,
        text6__1: data.user_country
    };

    console.log('Column Values:', columnValues); // Log column values for debugging

    switch (notificationType) {
        case 'install':
            subject = 'New App Installation';
            itemName = "New Installation";
            text = `A new user has installed your app:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(itemName, columnValues, groupId);
            sendEmail(subject, text);
            break;
        case 'app_subscription_created':
            subject = 'New App Subscription Created';
            itemName = "Subscription Created";
            text = `A new subscription has been created:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(itemName, columnValues, groupId);
            sendEmail(subject, text);
            break;
        case 'app_subscription_changed':
            subject = 'App Subscription Changed';
            itemName = "Subscription Changed";
            text = `A subscription has been changed:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(itemName, columnValues, groupId);
            sendEmail(subject, text);
            break;
        case 'uninstall':
            subject = 'App Uninstalled';
            itemName = "App Uninstalled";
            text = `The app has been uninstalled:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(itemName, columnValues, groupId);
            sendEmail(subject, text);
            break;
        case 'app_subscription_renewed':
            subject = 'App Subscription Renewed';
            itemName = "Subscription Renewed";
            text = `A subscription has been renewed:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(itemName, columnValues, groupId);
            sendEmail(subject, text);
            break;
        case 'app_subscription_cancelled':
            subject = 'App Subscription Cancelled';
            itemName = "Subscription Cancelled";
            text = `A subscription has been cancelled:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(itemName, columnValues, groupId);
            sendEmail(subject, text);
            break;
        // Remove handling for 'app_trial_subscription_started'
        case 'app_trial_subscription_started':
            // Do nothing
            res.sendStatus(200);
            return;
        default:
            res.sendStatus(200); // Ignore other events
            return;
    }

    res.sendStatus(200);
});
