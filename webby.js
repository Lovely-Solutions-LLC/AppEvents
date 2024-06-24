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
        to: 'liambailey131@outlook.com', // Replace with your real email address
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

// Function to create a new item in Monday.com
const createMondayItem = async (itemName, columnValues) => {
    const query = `
        mutation {
            create_item (
                board_id: ${MONDAY_BOARD_ID},
                item_name: "${itemName}",
                column_values: "${JSON.stringify(columnValues).replace(/"/g, '\\"')}"
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

    let subject, text, columnValues;
    columnValues = {
        email__1: JSON.stringify({ email: data.user_email, text: data.user_name }),
        date4: JSON.stringify({ date: data.timestamp }),
        text__1: JSON.stringify(data.account_slug),
        text1__1: JSON.stringify(data.account_name),
        text3__1: JSON.stringify(data.app_id),
        text0__1: JSON.stringify(data.user_cluster),
        status__1: JSON.stringify({ label: data.account_tier }),
        text7__1: JSON.stringify(data.account_max_users),
        text2__1: JSON.stringify(data.account_id),
        text21__1: JSON.stringify(data.plan_id),
        text6__1: JSON.stringify(data.user_country)
    };

    console.log('Column Values:', columnValues); // Log column values for debugging

    switch (notificationType) {
        case 'install':
            subject = 'New App Installation';
            text = `A new user has installed your app:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(data.user_name, columnValues);
            break;
        case 'app_subscription_created':
            subject = 'New App Subscription Created';
            text = `A new subscription has been created:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(data.user_name, columnValues);
            break;
        case 'app_subscription_changed':
            subject = 'App Subscription Changed';
            text = `A subscription has been changed:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(data.user_name, columnValues);
            break;
        case 'app_trial_subscription_started':
            subject = 'App Trial Subscription Started';
            text = `A trial subscription has started:\n${JSON.stringify(data, null, 2)}`;
            createMondayItem(data.user_name, columnValues);
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
