// utils/sendVerificationCode.js

const twilio = require("twilio");

// Your Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Initialize client only if credentials are valid
let client = null;
if (accountSid && authToken && accountSid.startsWith('AC')) {
  client = new twilio(accountSid, authToken);
}

const sendVerificationCode = async (phoneNumber, verificationCode) => {
  if (!client) {
    console.warn("Twilio not configured, skipping SMS verification");
    return false;
  }
  
  try {
    const message = await client.messages.create({
      body: `Your verification code is: ${verificationCode}`,
      from: "+15025571497",
      to: phoneNumber,
    });
    console.log("Verification code sent:", message.sid);
    return true;
  } catch (error) {
    console.error("Error sending verification code:", error);
    return false;
  }
};

module.exports = { sendVerificationCode };
