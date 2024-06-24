const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Email configuration using environment variables
const transporter = nodemailer.createTransport({
    service: 'hotmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Monday.com API token and board ID
const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID;

// Function to send email
const sendEmail = (subject, text) => {
    const mailOptions = {
        from: process.env.EMAIL_USER, // Sender address
        to: 'liambailey131@outlook.com', // Your real email address
        subject: subject,
        text: text
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error sending email:', error);
            return;
        }
        console.log('Email sent:', info.response);
    });
};

// Function to split full name into first and last name
const splitName = (fullName) => {
    const names = fullName.split(' ');
    const firstName = names.slice(0, -1).join(' ');
    const lastName = names.slice(-1).join(' ');
    return { firstName, lastName };
};

// Function to create a new item in Monday.com
const createMondayItem = async (itemName, columnValues) => {
    const columnValuesString = JSON.stringify(columnValues).replace(/\"/g, '\\"');
    const query = `
        mutation {
            create_item (
                board_id: ${MONDAY_BOARD_ID},
                item_name: "${itemName}",
                column_values: "${columnValuesString}"
            ) {
                id
            }
        }
    `;

    console.log('GraphQL Query:', query); // Log the query for debugging

    try {
        const response = await axios.post('https://api.monday.com/v2', { query }, {
            headers: {
                Authorization: MONDAY_API_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        console.log('Item created in Monday.com:', response.data);
    } catch (error) {
        console.error('Error creating item in Monday.com:', error.response ? error.response.data : error.message);
    }
};

// Webhook endpoint
app.post('/webhook', (req, res) => {
    console.log('Webhook received:', req.body);

    const notificationType = req.body.type;
    const data = req.body.data;

    let subject, text, columnValues, itemName;
    const { firstName, lastName } = splitName(data.user_name);
    columnValues = {
        email__1: { email: data.user_email, text: data.user_name },
        text8__1: firstName,
        text9__1: lastName,
        date4: { date: data.timestamp.split('T')[0] },
        text__1: data.account_slug,
        text1__1: data.account_name,
        text3__1: data.app_id.toString(),
        text0__1: data.user_cluster,
        status__1: { label: "Pro" }, // Using a valid status label
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
            createMondayItem(itemName, columnValues);
            break;
        case 'app_subscription_created':
            subject = 'New App Subscription Created';
            itemName = "Subscription Created";
            text = `A new subscription has been created:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(itemName, columnValues);
            break;
        case 'app_subscription_changed':
            subject = 'App Subscription Changed';
            itemName = "Subscription Changed";
            text = `A subscription has been changed:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(itemName, columnValues);
            break;
        case 'app_trial_subscription_started':
            subject = 'App Trial Subscription Started';
            itemName = "Trial Subscription Started";
            text = `A trial subscription has started:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(itemName, columnValues);
            break;
        case 'uninstall':
            subject = 'App Uninstalled';
            itemName = "App Uninstalled";
            text = `The app has been uninstalled:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(itemName, columnValues);
            break;
        case 'app_subscription_renewed':
            subject = 'App Subscription Renewed';
            itemName = "Subscription Renewed";
            text = `A subscription has been renewed:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(itemName, columnValues);
            break;
        case 'app_subscription_cancelled':
            subject = 'App Subscription Cancelled';
            itemName = "Subscription Cancelled";
            text = `A subscription has been cancelled:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(itemName, columnValues);
            break;
        default:
            res.sendStatus(200); // Ignore other events
            return;
    }

    sendEmail(subject, text);
    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
