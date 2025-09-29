require('dotenv').config();
const SibApiV3Sdk = require('sib-api-v3-sdk');

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKeyInstance = defaultClient.authentications['api-key'];
apiKeyInstance.apiKey = process.env.BREVO_API_KEY;

const sendEmail = async ({ to, subject, html }) => {
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  const sendSmtpEmail = {
    to: [{ email: to }],
    sender: { email: 'systemsumbong@gmail.com', name: 'SUMBONG SYSTEM' },
    subject,
    htmlContent: html,
  };
  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

module.exports = sendEmail;
